import { getSocket } from '../lib/socket.js';

export function mountReconnectOverlay(): void {
  const el = document.createElement('div');
  el.id = 'reconnect-overlay';
  el.style.cssText = `
    position: fixed; inset: 0; z-index: 100;
    display: none; align-items: center; justify-content: center;
    background: rgba(15,15,20,0.92); color: white; font-family: Inter, sans-serif;
  `;
  el.innerHTML = `
    <div class="text-center px-8">
      <div class="text-3xl font-bold mb-4">Reconnecting…</div>
      <div id="reconnect-detail" class="text-lg opacity-70">Attempting to restore the connection.</div>
    </div>
  `;
  document.body.appendChild(el);

  const s = getSocket();
  let attempts = 0;
  const show = (msg?: string): void => {
    el.style.display = 'flex';
    const d = document.getElementById('reconnect-detail');
    if (d && msg) d.textContent = msg;
  };
  const hide = (): void => { el.style.display = 'none'; };

  s.on('disconnect', () => show('Attempting to restore the connection.'));
  s.io.on('reconnect_attempt', () => {
    attempts++;
    show(`Reconnect attempt ${attempts}…`);
  });
  s.io.on('reconnect', () => {
    attempts = 0;
    hide();
  });
  s.io.on('reconnect_failed', () => {
    show('Could not reconnect. Refresh the page to try again.');
  });
  s.on('connect', () => hide());
}
