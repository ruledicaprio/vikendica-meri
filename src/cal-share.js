/**
 * Full-screen month view that doubles as a shareable image.
 * ─────────────────────────────────────────────────────────────
 * The month is drawn straight onto a 1080×1350 canvas (Facebook/Instagram
 * portrait), so what the owner sees full screen is exactly the PNG that gets
 * shared. Loaded on demand from calendar.js — it costs the page nothing until
 * the button is pressed.
 */
import { t } from './i18n/ui.js';
import { dayStatus, toYMD } from './calendar.js';

const W = 1080;
const H = 1350;
// Status colours as [fill, stroke, mark], one set per background brightness.
const ON_DARK = {
  available: ['rgba(90, 170, 110, 0.22)', 'rgba(90, 170, 110, 0.55)', '#6fd08a'],
  booked: ['rgba(186, 62, 62, 0.38)', 'rgba(186, 62, 62, 0.75)', '#ff6b6b'],
  pending: ['rgba(212, 148, 58, 0.32)', 'rgba(212, 148, 58, 0.7)', '#f0b25a'],
};
const ON_LIGHT = {
  available: ['rgba(60, 150, 85, 0.14)', 'rgba(60, 150, 85, 0.6)', '#2e8b4a'],
  booked: ['rgba(200, 55, 55, 0.13)', 'rgba(200, 55, 55, 0.6)', '#c53030'],
  pending: ['rgba(200, 120, 20, 0.16)', 'rgba(200, 120, 20, 0.65)', '#b06a0c'],
};

/* ── season presets: winter, spring, summer, autumn (t.seasons order) ── */
function snowflake(ctx, s) {
  ctx.lineWidth = s * 0.1;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s);
    ctx.moveTo(-s * 0.28, -s * 0.78);
    ctx.lineTo(0, -s * 0.5);
    ctx.lineTo(s * 0.28, -s * 0.78);
    ctx.stroke();
  }
}
function blossom(ctx, s) {
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.5, s * 0.32, s * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
}
function sun(ctx, s) {
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = s * 0.12;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.62);
    ctx.lineTo(0, -s);
    ctx.stroke();
  }
}
function leaf(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.8, 0, 0, s * 0.8);
  ctx.quadraticCurveTo(-s * 0.8, 0, 0, -s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.7);
  ctx.lineTo(0, s * 1.15);
  ctx.stroke();
}

const SEASONS = [
  { bg: ['#1d3b5e', '#0c1a2c'], ink: '#f4f8fc', muted: 'rgba(244, 248, 252, 0.68)', faint: 'rgba(244, 248, 252, 0.28)',
    line: 'rgba(244, 248, 252, 0.16)', accent: '#a8d8ff', status: ON_DARK, motif: snowflake, motifColor: 'rgba(214, 236, 255, 0.75)' },
  { bg: ['#f5f9f0', '#d9eacb'], ink: '#1f3320', muted: 'rgba(31, 51, 32, 0.66)', faint: 'rgba(31, 51, 32, 0.3)',
    line: 'rgba(31, 51, 32, 0.16)', accent: '#4a8a36', status: ON_LIGHT, motif: blossom, motifColor: '#f3a6c4' },
  { bg: ['#fff8e6', '#ffe0a3'], ink: '#3a2a12', muted: 'rgba(58, 42, 18, 0.66)', faint: 'rgba(58, 42, 18, 0.3)',
    line: 'rgba(58, 42, 18, 0.16)', accent: '#d26f12', status: ON_LIGHT, motif: sun, motifColor: '#f5b52e' },
  { bg: ['#4a2716', '#1f120a'], ink: '#fbefe2', muted: 'rgba(251, 239, 226, 0.68)', faint: 'rgba(251, 239, 226, 0.28)',
    line: 'rgba(251, 239, 226, 0.16)', accent: '#f0a04b', status: ON_DARK, motif: leaf, motifColor: '#d9692c' },
];
/** Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn. */
const seasonOf = (month) => Math.floor(((month + 1) % 12) / 3);
// Motifs sit in the header's side margins: [x, y, size, rotation].
const MOTIFS = [
  [78, 82, 34, 0.2], [148, 196, 20, -0.5], [72, 312, 26, 0.7],
  [1002, 82, 34, -0.3], [932, 196, 20, 0.6], [1008, 312, 26, 0.1],
];

