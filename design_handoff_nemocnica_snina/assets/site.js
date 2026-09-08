/* =========================================================
   Nemocnica Snina — i18n, icons & shared site chrome
   ========================================================= */

/* ---- Language ---- */
const LANG_KEY = "ns_lang";
function getLang() { return localStorage.getItem(LANG_KEY) || "sk"; }
function setLang(l) { localStorage.setItem(LANG_KEY, l); location.reload(); }
/* Resolve a bilingual {sk,en} field (or pass through plain strings/arrays) */
function L(v) {
  const lang = getLang();
  if (v == null) return "";
  if (typeof v === "object" && !Array.isArray(v) && (("sk" in v) || ("en" in v))) {
    return v[lang] != null ? v[lang] : (v.sk != null ? v.sk : v.en);
  }
  return v;
}

/* ---- UI string dictionary ---- */
const STR = {
  brandSub: { sk: "Poliklinika a lôžková časť", en: "Polyclinic & Inpatient Care" },
  emergency: { sk: "Pohotovosť / Tieseň", en: "Emergency" },
  callEmergency: { sk: "Volať 112", en: "Call 112" },
  central: { sk: "Centrála", en: "Switchboard" },
  book: { sk: "Objednať termín", en: "Book appointment" },
  portal: { sk: "Pacientsky portál", en: "Patient portal" },
  login: { sk: "Prihlásiť sa", en: "Log in" },
  nav: {
    departments: { sk: "Oddelenia", en: "Departments" },
    clinics: { sk: "Ambulancie", en: "Clinics" },
    doctors: { sk: "Lekári", en: "Physicians" },
    services: { sk: "Služby", en: "Services" },
    diagnostics: { sk: "Diagnostika", en: "Diagnostics" },
    patients: { sk: "Pre pacientov", en: "For patients" },
    about: { sk: "O nemocnici", en: "About us" },
    news: { sk: "Aktuality", en: "News" },
    contact: { sk: "Kontakt", en: "Contact" }
  },
  footer: {
    care: { sk: "Starostlivosť", en: "Care" },
    patients: { sk: "Pre pacientov", en: "For patients" },
    legal: { sk: "Povinné informácie", en: "Mandatory information" },
    disclosures: { sk: "Zverejňovanie zmlúv a faktúr", en: "Contracts & invoices" },
    careers: { sk: "Voľné pracovné miesta", en: "Careers" },
    education: { sk: "Materiály pre pacientov", en: "Patient education library" },
    careers: { sk: "Voľné pracovné miesta", en: "Careers" },
    education: { sk: "Príprava a starostlivosť (materiály)", en: "Patient education library" },
    privacy: { sk: "Ochrana osobných údajov (GDPR)", en: "Privacy policy (GDPR)" },
    accessibility: { sk: "Vyhlásenie o prístupnosti", en: "Accessibility statement" },
    admin: { sk: "Správa obsahu (admin)", en: "Content administration" },
    rights: { sk: "Všetky práva vyhradené.", en: "All rights reserved." }
  },
  status: {
    open: { sk: "V prevádzke", en: "Open" },
    new: { sk: "Nová · prijíma pacientov", en: "New · accepting patients" },
    alert: { sk: "Dočasný režim", en: "Temporary measures" },
    closed: { sk: "Mimo prevádzky", en: "Closed" },
    comingSoon: { sk: "Obsah sa pripravuje", en: "Content coming soon" }
  },
  accepting: { sk: "Prijíma nových pacientov", en: "Accepting new patients" },
  notAccepting: { sk: "Neprijíma nových pacientov", en: "Not accepting new patients" },
  referralReq: { sk: "Potrebný výmenný lístok", en: "Referral required" },
  beds: { sk: "lôžok", en: "beds" },
  head: { sk: "Vedúci lekár", en: "Head physician" },
  more: { sk: "Zobraziť detail", en: "View details" },
  bookHere: { sk: "Objednať sa", en: "Book here" },
  phone: { sk: "Telefón", en: "Phone" },
  location: { sk: "Umiestnenie", en: "Location" },
  schedule: { sk: "Ordinačné hodiny", en: "Operating hours" },
  backHome: { sk: "Domov", en: "Home" }
};
function t(path) {
  const parts = path.split(".");
  let cur = STR;
  for (const p of parts) { cur = cur && cur[p]; }
  return L(cur);
}

/* ---- Icons (inline SVG, 24x24 stroke) ---- */
const ICON = {
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 7 4-16 2 9h6"/></svg>',
  stethoscope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .2.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><path d="m8.5 8.5 7 7"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7 14h10"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>',
  scalpel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4 4 14l3 3L20 4z"/><path d="m7 17-4 4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  baby: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};
function icon(name) { return ICON[name] || ""; }

