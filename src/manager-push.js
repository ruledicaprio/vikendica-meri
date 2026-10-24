// "Obavještenja" card in the manager: lets this phone receive a push
// notification whenever a guest sends a request (worker/push.js sends them,
// public/manager/sw.js shows them).
//
// States, in the order they are checked:
//   iPhone outside the home-screen app → how to add it (Safari has no push there)
//   no push support at all             → say so
//   server not configured yet          → say so (owner's job, see DEPLOY.md)
//   blocked in phone settings          → say where to allow it
//   not on yet                         → one big button
//   on                                 → test button and a way to turn it off
const box = document.getElementById('push');

const api = async (path, body) => {
  const res = await fetch(`/api/admin/push/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Greška ${res.status}`), { code: data.error });
  return data;
};

const b64uToBytes = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function show(html, tone = '') {
  box.className = `mgr-push${tone ? ` is-${tone}` : ''}`;
  box.innerHTML = html;
  box.hidden = false;
}

const note = (text) => `<p class="mgr-push__note" role="status">${text}</p>`;

async function render(msg = '') {
  if (isIos && !standalone) {
    show(`<p class="mgr-push__title">🔔 Obavještenja na iPhoneu</p>
      <p class="mgr-push__text">Da bi vam telefon javio za svaki novi upit, Manager mora biti na početnom ekranu:</p>
      <ol class="mgr-push__steps">
        <li>Dodirnite <strong>Dijeli</strong> <span aria-hidden="true">⬆︎</span> na dnu ekrana</li>
        <li>Odaberite <strong>Dodaj na početni ekran</strong></li>
        <li>Otvorite <strong>Manager</strong> s početnog ekrana i ovdje uključite obavještenja</li>
      </ol>`);
    return;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    show('<p class="mgr-push__text">Ovaj preglednik ne podržava obavještenja.</p>');
    return;
  }

  let key;
  try {
    ({ key } = await api('key'));
  } catch (err) {
    // Not set up on the server yet: nothing the phone owner can do about it.
    if (err.code === 'push_not_configured') box.hidden = true;
    else show(note(`Obavještenja trenutno nisu dostupna (${err.message}).`));
    return;
  }

  box.dataset.key = key;
  const reg = await navigator.serviceWorker.register('/manager/sw.js', { scope: '/manager/' });
  const sub = await reg.pushManager.getSubscription();

  if (Notification.permission === 'denied') {
    show(`<p class="mgr-push__title">🔕 Obavještenja su blokirana</p>
      <p class="mgr-push__text">Dozvolite ih u postavkama telefona: Postavke → Obavještenja → ${standalone ? 'Manager' : 'preglednik'}.</p>`);
    return;
  }

  if (!sub) {
    show(`<p class="mgr-push__title">🔔 Javi mi za nove upite</p>
      <p class="mgr-push__text">Telefon će vas obavijestiti čim gost pošalje upit.</p>
      <button class="mgr-btn mgr-push__on" type="button" data-push="on">🔔 Uključi obavještenja</button>
      ${msg}`, 'off');
    return;
  }

  // Keep the server's copy current (keys can rotate); cheap and idempotent.
  api('subscribe', sub.toJSON()).catch(() => {});
  show(`<p class="mgr-push__title">🔔 Obavještenja su uključena</p>
    <p class="mgr-push__text">Ovaj telefon javlja svaki novi upit.</p>
    <div class="mgr-push__actions">
      <button class="mgr-btn" type="button" data-push="test">Pošalji probnu</button>
      <button class="mgr-btn mgr-btn--ghost" type="button" data-push="off">Isključi</button>
    </div>
    ${msg}`, 'on');
}

box.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-push]')?.dataset.push;
  if (!act) return;
  e.target.disabled = true;
  try {
    if (act === 'on') {
      // The permission prompt first, straight from the tap: iOS refuses it once
      // anything else has been awaited. The key is already on the page.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return render();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64uToBytes(box.dataset.key),
      });
      await api('subscribe', sub.toJSON());
      return render(note('Uključeno. Pošaljite probnu da provjerite.'));
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return render();
    if (act === 'test') {
      await api('test', sub.toJSON());
      return render(note('Probna poslana — trebala bi stići za par sekundi.'));
    }
    if (act === 'off') {
      await api('unsubscribe', sub.toJSON()).catch(() => {});
      await sub.unsubscribe();
      return render(note('Isključeno na ovom telefonu.'));
    }
  } catch (err) {
    render(note(`Nije uspjelo: ${err.message}`));
  }
});

render();
