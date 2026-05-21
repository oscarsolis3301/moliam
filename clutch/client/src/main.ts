import './styles/main.css';
import { Router } from './lib/router.js';
import { renderHome } from './views/home.js';
import { renderPlayer } from './views/player.js';
import { renderHostConsole } from './views/host.js';
import { renderResults } from './views/results.js';
import { renderEditQuiz } from './views/edit.js';
import { renderAuditDashboard, renderAuditSession } from './views/audit.js';
import { mountReconnectOverlay } from './components/reconnect.js';

const app = document.getElementById('app')!;
const router = new Router();

router
  .add(/^\/$/, () => renderHome(app, router))
  // The /host URL deep-links into Host mode. The handler runs the admin
  // check and PIN gate, then mounts the quiz dashboard. /host/<uuid> below
  // is the live host console for a specific session — distinct because the
  // pattern requires a UUID after the slash.
  .add(/^\/host\/?$/, () => renderHome(app, router, 'host'))
  .add(/^\/play\/?$/, () => renderPlayer(app, router, null))
  // Accept lower-case, mixed-case, and trailing-slash variants of the code URL
  // so QR scanners that re-normalize the link still land on the player flow
  // instead of the 404 page.
  .add(/^\/play\/([A-Za-z0-9]{6})\/?$/, (m) => renderPlayer(app, router, (m[1] ?? '').toUpperCase()))
  .add(/^\/host\/([0-9a-f-]{36})$/, (m) => renderHostConsole(app, router, m[1] ?? ''))
  .add(/^\/quiz\/([0-9a-f-]{36})$/, (m) => renderEditQuiz(app, router, m[1] ?? ''))
  .add(/^\/results\/([0-9a-f-]{36})$/, (m) => renderResults(app, router, m[1] ?? ''))
  .add(/^\/audit\/?$/, () => renderAuditDashboard(app, router))
  .add(/^\/audit\/([0-9a-f-]{36})$/, (m) => renderAuditSession(app, router, m[1] ?? ''))
  .setNotFound(() => {
    app.innerHTML = `
      <div class="h-full flex items-center justify-center p-8 text-center">
        <div>
          <div class="text-6xl font-elegant italic mb-4">404</div>
          <a href="/" data-link class="text-clutch-blue underline">Back to Clutch</a>
        </div>
      </div>`;
  });

mountReconnectOverlay();
router.start();

// Dismiss the pre-JS boot indicator as soon as the router has mounted a view.
// The fade-out is handled by the CSS class in index.html.
const boot = document.getElementById('boot');
if (boot) {
  boot.classList.add('boot-hide');
  window.setTimeout(() => boot.remove(), 350);
}