/* ---- Small DOM helpers ---- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const lang = getLang();
  return d.toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function statusBadge(status) {
  const map = { open: "badge-green", new: "badge-terra", alert: "badge-amber", closed: "badge-gray", comingSoon: "badge-gray" };
  const cls = map[status] || "badge-gray";
  return `<span class="badge ${cls}"><span class="dot"></span>${esc(t("status." + status))}</span>`;
}

/* ---- Header + footer mount ---- */
const Site = {
  mount(opts) {
    opts = opts || {};
    const active = opts.active || "";
    const lang = getLang();
    document.documentElement.lang = lang;
    const H = DB.get("hospital");

    const navItems = [
      ["departments", "oddelenia.html"],
      ["clinics", "ambulancie.html"],
      ["doctors", "lekari.html"],
      ["services", "sluzby.html"],
      ["diagnostics", "diagnostika.html"],
      ["patients", "pre-pacientov.html"],
      ["about", "o-nemocnici.html"],
      ["news", "aktuality.html"],
      ["contact", "kontakt.html"]
    ];
    const navHtml = navItems.map(([k, href]) =>
      `<a href="${href}" class="${active === k ? "active" : ""}">${esc(t("nav." + k))}</a>`).join("");

    const header = document.getElementById("siteHeader");
    if (header) {
      header.className = "site-header";
      header.innerHTML = `
        <div class="utility-bar">
          <div class="container">
            <div class="util-left">
              <span class="util-phone flex-center gap-sm">${icon("phone")} ${esc(t("central"))}: <a href="tel:+421577660111">${esc(H.phone)}</a></span>
              <a href="tel:112" class="util-emergency">${icon("alert")} ${esc(t("emergency"))}: 112</a>
            </div>
            <div class="lang-switch" role="group" aria-label="Language">
              <button class="${lang === "sk" ? "active" : ""}" onclick="setLang('sk')">SK</button>
              <button class="${lang === "en" ? "active" : ""}" onclick="setLang('en')">EN</button>
            </div>
          </div>
        </div>
        <div class="container">
          <div class="nav-main">
            <a href="index.html" class="brand" aria-label="Nemocnica Snina">
              <span class="brand-mark">${icon("cross")}</span>
              <span class="brand-text"><strong>Nemocnica Snina</strong><span>${esc(L(STR.brandSub))}</span></span>
            </a>
            <nav class="nav-links" aria-label="Hlavná navigácia">${navHtml}</nav>
            <div class="nav-cta">
              <a href="portal.html" class="btn btn-ghost btn-sm">${icon("user")} ${esc(t("portal"))}</a>
              <a href="objednanie.html" class="btn btn-primary btn-sm">${icon("calendar")} ${esc(t("book"))}</a>
            </div>
            <button class="nav-toggle" aria-label="Menu" onclick="Site.toggleMenu()">${icon("menu")}</button>
          </div>
        </div>
        <div class="mobile-menu" id="mobileMenu">
          ${navItems.map(([k, href]) => `<a href="${href}">${esc(t("nav." + k))}</a>`).join("")}
          <a href="portal.html">${esc(t("portal"))}</a>
          <a href="objednanie.html" class="btn btn-primary mt-2">${icon("calendar")} ${esc(t("book"))}</a>
        </div>`;
    }

    const footer = document.getElementById("siteFooter");
    if (footer) {
      footer.className = "site-footer";
      footer.innerHTML = `
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="brand" style="margin-bottom:16px">
                <span class="brand-mark">${icon("cross")}</span>
                <span class="brand-text"><strong style="color:#fff">Nemocnica Snina, s.r.o.</strong><span style="color:#8fa6bf">${esc(L(STR.brandSub))}</span></span>
              </div>
              <p style="color:#aebfd2; font-size:.92rem; max-width:34ch">${esc(L(H.region))}.</p>
              <p style="color:#8fa6bf; font-size:.85rem; line-height:1.7">
                ${icon("pin")} ${esc(H.address)}<br>
                IČO: ${esc(H.ico)} · DIČ: ${esc(H.dic)}
              </p>
            </div>
            <div>
              <h4>${esc(t("footer.care"))}</h4>
              <ul>
                <li><a href="oddelenia.html">${esc(t("nav.departments"))}</a></li>
                <li><a href="ambulancie.html">${esc(t("nav.clinics"))}</a></li>
                <li><a href="lekari.html">${esc(t("nav.doctors"))}</a></li>
                <li><a href="diagnostika.html">${esc(t("nav.diagnostics"))}</a></li>
                <li><a href="o-nemocnici.html">${esc(t("nav.about"))}</a></li>
              </ul>
            </div>
            <div>
              <h4>${esc(t("footer.patients"))}</h4>
              <ul>
                <li><a href="objednanie.html">${esc(t("book"))}</a></li>
                <li><a href="portal.html">${esc(t("portal"))}</a></li>
                <li><a href="pre-pacientov.html#cennik">${esc(L({sk:"Cenník",en:"Price list"}))}</a></li>
                <li><a href="pre-pacientov.html#staznosti">${esc(L({sk:"Sťažnosti",en:"Complaints"}))}</a></li>
                <li><a href="edukacia.html">${esc(t("footer.education"))}</a></li>
                <li><a href="kariera.html">${esc(t("footer.careers"))}</a></li>
              </ul>
            </div>
            <div>
              <h4>${esc(t("footer.legal"))}</h4>
              <ul>
                <li><a href="aktuality.html">${esc(t("nav.news"))}</a></li>
                <li><a href="kontakt.html">${esc(t("nav.contact"))}</a></li>
                <li><a href="zverejnovanie.html">${esc(t("footer.disclosures"))}</a></li>
                <li><a href="kontakt.html#gdpr">${esc(t("footer.privacy"))}</a></li>
                <li><a href="kontakt.html#pristupnost">${esc(t("footer.accessibility"))}</a></li>
                <li><a href="admin.html">${esc(t("footer.admin"))}</a></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} Nemocnica Snina, s.r.o. ${esc(t("footer.rights"))}</span>
            <span>${esc(L({ sk: "WCAG 2.1 AA · Zákon č. 351/2022 Z. z.", en: "WCAG 2.1 AA · Act No. 351/2022" }))}</span>
          </div>
        </div>`;
    }

    this.initReveal();
  },
  toggleMenu() {
    const m = document.getElementById("mobileMenu");
    if (m) m.classList.toggle("open");
  },
  initReveal() {
    // Content is visible by default; we only add the entrance animation class.
    document.querySelectorAll(".reveal:not(.in)").forEach(function (e) { e.classList.add("in"); });
  }
};

/* Run after each page's inline script has built its content. */
window.addEventListener("load", function () { Site.initReveal(); });
