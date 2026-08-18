import * as THREE from 'three';

// ============================================================
//  VIKENDICA MERI — Three.js Hero Scene
//  A-frame cabin · Winter ↔ Summer scroll transition
//  Mouse hover → glowing string lights · gentle float/breathe
// ============================================================

// Season endpoints, allocated once. These used to be constructed inside the
// render loop, which meant ~65 THREE.Color allocations every single frame.
const C_GROUND_WINTER = new THREE.Color(0xe8eef5);
const C_GROUND_SUMMER = new THREE.Color(0x4a8a3a);
const C_FOLIAGE_WINTER = new THREE.Color(0x1a4a1a);
const C_FOLIAGE_SUMMER = new THREE.Color(0x2d7a2d);
const C_AMBIENT_WINTER = new THREE.Color(0x404060);
const C_AMBIENT_SUMMER = new THREE.Color(0x88aacc);
const C_DIR_WINTER = new THREE.Color(0x8888cc);
const C_DIR_SUMMER = new THREE.Color(0xffffee);

const SNOW_MAX = 1400;
const STAR_MAX = 500;

// Quality tiers. The sky is a full-screen backside sphere running domain-warped
// fbm noise per pixel — comfortably the most expensive thing here — so the octave
// count, the pixel ratio and the shadow pass are what actually move the needle
// on a phone.
const TIERS = {
  high: { dpr: 2, shadows: true, snow: SNOW_MAX, stars: STAR_MAX, octaves: 4, lightEvery: 3 },
  low: { dpr: 1.5, shadows: false, snow: 400, stars: 150, octaves: 2, lightEvery: 5 },
};

export class CabinHeroScene {
  constructor(container) {
    this.container = container;
    this.scrollProgress = 0; // 0 = winter, 1 = summer
    this.targetScrollProgress = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.hoverIntensity = 0;
    this.targetHoverIntensity = 0;
    this.clock = new THREE.Clock();
    this.lights = [];
    this.snowParticles = null;
    this.starParticles = null;
    this.cabinGroup = new THREE.Group();
    this.groundMesh = null;
    this.roofSnowMesh = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pick a starting tier from device hints; _animate() steps it down if the
    // measured frame time says the guess was optimistic.
    this.tierName = this._detectTier();
    this.tier = TIERS[this.tierName];

    // Reduced motion still needs to answer scroll — the winter/summer transition
    // is the content, not decoration — but it renders on demand instead of
    // continuously, and every ambient animation below is switched off.
    this._dirty = true;
    this._paused = false;
    this._frames = 0;
    this._sampleStart = 0;

    this._init();
    this._createScene();
    this._createLights();
    this._createCabin();
    this._createTrees();
    this._createGround();
    this._createSnowParticles();
    this._createStarParticles();
    this._createStringLights();
    this._bindEvents();
    this._animate();
  }

  _size() {
    return {
      w: this.container.clientWidth || window.innerWidth,
      h: this.container.clientHeight || window.innerHeight,
    };
  }