const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Marks are stroked paths, not glyphs: ✓/✗ differ per platform font and some
// phones would render them as emoji.
function mark(ctx, kind, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'available') {
    ctx.moveTo(cx - s * 0.5, cy);
    ctx.lineTo(cx - s * 0.12, cy + s * 0.4);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.42);
    ctx.stroke();
  } else if (kind === 'booked') {
    ctx.moveTo(cx - s * 0.4, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.4);
    ctx.moveTo(cx + s * 0.4, cy - s * 0.4);
    ctx.lineTo(cx - s * 0.4, cy + s * 0.4);
    ctx.stroke();
  } else {
    for (const dx of [-0.42, 0, 0.42]) {
      ctx.moveTo(cx + dx * s + s * 0.11, cy);
      ctx.arc(cx + dx * s, cy, s * 0.11, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

function draw(canvas, year, month, S) {
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, S.bg[0]);
  grad.addColorStop(1, S.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, size, rot] of MOTIFS) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = ctx.strokeStyle = S.motifColor;
    ctx.lineCap = 'round';
    S.motif(ctx, size);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ── header ──
  ctx.fillStyle = S.accent;
  ctx.font = `italic 500 64px ${SERIF}`;
  ctx.fillText('Vikendica Meri', W / 2, 112);
  ctx.fillStyle = S.muted;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText('Babanovac · Vlašić', W / 2, 160);

  ctx.fillStyle = S.ink;
  ctx.font = `700 112px ${SERIF}`;
  ctx.fillText(t.months[month].toUpperCase(), W / 2, 290);
  ctx.fillStyle = S.accent;
  ctx.font = `600 38px ${SANS}`;
  ctx.fillText(`${t.calShareSubtitle} · ${year}`, W / 2, 348);

  // ── grid ──
  const x0 = 54;
  const gap = 10;
  const cw = (W - 2 * x0 - 6 * gap) / 7;
  const ch = 124;
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  // Laid out for six rows; a shorter month is centred so the space it does not
  // use is split above and below instead of left as one band over the legend.
  const rows = Math.ceil((firstDow + days) / 7);
  const top = 440 + ((6 - rows) * (ch + gap)) / 2;
  const bottom = top + rows * (ch + gap) - gap;
  ctx.fillStyle = S.muted;
  ctx.font = `600 28px ${SANS}`;
  t.days.forEach((d, i) => ctx.fillText(d.toUpperCase(), x0 + i * (cw + gap) + cw / 2, top - 22));

  const seen = new Set();
  for (let d = 1; d <= days; d++) {
    const idx = firstDow + d - 1;
    const x = x0 + (idx % 7) * (cw + gap);
    const y = top + Math.floor(idx / 7) * (ch + gap);
    const status = dayStatus(toYMD(year, month, d));
    seen.add(status);

    if (status === 'past') {
      roundRect(ctx, x, y, cw, ch, 14);
      ctx.strokeStyle = S.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const [fill, stroke, ink] = S.status[status];
      roundRect(ctx, x, y, cw, ch, 14);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      mark(ctx, status, x + cw * 0.62, y + ch * 0.6, 26, ink);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = status === 'past' ? S.faint : S.ink;
    ctx.font = `600 32px ${SANS}`;
    ctx.fillText(String(d), x + 14, y + 42);
    ctx.textAlign = 'center';
  }

  // ── legend: only the states that actually occur this month ──
  const items = ['available', 'booked', 'pending'].filter((s) => seen.has(s));
  const label = { available: t.calLegendAvailable, booked: t.calLegendBooked, pending: t.calLegendPending };
  ctx.font = `600 32px ${SANS}`;
  const widths = items.map((s) => 56 + ctx.measureText(label[s].toUpperCase()).width);
  const sep = 56;
  let lx = (W - widths.reduce((a, b) => a + b, 0) - sep * (items.length - 1)) / 2;
  ctx.textAlign = 'left';
  items.forEach((s, i) => {
    mark(ctx, s, lx + 18, bottom + 34, 22, S.status[s][2]);
    ctx.fillStyle = S.ink;
    ctx.fillText(label[s].toUpperCase(), lx + 52, bottom + 45);
    lx += widths[i] + sep;
  });

}

let dialog = null;

export async function openCalShare(year, month) {
  // Canvas text does not wait for web fonts; without this the first image can
  // come out in Georgia/system-ui.
  await Promise.all([
    document.fonts.load(`700 112px ${SERIF}`),
    document.fonts.load(`italic 500 64px ${SERIF}`),
    document.fonts.load(`600 32px ${SANS}`),
  ]).catch(() => {});

  const now = new Date();
  const minKey = now.getFullYear() * 12 + now.getMonth();
  let key = Math.max(minKey, year * 12 + month);
  // null = follow the shown month's season; a tapped preset sticks until closed.
  let season = null;

  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'cal-share';
    dialog.innerHTML = `
      <canvas class="cal-share__canvas" width="${W}" height="${H}" role="img"></canvas>
      <div class="cal-share__seasons" role="group" aria-label="${t.calSeason}">
        ${t.seasons
          .map((name, i) => `<button class="cal-share__season" type="button" data-season="${i}">${['❄️', '🌸', '☀️', '🍂'][i]} ${name}</button>`)
          .join('')}
      </div>
      <div class="cal-share__bar">
        <button class="cal__nav-btn" type="button" data-step="-1" aria-label="${t.calPrev}">&#8249;</button>
        <button class="btn btn--primary cal-share__share" type="button">${t.calShare}</button>
        <button class="cal__nav-btn" type="button" data-step="1" aria-label="${t.calNext}">&#8250;</button>
      </div>
      <button class="cal-share__close" type="button" aria-label="${t.close}">×</button>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => (document.body.style.overflow = ''));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.querySelector('.cal-share__close').addEventListener('click', () => dialog.close());
  }

  const canvas = dialog.querySelector('canvas');
  const prev = dialog.querySelector('[data-step="-1"]');
  const encode = (k) =>
    new Promise((r) =>
      canvas.toBlob((blob) => {
        const name = `vikendica-meri-${t.months[k % 12].toLowerCase()}-${Math.floor(k / 12)}.png`;
        r(new File([blob], name, { type: 'image/png' }));
      }, 'image/png'),
    );
  // The PNG is encoded as soon as the month is drawn, not on the tap: Safari
  // opens the share sheet only straight from a gesture, and awaiting toBlob in
  // the click handler can use that gesture up.
  let file = null;
  const render = () => {
    const y = Math.floor(key / 12);
    const m = key % 12;
    const si = season ?? seasonOf(m);
    draw(canvas, y, m, SEASONS[si]);
    dialog.querySelectorAll('[data-season]').forEach((b) => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.season) === si));
    });
    canvas.setAttribute('aria-label', `${t.months[m]} ${y} — ${t.calShareSubtitle}`);
    prev.disabled = key <= minKey;
    const k = key;
    file = null;
    encode(k).then((f) => {
      if (k === key) file = f;
    });
  };
  dialog.querySelectorAll('[data-step]').forEach((b) => {
    b.onclick = () => {
      key += Number(b.dataset.step);
      render();
    };
  });
  dialog.querySelectorAll('[data-season]').forEach((b) => {
    b.onclick = () => {
      season = Number(b.dataset.season);
      render();
    };
  });
  dialog.querySelector('.cal-share__share').onclick = async () => {
    const f = file ?? (await encode(key));
    // Phones: the system share sheet (Facebook, Viber, WhatsApp…). Desktop
    // browsers mostly cannot share files, so the image is downloaded instead,
    // as it is when the share sheet refuses for any reason but a cancel.
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f] });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  render();
  document.body.style.overflow = 'hidden';
  dialog.showModal();
}
