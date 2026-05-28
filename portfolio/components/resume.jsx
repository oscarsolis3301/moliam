// Resume timeline + testimonials
function Resume({ accent }) {
  const items = [
    { yr: '2026', ttl: 'Automation Engineer', org: 'Current role', tag: 'Present', body: 'Building workflow automations across ServiceNow, Active Directory, and internal tools. Shipping Python/Django apps that save teams hours every week.', active: true },
    { yr: '2024', ttl: 'Full-stack projects', org: 'Independent', tag: 'Ongoing', body: 'Flask + Django web apps, Three.js experiments, AI-assisted tooling. Portfolio you\'re looking at, among others.' },
    { yr: '2023', ttl: 'B.S. Computer Science', org: 'University of Texas at El Paso', tag: 'Graduated', body: 'Focus on software engineering, data structures, and human-computer interaction.' },
    { yr: '2020', ttl: 'Transferred to UTEP', org: 'University of Texas at El Paso', tag: 'Transfer', body: 'Moved to UTEP to finish the CS degree. Deeper into algorithms, systems, and team-based software projects.' },
    { yr: '2018', ttl: 'Introduction to Computer Science', org: 'Community college', tag: 'Foundations', body: 'First formal CS course. Learned C++, flow charts, control flow — if/else, for loops, functions. The mental model clicked here.' },
    { yr: '2017', ttl: 'AP Computer Science A', org: 'High school', tag: 'Origin', body: 'Took AP Java in high school. First time writing real code. Hooked immediately.' },
  ];

  const quotes = [
    { q: 'I gave Oscar a task Monday morning. By Monday afternoon it was automated, documented, and had a logo. I just wanted a spreadsheet.', a: 'Former manager · probably exaggerating' },
    { q: 'He redesigned our internal tool without being asked. Now everyone refuses to go back. Kind of a problem.', a: 'Teammate · slightly annoyed, mostly impressed' },
    { q: '10/10 would hire again. Also if you need him to fix your home Wi-Fi, he\'ll do that too. Unprompted.', a: 'Coworker · true story' },
  ];

  return (
    <section className="snap section resume" data-screen-label="04 Resume">
      <div className="section-chrome">
        <span className="mono tiny">04 / RESUME</span>
        <span className="mono tiny dim">HISTORY</span>
      </div>
      <div className="resume-grid">
        <div className="resume-left">
          <p className="eyebrow mono">
            <span className="dot sm" style={{background: accent}} />
            TIMELINE
          </p>
          <h2 className="h-display">The path<br/>so far.</h2>
          <a className="btn primary resume-dl" href="#" onClick={(e) => { e.preventDefault(); alert('Resume PDF — placeholder link'); }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v8m0 0 3-3m-3 3-3-3M2 12h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Download resume</span>
          </a>
          <p className="mono tiny dim">PDF · 80KB</p>
        </div>
        <div className="resume-timeline">
          {items.map((it, i) => (
            <div key={i} className={`tl-item ${it.active ? 'active' : ''}`}>
              <div className="tl-rail">
                <span className="tl-dot" style={{background: it.active ? accent : undefined}} />
                {i < items.length - 1 && <span className="tl-line" />}
              </div>
              <div className="tl-body">
                <div className="tl-head">
                  <span className="tl-yr mono">{it.yr}</span>
                  <span className="tl-tag mono tiny" style={{color: it.active ? accent : undefined}}>{it.tag}</span>
                </div>
                <h4 className="tl-ttl">{it.ttl}</h4>
                <p className="tl-org mono tiny dim">{it.org.toUpperCase()}</p>
                <p className="tl-text">{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="testimonials">
        <div className="section-chrome inner">
          <span className="mono tiny dim">// WHAT PEOPLE SAY</span>
        </div>
        <div className="quote-grid">
          {quotes.map((q, i) => (
            <figure key={i} className="quote">
              <span className="quote-mark" style={{color: accent}}>"</span>
              <blockquote>{q.q}</blockquote>
              <figcaption className="mono tiny dim">— {q.a}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

window.Resume = Resume;