  _detectTier() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (coarse || window.innerWidth < 900 || memory <= 4 || cores <= 4) return 'low';
    return 'high';
  }

  // ----------------------------------------------------------
  //  INIT
  // ----------------------------------------------------------
  _init() {
    const { w, h } = this._size();
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(0, 4, 18);
    this.camera.lookAt(0, 3, 0);

    // alpha:false — the sky sphere (r=80, camera always inside) covers every
    // pixel, so there is nothing to blend against and an opaque buffer is cheaper.
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.tierName === 'high',
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x0a0e1a, 1);
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.tier.dpr));
    this.renderer.shadowMap.enabled = this.tier.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  // ----------------------------------------------------------
  //  SCENE BACKGROUND (sky shader: winter night ↔ summer day)
  // ----------------------------------------------------------
  _createScene() {
    const skyGeo = new THREE.SphereGeometry(80, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { uProgress: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        #define FBM_OCTAVES ${this.tier.octaves}
        uniform float uProgress;
        uniform float uTime;
        varying vec3 vWorldPos;

        // --- Fractal-glass gradient (domain-warped value-noise fbm) ---
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < FBM_OCTAVES; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float y = dir.y;

          // 2D domain for the flowing glass field.
          vec2 p = vec2(atan(dir.z, dir.x) * 0.7, y * 1.5);
          float t = uTime * 0.035;

          // Two-level domain warp → fractal-glass swirl.
          vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
          float f = fbm(p + 3.2 * q + t * 0.4);
          float swirl = clamp(length(q), 0.0, 1.0);

          // Winter glass palette (cool indigo / violet / teal).
          vec3 wA = vec3(0.03, 0.04, 0.14);
          vec3 wB = vec3(0.10, 0.13, 0.34);
          vec3 wC = vec3(0.24, 0.20, 0.46);
          vec3 wD = vec3(0.16, 0.34, 0.50);
          vec3 winter = mix(wA, wB, clamp(f * 1.6, 0.0, 1.0));
          winter = mix(winter, wC, swirl * 0.8);
          winter = mix(winter, wD, clamp(q.x * 1.2, 0.0, 1.0) * 0.5);

          // Summer glass palette (warm amber / peach / sky).
          vec3 sA = vec3(0.30, 0.55, 0.85);
          vec3 sB = vec3(0.58, 0.78, 0.92);
          vec3 sC = vec3(0.95, 0.78, 0.52);
          vec3 sD = vec3(0.95, 0.55, 0.45);
          vec3 summer = mix(sA, sB, clamp(f * 1.6, 0.0, 1.0));
          summer = mix(summer, sC, swirl * 0.8);
          summer = mix(summer, sD, clamp(q.y * 1.2, 0.0, 1.0) * 0.5);

          vec3 col = mix(winter, summer, uProgress);

          // Soft horizon lift.
          col += vec3(0.05, 0.04, 0.08) * (1.0 - uProgress) * smoothstep(0.35, -0.15, y);

          // Glassy sheen banding.
          col += 0.035 * sin(f * 10.0 + uTime * 0.5) * (0.6 + 0.4 * swirl);

          // Stars (winter, upper hemisphere).
          if (y > 0.05) {
            vec2 su = dir.xz / (dir.y + 0.2) * 9.0;
            float star = hash(floor(su * 22.0));
            star = step(0.985, star) * star;
            float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + star * 120.0);
            col += vec3(star * twinkle * (1.0 - uProgress));
          }

          // Moon / sun glow at zenith.
          float celestial = smoothstep(0.985, 0.997, y);
          col += (vec3(0.9, 0.9, 0.8) * (1.0 - uProgress) + vec3(1.0, 0.95, 0.7) * uProgress) * celestial * 1.6;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
  }

  // ----------------------------------------------------------
  //  LIGHTS
  // ----------------------------------------------------------
  _createLights() {
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0x8888cc, 0.6);
    this.dirLight.position.set(5, 10, 5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.dirLight);

    this.interiorLight = new THREE.PointLight(0xff8844, 1.5, 15);
    this.interiorLight.position.set(0, 3, 0);
    this.scene.add(this.interiorLight);

    this.fillLight = new THREE.PointLight(0x4466aa, 0.3, 20);
    this.fillLight.position.set(0, -2, 10);
    this.scene.add(this.fillLight);
  }

  // ----------------------------------------------------------
  //  A-FRAME CABIN
  // ----------------------------------------------------------
  _createCabin() {
    const cabin = this.cabinGroup;

    const frameShape = new THREE.Shape();
    frameShape.moveTo(-5, 0);
    frameShape.lineTo(0, 9);
    frameShape.lineTo(5, 0);
    frameShape.lineTo(-5, 0);
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 10, bevelEnabled: false });
    frameGeo.translate(0, 0, -5);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.85, metalness: 0.05 });
    const frameMesh = new THREE.Mesh(frameGeo, woodMat);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    cabin.add(frameMesh);

    const wallGeo = new THREE.BoxGeometry(9.2, 3.5, 9.2);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.7 });
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.set(0, 1.75, 0);
    walls.castShadow = true;
    walls.receiveShadow = true;
    cabin.add(walls);

    // Widths/positions kept within the A-frame triangle (half-width = 5*(1 - y/9))
    // so the railings sit on the gable, not jutting out past the silhouette.
    cabin.add(this._createBalcony(5.2, 1.0, 0.9, 0, 3.4, 5.0));
    cabin.add(this._createBalcony(3.7, 0.9, 0.8, 0, 5.4, 4.8));
    cabin.add(this._createBalcony(2.0, 0.7, 0.6, 0, 7.0, 4.5));

    // Exposed timber frame on the front gable — the "A" shape (two legs + tie beam).
    this._createAframeTimber();

    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e, emissive: 0xffaa44, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.3,
    });
    this.windowMat = windowMat;
    const mkWin = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), windowMat);
      m.position.set(x, y, 4.65);
      cabin.add(m);
    };
    mkWin(1.8, 1.4, -2, 2.2);
    mkWin(1.8, 1.4, 2, 2.2);
    mkWin(1.5, 1.2, -1.5, 5.5);
    mkWin(1.5, 1.2, 1.5, 5.5);
    mkWin(1.2, 1.0, 0, 7.5);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x4a2515, roughness: 0.7 })
    );
    door.position.set(0, 1.1, 4.65);
    cabin.add(door);

    const doorLight = new THREE.PointLight(0xffcc88, 0.8, 5);
    doorLight.position.set(0, 2.5, 5.5);
    cabin.add(doorLight);

    const snowRoofShape = new THREE.Shape();
    snowRoofShape.moveTo(-5.3, 0.1);
    snowRoofShape.lineTo(0, 9.3);
    snowRoofShape.lineTo(5.3, 0.1);
    snowRoofShape.lineTo(-5.3, 0.1);
    const snowRoofGeo = new THREE.ExtrudeGeometry(snowRoofShape, { depth: 10.4, bevelEnabled: false });
    snowRoofGeo.translate(0, 0, -5.2);
    this.roofSnowMesh = new THREE.Mesh(
      snowRoofGeo,
      new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.9, metalness: 0.0 })
    );
    cabin.add(this.roofSnowMesh);

    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 2.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 })
    );
    chimney.position.set(2, 8, -2);
    cabin.add(chimney);

    this.scene.add(cabin);
  }

  _createBalcony(width, height, depth, x, y, z) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a2d1a, roughness: 0.8 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a2010, roughness: 0.7 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.15, depth), woodMat);
    floor.castShadow = true;
    group.add(floor);

    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, height, 8);
    const numPosts = Math.floor(width / 0.5);
    for (let i = 0; i <= numPosts; i++) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(-width / 2 + (i * width) / numPosts, height / 2, depth / 2);
      group.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.08), postMat);
    rail.position.set(0, height, depth / 2);
    group.add(rail);

    group.position.set(x, y, z);
    return group;
  }

  // ----------------------------------------------------------
  //  A-FRAME TIMBER (the visible "A": two slanted legs + tie beam)
  // ----------------------------------------------------------
  _createAframeTimber() {
    const cabin = this.cabinGroup;
    const z = 5.12; // just proud of the front gable face (front is at z = 5)
    const mat = new THREE.MeshStandardMaterial({ color: 0x6e4326, roughness: 0.7, metalness: 0.04 });

    // Box beam connecting two gable points (a,b) on the front face.
    const beam = (ax, ay, bx, by, thick) => {
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, thick, thick * 0.8), mat);
      m.position.set((ax + bx) / 2, (ay + by) / 2, z);
      m.rotation.z = Math.atan2(dy, dx);
      cabin.add(m);
      return m;
    };

    // The two slanted legs of the "A" (run along the gable edges to the apex).
    beam(-4.7, 0.2, -0.16, 8.6, 0.36);
    beam(4.7, 0.2, 0.16, 8.6, 0.36);
    // The tie beam — the crossbar of the letter "A" (between the two balconies).
    beam(-2.35, 4.75, 2.35, 4.75, 0.46);
    // Short king-post detail from the tie beam up toward the apex.
    beam(0, 4.95, 0, 8.4, 0.26);
  }

  // ----------------------------------------------------------
  //  TREES
  // ----------------------------------------------------------
  _createTrees() {
    const treePositions = [
      [-8, 0, 3], [-10, 0, -2], [-7, 0, -5],
      [8, 0, 2], [10, 0, -3], [7, 0, -6],
      [-12, 0, 0], [12, 0, 1],
    ];
    const n = treePositions.length;
    const layers = [
      { y: 1.5, r: 1.2, h: 1.5 },
      { y: 2.5, r: 0.9, h: 1.3 },
      { y: 3.3, r: 0.6, h: 1.1 },
      { y: 4.0, r: 0.3, h: 0.8 },
    ];

    // One shared material per role. Every tree lerped to the *same* colour and
    // opacity, so the previous per-cone material.clone() (64 of them) bought
    // nothing and cost 64 updates a frame — now it is two.
    this.foliageMat = new THREE.MeshStandardMaterial({ color: C_FOLIAGE_WINTER.clone(), roughness: 0.8 });
    this.treeSnowMat = new THREE.MeshStandardMaterial({
      color: 0xe8eef5, roughness: 0.9, transparent: true,
    });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });

    const m = new THREE.Matrix4();
    const place = (mesh, offsetY) => {
      treePositions.forEach((p, i) => {
        m.makeTranslation(p[0], p[1] + offsetY, p[2]);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
      return mesh;
    };

    // 8 trees x 9 meshes = 72 draw calls, collapsed to 9 instanced ones.
    place(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.25, 1.5, 8), trunkMat, n), 0.75);
    this.treeSnowMeshes = layers.map((l) => {
      place(new THREE.InstancedMesh(new THREE.ConeGeometry(l.r, l.h, 8), this.foliageMat, n), l.y);
      return place(
        new THREE.InstancedMesh(new THREE.ConeGeometry(l.r * 0.7, l.h * 0.3, 8), this.treeSnowMat, n),
        l.y + l.h * 0.35
      );
    });
  }

  // ----------------------------------------------------------
  //  GROUND
  // ----------------------------------------------------------
  _createGround() {
    const groundGeo = new THREE.PlaneGeometry(60, 60, 32, 32);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.3) * 0.3 + Math.cos(y * 0.2) * 0.2);
    }
    groundGeo.computeVertexNormals();
    this.groundMesh = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.95 })
    );
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.1;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 12),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, 10);
    this.scene.add(path);
  }

  // ----------------------------------------------------------
  //  SNOW PARTICLES
  // ----------------------------------------------------------
  _createSnowParticles() {
    const count = SNOW_MAX;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      velocities[i] = 0.5 + Math.random() * 1.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.userData = { velocities };
    // Allocated at full size once; the tier (and any runtime downgrade) just
    // narrows the draw range, so changing quality never reallocates a buffer.
    // Falling snow is pure decoration, so reduced motion gets none of it.
    this.snowCount = this.reducedMotion ? 0 : this.tier.snow;
    geo.setDrawRange(0, this.snowCount);
    this.snowParticles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.8, depthWrite: false })
    );
    this.scene.add(this.snowParticles);
  }

  // ----------------------------------------------------------
  //  STAR PARTICLES
  // ----------------------------------------------------------
  _createStarParticles() {
    const count = STAR_MAX;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const r = 60 + Math.random() * 10;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, this.tier.stars);
    this.starParticles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.6, depthWrite: false })
    );
    this.scene.add(this.starParticles);
  }

  // ----------------------------------------------------------
  //  STRING LIGHTS (lampice)
  // ----------------------------------------------------------
  _haloTexture() {
    if (this._halo) return this._halo;
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0.0, 'rgba(255,240,200,1)');
    g.addColorStop(0.25, 'rgba(255,200,110,0.55)');
    g.addColorStop(1.0, 'rgba(255,170,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    this._halo = new THREE.CanvasTexture(c);
    return this._halo;
  }

  _createStringLights() {
    // Sized to sit just above each (now narrower) balcony, within the silhouette.
    const lightPositions = [
      { y: 4.4, z: 5.5, width: 5.0, count: 10 },
      { y: 6.3, z: 5.3, width: 3.5, count: 8 },
      { y: 7.8, z: 5.0, width: 1.9, count: 5 },
    ];
    const haloTex = this._haloTexture();

    lightPositions.forEach((lp) => {
      for (let i = 0; i < lp.count; i++) {
        const x = -lp.width / 2 + (i * lp.width) / (lp.count - 1);
        const sag = Math.sin((i / (lp.count - 1)) * Math.PI) * 0.28;
        // Per-bulb warmth variance for a more natural string.
        const warm = 0.5 + Math.random() * 0.5;
        const bulbColor = new THREE.Color().setHSL(0.1 - warm * 0.03, 0.95, 0.6);

        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshStandardMaterial({
            color: bulbColor,
            emissive: bulbColor,
            emissiveIntensity: 2.0,
            roughness: 0.25,
          })
        );
        bulb.position.set(x, lp.y - sag, lp.z);

        // Soft additive glow halo — the part that reads as a real bulb's bloom.
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: haloTex,
            color: bulbColor,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        halo.scale.setScalar(0.55);
        halo.position.copy(bulb.position);
        bulb.userData.halo = halo;
        bulb.userData.phase = Math.random() * Math.PI * 2;
        bulb.userData.baseColor = bulbColor;

        // A few real point lights spill warm light onto the wood. Each one is a
        // dynamic light every lit material must evaluate, so the low tier thins them.
        if (i % this.tier.lightEvery === 0) {
          const pl = new THREE.PointLight(0xffb060, 0.35, 3.5);
          pl.position.copy(bulb.position);
          this.cabinGroup.add(pl);
          bulb.userData.pointLight = pl;
        }

        this.cabinGroup.add(halo);
        this.cabinGroup.add(bulb);
        this.lights.push(bulb);
      }

      // Drooping wire.
      const wirePoints = [];
      for (let i = 0; i <= 20; i++) {
        const x = -lp.width / 2 + (i * lp.width) / 20;
        const sag = Math.sin((i / 20) * Math.PI) * 0.28;
        wirePoints.push(new THREE.Vector3(x, lp.y - sag, lp.z));
      }
      const wire = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(wirePoints),
        new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.5 })
      );
      this.cabinGroup.add(wire);
    });
  }

  // ----------------------------------------------------------
  //  EVENTS
  // ----------------------------------------------------------
  /**
   * Recompute whether the pointer is over the cabin. Called once at startup and
   * then only on pointer movement.
   *
   * The startup call matters: `this.mouse` defaults to (0,0), which in NDC is the
   * centre of the screen — and that ray hits the cabin. The old every-frame
   * raycast therefore had the lights at full glow from load, and on touch devices
   * (no mousemove ever) permanently so. Seeding it here keeps that look.
   */
  _updateHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.targetHoverIntensity =
      this.raycaster.intersectObject(this.cabinGroup, true).length > 0 ? 1 : 0;
    this._dirty = true;
  }

  _bindEvents() {
    this._updateHover();

    this._onScroll = () => {
      const heroHeight = this._size().h;
      this.targetScrollProgress = Math.min(window.scrollY / heroHeight, 1);
      this._dirty = true;
    };
    this._onMove = (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      this.mouse.set(this.mouseX, this.mouseY);
      // Hover testing belongs here, not in the render loop: it only changes when
      // the pointer moves. Running a full scene raycast every frame was wasted
      // work, and on a touch device (no mousemove at all) it now never runs.
      this._updateHover();
    };
    this._onResize = () => {
      const { w, h } = this._size();
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this._dirty = true;
    };
    // A hidden tab kept rendering the full scene, burning battery for nothing.
    this._onVisibility = () => {
      this._paused = document.hidden;
      if (!this._paused) {
        this.clock.getDelta(); // drop the elapsed background time so snow doesn't jump
        this._dirty = true;
      }
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('mousemove', this._onMove, { passive: true });
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  /** Switch quality at runtime. Buffers are never reallocated — only narrowed. */
  _applyTier(name) {
    if (this.tierName === name || !TIERS[name]) return;
    this.tierName = name;
    this.tier = TIERS[name];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.tier.dpr));
    this.renderer.shadowMap.enabled = this.tier.shadows;
    this.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    if (!this.reducedMotion) {
      this.snowCount = this.tier.snow;
      this.snowParticles.geometry.setDrawRange(0, this.snowCount);
    }
    this.starParticles.geometry.setDrawRange(0, this.tier.stars);
    this._dirty = true;
    // The sky's octave count is compiled into the shader and is deliberately not
    // changed here — recompiling mid-scroll stutters, and phones already start
    // on the low tier where it matters.
  }

  // ----------------------------------------------------------
  //  ANIMATION LOOP
  // ----------------------------------------------------------
  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());

    // Nothing worth drawing: tab in the background, or the hero scrolled behind
    // the content sections. Drain the clock either way so time doesn't pile up.
    if (this._paused || window.scrollY > this._size().h * 1.15) {
      this.clock.getDelta();
      return;
    }

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();
    // `still` = honour prefers-reduced-motion. The winter/summer scroll
    // transition is the content itself so it stays, but every ambient
    // animation (falling snow, flicker, float, parallax, drifting sky) stops,
    // and the scene renders on demand rather than continuously.
    const still = this.reducedMotion;

    if (still) {
      const settled =
        Math.abs(this.targetScrollProgress - this.scrollProgress) < 0.0005 &&
        Math.abs(this.targetHoverIntensity - this.hoverIntensity) < 0.0005;
      if (settled && !this._dirty) return;
      this.scrollProgress = this.targetScrollProgress;
      this.hoverIntensity = this.targetHoverIntensity;
      this._dirty = false;
    } else {
      this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.05;
      this.hoverIntensity += (this.targetHoverIntensity - this.hoverIntensity) * 0.08;
    }

    // Sky.
    this.skyMesh.material.uniforms.uProgress.value = this.scrollProgress;
    if (!still) this.skyMesh.material.uniforms.uTime.value = elapsed;

    // Ground color.
    this.groundMesh.material.color.lerpColors(C_GROUND_WINTER, C_GROUND_SUMMER, this.scrollProgress);

    // Roof snow.
    this.roofSnowMesh.material.opacity = 1 - this.scrollProgress;
    this.roofSnowMesh.material.transparent = true;
    this.roofSnowMesh.visible = this.scrollProgress < 0.95;

    // Trees: melt snow + green up. Shared materials, so this is two updates
    // rather than the 64 the per-cone clones used to need.
    this.foliageMat.color.lerpColors(C_FOLIAGE_WINTER, C_FOLIAGE_SUMMER, this.scrollProgress);
    this.treeSnowMat.opacity = 1 - this.scrollProgress;
    const snowVisible = this.scrollProgress < 0.95;
    for (const mesh of this.treeSnowMeshes) mesh.visible = snowVisible;

    // String lights — realistic per-bulb flicker + dramatic hover burst (→ 3.0).
    const baseIntensity = 0.5 + this.hoverIntensity * 2.5;
    const dim = 1 - this.scrollProgress * 0.8;
    for (const bulb of this.lights) {
      const ph = bulb.userData.phase;
      // Two incommensurate sines + an occasional candle-like dip = organic flicker.
      // Held at the flicker function's mean (0.82 * 0.94) when motion is reduced,
      // so a steady bulb matches the average animated frame rather than its peak.
      let flicker = 0.771;
      if (!still) {
        flicker = 0.82 + 0.1 * Math.sin(elapsed * 3.0 + ph) + 0.08 * Math.sin(elapsed * 7.3 + ph * 1.7);
        flicker *= 0.94 + 0.06 * Math.sin(elapsed * 0.7 + ph * 3.1);
      }
      bulb.material.emissiveIntensity = baseIntensity * flicker * dim;
      if (bulb.userData.halo) {
        const m = bulb.userData.halo.material;
        m.opacity = (0.3 + this.hoverIntensity * 0.6) * flicker * dim;
        bulb.userData.halo.scale.setScalar((0.5 + this.hoverIntensity * 0.45) * (0.95 + 0.1 * flicker));
      }
      if (bulb.userData.pointLight) {
        bulb.userData.pointLight.intensity = (0.3 + this.hoverIntensity * 1.0) * flicker * dim;
      }
    }
    // Windows pick up the hover glow too.
    if (this.windowMat) {
      this.windowMat.emissiveIntensity = 0.3 + this.hoverIntensity * 0.9;
    }

    // Ambient / directional / interior lighting.
    this.ambientLight.color.lerpColors(C_AMBIENT_WINTER, C_AMBIENT_SUMMER, this.scrollProgress);
    this.ambientLight.intensity = 0.4 + this.scrollProgress * 0.6;
    this.dirLight.color.lerpColors(C_DIR_WINTER, C_DIR_SUMMER, this.scrollProgress);
    this.dirLight.intensity = 0.6 + this.scrollProgress * 1.2;
    this.interiorLight.intensity = 1.5 * (1 - this.scrollProgress * 0.5);

    // Snow particles — only the active draw range is simulated.
    if (this.snowParticles && this.snowCount > 0) {
      this.snowParticles.material.opacity = 0.8 * (1 - this.scrollProgress);
      const positions = this.snowParticles.geometry.attributes.position.array;
      const velocities = this.snowParticles.geometry.userData.velocities;
      for (let i = 0; i < this.snowCount; i++) {
        positions[i * 3 + 1] -= velocities[i] * delta;
        positions[i * 3] += Math.sin(elapsed + i) * 0.01;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 15 + Math.random() * 5;
          positions[i * 3] = (Math.random() - 0.5) * 40;
        }
      }
      this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }
    if (this.starParticles) {
      this.starParticles.material.opacity = 0.6 * (1 - this.scrollProgress);
    }

    if (!still) {
      // Cabin gentle float / breathe.
      this.cabinGroup.position.y = Math.sin(elapsed * 0.6) * 0.05;

      // Camera subtle parallax.
      this.camera.position.x += (this.mouseX * 1.5 - this.camera.position.x) * 0.02;
      this.camera.position.y += (4 + this.mouseY * 0.5 - this.camera.position.y) * 0.02;
      this.camera.lookAt(0, 3, 0);
    }

    this.renderer.toneMappingExposure = 1.0 + this.scrollProgress * 0.5;
    this.renderer.render(this.scene, this.camera);

    // Adaptive downgrade: device hints are a guess, so measure the opening
    // seconds and drop a tier if this machine can't actually hold ~50fps.
    if (this.tierName === 'high' && !still) {
      if (this._frames === 0) this._sampleStart = performance.now();
      if (++this._frames === 90) {
        const fps = 90000 / (performance.now() - this._sampleStart);
        if (fps < 50) this._applyTier('low');
      }
    }
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
