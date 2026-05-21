// Contact section
function Contact({
  accent
}) {
  const [copied, setCopied] = React.useState(false);
  const email = 'hello@osco.dev';
  const copy = () => {
    navigator.clipboard?.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return /*#__PURE__*/React.createElement("section", {
    className: "snap section contact",
    "data-screen-label": "05 Contact"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-chrome"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, "05 / CONTACT"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "END OF LINE")), /*#__PURE__*/React.createElement("div", {
    className: "contact-inner"
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow mono center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot sm",
    style: {
      background: accent
    }
  }), "LET'S BUILD SOMETHING"), /*#__PURE__*/React.createElement("h2", {
    className: "h-display huge center"
  }, /*#__PURE__*/React.createElement("span", null, "Have an"), ' ', /*#__PURE__*/React.createElement("em", null, "idea?"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", null, "Let's make it"), ' ', /*#__PURE__*/React.createElement("em", null, "real.")), /*#__PURE__*/React.createElement("div", {
    className: "contact-cta"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary big",
    onClick: copy
  }, /*#__PURE__*/React.createElement("span", null, copied ? 'COPIED TO CLIPBOARD' : email), /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 14 14"
  }, copied ? /*#__PURE__*/React.createElement("path", {
    d: "m3 7 3 3 5-6",
    stroke: "currentColor",
    strokeWidth: "1.5",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }) : /*#__PURE__*/React.createElement("path", {
    d: "M4 4h6v6H4zM2 2h6v2M2 2v6h2",
    stroke: "currentColor",
    strokeWidth: "1.2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("a", {
    className: "btn ghost big",
    href: "https://github.com/oscarsolis3301",
    target: "_blank",
    rel: "noreferrer"
  }, /*#__PURE__*/React.createElement("span", null, "github.com/oscarsolis3301"), /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 14 14"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 2h7v7M12 2 5 9",
    stroke: "currentColor",
    strokeWidth: "1.5",
    fill: "none",
    strokeLinecap: "round"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "contact-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/oscarsolis3301",
    target: "_blank",
    rel: "noreferrer",
    className: "link-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "GH"), /*#__PURE__*/React.createElement("span", null, "GitHub")), /*#__PURE__*/React.createElement("a", {
    href: "https://www.linkedin.com/in/oscarsolis3301/",
    target: "_blank",
    rel: "noreferrer",
    className: "link-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "LI"), /*#__PURE__*/React.createElement("span", null, "LinkedIn")), /*#__PURE__*/React.createElement("a", {
    href: "mailto:hello@osco.dev",
    className: "link-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "@"), /*#__PURE__*/React.createElement("span", null, "Email")))), /*#__PURE__*/React.createElement("footer", {
    className: "page-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "\xA9 OSCAR SOLIS \xB7 2026"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "MADE WITH \u2615 IN IRVINE, CA"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "\u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192BA")));
}
window.Contact = Contact;