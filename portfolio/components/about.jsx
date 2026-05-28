// About + Skills section
function About({ accent }) {
  const skills = [
    { group: 'Backend', items: ['Python', 'Django', 'Flask', 'REST APIs', 'PostgreSQL'] },
    { group: 'Frontend', items: ['JavaScript', 'React', 'HTML/CSS', 'Three.js', 'Canvas'] },
    { group: 'Platforms', items: ['ServiceNow', 'Active Directory', 'Automation', 'AI / LLMs'] },
    { group: 'Craft', items: ['UI / UX', 'Design Systems', 'Prototyping', 'User Research'] },
  ];

  return (
    <section className="snap section about" data-screen-label="02 About">
      <div className="section-chrome">
        <span className="mono tiny">02 / ABOUT</span>
        <span className="mono tiny dim">WHO</span>
      </div>
      <div className="about-grid">
        <div className="about-left">
          <p className="eyebrow mono">
            <span className="dot sm" style={{background: accent}} />
            INTRODUCTION
          </p>
          <h2 className="h-display">
            I'm a <em>builder</em> at heart.<br/>
            A true <em>tinkerer</em> by design.
          </h2>
          <p className="lede">
            Probably making something right now — automations that save hours,
            interfaces people actually want to use, and tiny experiments that
            teach me something new.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="num">5+</span>
              <span className="lbl mono">years shipping</span>
            </div>
            <div className="stat">
              <span className="num">40<em>+</em></span>
              <span className="lbl mono">automations deployed</span>
            </div>
            <div className="stat">
              <span className="num">∞</span>
              <span className="lbl mono">curiosity</span>
            </div>
          </div>
        </div>
        <div className="about-right">
          <div className="skills-card">
            <div className="card-head">
              <span className="mono tiny">// SKILLS.MAP</span>
              <div className="dots">
                <i /><i /><i />
              </div>
            </div>
            <div className="skills-body">
              {skills.map((s, i) => (
                <div key={s.group} className="skill-row" style={{'--i': i}}>
                  <span className="mono dim skill-group">{s.group.toUpperCase()}</span>
                  <div className="chips">
                    {s.items.map(x => (
                      <span key={x} className="chip">{x}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="card-foot">
              <span className="mono tiny dim">STACK</span>
              <span className="mono tiny">04 DOMAINS · 20+ TOOLS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

window.About = About;
