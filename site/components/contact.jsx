// Contact section
function Contact({ accent }) {
  const [copied, setCopied] = React.useState(false);
  const email = 'hello@osco.dev';

  const copy = () => {
    navigator.clipboard?.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="snap section contact" data-screen-label="05 Contact">
      <div className="section-chrome">
        <span className="mono tiny">05 / CONTACT</span>
        <span className="mono tiny dim">END OF LINE</span>
      </div>
      <div className="contact-inner">
        <p className="eyebrow mono center">
          <span className="dot sm" style={{background: accent}} />
          LET'S BUILD SOMETHING
        </p>
        <h2 className="h-display huge center">
          <span>Have an</span>{' '}
          <em>idea?</em><br/>
          <span>Let's make it</span>{' '}
          <em>real.</em>
        </h2>
        <div className="contact-cta">
          <button className="btn primary big" onClick={copy}>
            <span>{copied ? 'COPIED TO CLIPBOARD' : email}</span>
            <svg width="14" height="14" viewBox="0 0 14 14">
              {copied
                ? <path d="m3 7 3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                : <path d="M4 4h6v6H4zM2 2h6v2M2 2v6h2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              }
            </svg>
          </button>
          <a className="btn ghost big" href="https://github.com/oscarsolis3301" target="_blank" rel="noreferrer">
            <span>github.com/oscarsolis3301</span>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 2h7v7M12 2 5 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
          </a>
        </div>
        <div className="contact-links">
          <a href="https://github.com/oscarsolis3301" target="_blank" rel="noreferrer" className="link-chip">
            <span className="mono tiny dim">GH</span>
            <span>GitHub</span>
          </a>
          <a href="https://www.linkedin.com/in/oscarsolis3301/" target="_blank" rel="noreferrer" className="link-chip">
            <span className="mono tiny dim">LI</span>
            <span>LinkedIn</span>
          </a>
          <a href="mailto:hello@osco.dev" className="link-chip">
            <span className="mono tiny dim">@</span>
            <span>Email</span>
          </a>
        </div>
      </div>
      <footer className="page-foot">
        <span className="mono tiny dim">© OSCAR SOLIS · 2026</span>
        <span className="mono tiny dim">MADE WITH ☕ IN IRVINE, CA</span>
        <span className="mono tiny dim">↑↑↓↓←→←→BA</span>
      </footer>
    </section>
  );
}

window.Contact = Contact;
