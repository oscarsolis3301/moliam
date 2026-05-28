// moliam.com — premium minimal landing (eye-popping)

function MoliamApp() {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), 110);
    setTimeout(() => clearInterval(id), 1400);
    return () => clearInterval(id);
  }, []);

  // mouse parallax for the orb glow
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    const onMove = (e) => {
      const r = document.body.getBoundingClientRect();
      const cx = (e.clientX - r.width / 2) / r.width;
      const cy = (e.clientY - r.height / 2) / r.height;
      document.documentElement.style.setProperty('--mx', cx.toFixed(3));
      document.documentElement.style.setProperty('--my', cy.toFixed(3));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <>
      <div className="bg-grid" />
      <div className="bg-vignette" />
      <div className="bg-aurora">
        <div className="aurora-blob a1" />
        <div className="aurora-blob a2" />
        <div className="aurora-blob a3" />
      </div>
      <NavBar />
      <main className="landing" ref={wrapRef}>
        <section className="hero-block">
          <div className={`logo-wrap fade ${t >= 0 ? 'in' : ''}`}>
            <div className="logo-glow" />
            <div className="logo-ring r3" />
            <div className="logo-ring r2" />
            <div className="logo-ring" />
            <div className="logo-tick" />
            <img src="logo.jpg" alt="moliam" className="logo-mark" />
            <div className="logo-mark-sheen" />
          </div>
          <div className={`eyebrow fade ${t >= 1 ? 'in' : ''}`}>
            MOLIAM · STUDIO · MMXXVI
          </div>
          <h1 className={`headline fade ${t >= 2 ? 'in' : ''}`}>
            We build <span className="accent-italic">quietly</span>.<br />
            You ship <span className="accent-purple">faster</span>.
          </h1>
          <p className={`lede fade ${t >= 3 ? 'in' : ''}`}>
            A small studio making AI infrastructure, web services,<br />
            and automation that actually works.
          </p>
        </section>

        <section className="nav-grid">
          {NAV.map((n, i) => (
            <a key={n.id} href={n.href} className={`nav-card fade ${t >= 4 + i ? 'in' : ''}`}>
              <span className="nc-num">0{i + 1}</span>
              <div className="nc-body">
                <h3>{n.title}</h3>
                <p>{n.desc}</p>
              </div>
              <span className="nc-arrow">→</span>
            </a>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}

const NAV = [
  { id: 'projects',  title: 'Projects',  desc: 'Live, playable in-browser demos.', href: 'projects.html' },
  { id: 'portfolio', title: 'Portfolio', desc: 'Oscar Solis — automation engineer.', href: 'portfolio.html' },
  { id: 'services',  title: 'Services',  desc: 'Web, SEO, ads, automation retainers.', href: 'services.html' },
  { id: 'contact',   title: 'Contact',   desc: 'hello@moliam.com · ~24h reply.', href: 'mailto:hello@moliam.com' },
];

function NavBar() {
  return (
    <header className="navbar">
      <a href="index.html" className="nb-brand">
        <img src="logo.jpg" alt="" className="nb-logo" />
        <span>moliam</span>
      </a>
      <nav className="nb-nav">
        <a href="projects.html">projects</a>
        <a href="portfolio.html">portfolio</a>
        <a href="services.html">services</a>
        <a href="mailto:hello@moliam.com">contact</a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="landing-foot">
      <span>© MOLIAM · MMXXVI</span>
      <span className="dim">Irvine, CA</span>
      <span className="dim">hello@moliam.com</span>
    </footer>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<MoliamApp />);
