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
const C = {
  bg: '#0a0e1a',
  bg2: '#0e1426',
  cream: '#f5f0e8',
  muted: 'rgba(245, 240, 232, 0.66)',
  amber: '#e5a84d',
  line: 'rgba(245, 240, 232, 0.14)',
  available: ['rgba(90, 170, 110, 0.22)', 'rgba(90, 170, 110, 0.55)', '#6fd08a'],
  booked: ['rgba(186, 62, 62, 0.38)', 'rgba(186, 62, 62, 0.75)', '#ff6b6b'],
  pending: ['rgba(212, 148, 58, 0.32)', 'rgba(212, 148, 58, 0.7)', '#f0b25a'],
};
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

function draw(canvas, year, month) {
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.bg2);
  grad.addColorStop(1, C.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ── header ──
  ctx.fillStyle = C.amber;
  ctx.font = `italic 500 64px ${SERIF}`;
  ctx.fillText('Vikendica Meri', W / 2, 112);
  ctx.fillStyle = C.muted;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText('Babanovac · Vlašić', W / 2, 160);

  ctx.fillStyle = C.cream;
  ctx.font = `700 112px ${SERIF}`;
  ctx.fillText(t.months[month].toUpperCase(), W / 2, 290);
  ctx.fillStyle = C.amber;
  ctx.font = `600 38px ${SANS}`;
  ctx.fillText(`${t.calShareSubtitle} · ${year}`, W / 2, 348);

  // ── grid ──
  const x0 = 54;
  const gap = 10;
  const cw = (W - 2 * x0 - 6 * gap) / 7;
  const ch = 112;
  ctx.fillStyle = C.muted;
  ctx.font = `600 28px ${SANS}`;
  t.days.forEach((d, i) => ctx.fillText(d.toUpperCase(), x0 + i * (cw + gap) + cw / 2, 418));

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const seen = new Set();
  for (let d = 1; d <= days; d++) {
    const idx = firstDow + d - 1;
    const x = x0 + (idx % 7) * (cw + gap);
    const y = 440 + Math.floor(idx / 7) * (ch + gap);
    const status = dayStatus(toYMD(year, month, d));
    seen.add(status);

    if (status === 'past') {
      roundRect(ctx, x, y, cw, ch, 14);
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const [fill, stroke, ink] = C[status];
      roundRect(ctx, x, y, cw, ch, 14);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      mark(ctx, status, x + cw * 0.62, y + ch * 0.6, 26, ink);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = status === 'past' ? 'rgba(245, 240, 232, 0.28)' : C.cream;
    ctx.font = `700 32px ${SANS}`;
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
    mark(ctx, s, lx + 18, 1196, 22, C[s][2]);
    ctx.fillStyle = C.cream;
    ctx.fillText(label[s].toUpperCase(), lx + 52, 1207);
    lx += widths[i] + sep;
  });

  // ── footer ──
  ctx.textAlign = 'center';
  ctx.strokeStyle = C.amber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 1250);
  ctx.lineTo(W - 140, 1250);
  ctx.stroke();
  ctx.fillStyle = C.cream;
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText(`${t.calShareContact}  +387 61 833 834`, W / 2, 1300);
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  if (canonical) {
    ctx.fillStyle = C.muted;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(new URL(canonical).host, W / 2, 1338);
  }
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

  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'cal-share';
    dialog.innerHTML = `
      <canvas class="cal-share__canvas" width="${W}" height="${H}" role="img"></canvas>
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
  const render = () => {
    const y = Math.floor(key / 12);
    const m = key % 12;
    draw(canvas, y, m);
    canvas.setAttribute('aria-label', `${t.months[m]} ${y} — ${t.calShareSubtitle}`);
    prev.disabled = key <= minKey;
  };
  dialog.querySelectorAll('[data-step]').forEach((b) => {
    b.onclick = () => {
      key += Number(b.dataset.step);
      render();
    };
  });
  dialog.querySelector('.cal-share__share').onclick = async () => {
    const name = `vikendica-meri-${t.months[key % 12].toLowerCase()}-${Math.floor(key / 12)}.png`;
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], name, { type: 'image/png' });
    // Phones: the system share sheet (Facebook, Viber, WhatsApp…). Desktop
    // browsers mostly cannot share files, so the image is downloaded instead.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        /* cancelled from the share sheet */
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  render();
  document.body.style.overflow = 'hidden';
  dialog.showModal();
}
