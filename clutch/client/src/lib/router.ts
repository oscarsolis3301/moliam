export interface Route {
  pattern: RegExp;
  render: (m: RegExpMatchArray) => void | Promise<void>;
}

// The Clutch client may be served under a sub-path (e.g. /clutch-app/ in the
// FastAPI harness) or at the host root in standalone mode. Vite sets
// import.meta.env.BASE_URL from the build-time `base` config, so the same
// source works in both modes — BASE is empty when mounted at root.
const RAW_BASE = (import.meta.env?.BASE_URL ?? '/') as string;
export const BASE = RAW_BASE === '/' ? '' : RAW_BASE.replace(/\/$/, '');

function stripBase(path: string): string {
  if (!BASE) return path || '/';
  if (path === BASE) return '/';
  if (path.startsWith(BASE + '/')) return path.slice(BASE.length) || '/';
  return path || '/';
}

function withBase(path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  if (!BASE) return path;
  if (path === '/') return BASE + '/';
  return BASE + path;
}

export class Router {
  private routes: Route[] = [];
  private notFound: () => void = () => {};

  add(pattern: RegExp, render: Route['render']): this {
    this.routes.push({ pattern, render });
    return this;
  }
  setNotFound(fn: () => void): this {
    this.notFound = fn;
    return this;
  }

  start(): void {
    window.addEventListener('popstate', () => this.dispatch());
    // Intercept clicks on internal links. `data-link` anchors use app-relative
    // paths like href="/" or href="/results/:id"; we translate them into
    // /clutch-app/... so the browser never navigates off the sub-app.
    document.body.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement)?.closest?.('a[data-link]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http')) return;
      e.preventDefault();
      this.navigate(href);
    });
    this.dispatch();
  }

  navigate(path: string): void {
    const target = withBase(path);
    if (window.location.pathname + window.location.search === target) return;
    window.history.pushState({}, '', target);
    this.dispatch();
  }

  replace(path: string): void {
    window.history.replaceState({}, '', withBase(path));
    this.dispatch();
  }

  private dispatch(): void {
    const path = stripBase(window.location.pathname);
    for (const r of this.routes) {
      const m = path.match(r.pattern);
      if (m) {
        void r.render(m);
        return;
      }
    }
    this.notFound();
  }
}
