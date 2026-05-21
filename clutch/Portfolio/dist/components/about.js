// About + Skills section
function About({
  accent
}) {
  const skills = [{
    group: 'Backend',
    items: ['Python', 'Django', 'Flask', 'REST APIs', 'PostgreSQL']
  }, {
    group: 'Frontend',
    items: ['JavaScript', 'React', 'HTML/CSS', 'Three.js', 'Canvas']
  }, {
    group: 'Platforms',
    items: ['ServiceNow', 'Active Directory', 'Automation', 'AI / LLMs']
  }, {
    group: 'Craft',
    items: ['UI / UX', 'Design Systems', 'Prototyping', 'User Research']
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "snap section about",
    "data-screen-label": "02 About"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-chrome"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, "02 / ABOUT"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "WHO")), /*#__PURE__*/React.createElement("div", {
    className: "about-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "about-left"
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot sm",
    style: {
      background: accent
    }
  }), "INTRODUCTION"), /*#__PURE__*/React.createElement("h2", {
    className: "h-display"
  }, "I'm a ", /*#__PURE__*/React.createElement("em", null, "builder"), " at heart.", /*#__PURE__*/React.createElement("br", null), "A true ", /*#__PURE__*/React.createElement("em", null, "tinkerer"), " by design."), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "Probably making something right now \u2014 automations that save hours, interfaces people actually want to use, and tiny experiments that teach me something new."), /*#__PURE__*/React.createElement("div", {
    className: "stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, "5+"), /*#__PURE__*/React.createElement("span", {
    className: "lbl mono"
  }, "years shipping")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, "40", /*#__PURE__*/React.createElement("em", null, "+")), /*#__PURE__*/React.createElement("span", {
    className: "lbl mono"
  }, "automations deployed")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, "\u221E"), /*#__PURE__*/React.createElement("span", {
    className: "lbl mono"
  }, "curiosity")))), /*#__PURE__*/React.createElement("div", {
    className: "about-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "skills-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, "// SKILLS.MAP"), /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null))), /*#__PURE__*/React.createElement("div", {
    className: "skills-body"
  }, skills.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.group,
    className: "skill-row",
    style: {
      '--i': i
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono dim skill-group"
  }, s.group.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, s.items.map(x => /*#__PURE__*/React.createElement("span", {
    key: x,
    className: "chip"
  }, x)))))), /*#__PURE__*/React.createElement("div", {
    className: "card-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "STACK"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, "04 DOMAINS \xB7 20+ TOOLS"))))));
}
window.About = About;