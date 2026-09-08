/* media.js — image placeholders for the public site.
   Declares every photo slot on every page in one place, so the CMS media
   fields can be modelled 1:1 from this file. Slots are <image-slot>: the
   user drags a real photo onto one and it persists.
   Load AFTER data.js + site.js and after each page's own inline script. */
(function () {
  const tx = (v) => (typeof L === "function" ? L(v) : (v && v.sk) || v || "");
  const at = (s) => String(s == null ? "" : s).replace(/"/g, "&quot;");

  /* One slot inside an aspect-ratio frame, with optional caption below. */
  function figure(o) {
    const cap = o.caption ? `<figcaption class="media-cap">${at(tx(o.caption))}</figcaption>` : "";
    return `<figure class="media ${o.cls || ""}"><div class="media-frame" style="aspect-ratio:${o.ratio || "16/9"}"><image-slot id="${at(o.id)}" shape="rect" fit="cover" placeholder="${at(tx(o.label))}"></image-slot></div>${cap}</figure>`;
  }

  const P = (sk, en) => ({ sk, en });

  /* ---- Hero: full-bleed band directly under the page hero copy ---- */
  function mountHero(o) {
    const hero = document.querySelector(".page-hero");
    if (!hero || document.querySelector(".media-hero-band")) return;
    hero.insertAdjacentHTML("afterend", `<section class="media-hero-band"><div class="media-frame" style="aspect-ratio:${o.ratio || "21/6"}"><image-slot id="${at(o.id)}" shape="rect" fit="cover" placeholder="${at(tx(o.label))}"></image-slot></div></section>`);
  }

  /* ---- Insert a band / gallery relative to an existing element ---- */
  function mountInsert(o) {
    const el = document.querySelector(o.sel);
    if (!el) return;
    let html;
    if (o.hero) {
      html = `<section class="media-hero-band"><div class="media-frame" style="aspect-ratio:${o.ratio || "21/6"}"><image-slot id="${at(o.id)}" shape="rect" fit="cover" placeholder="${at(tx(o.label))}"></image-slot></div></section>`;
      el.insertAdjacentHTML(o.pos || "afterend", html);
      return;
    }
    if (o.grid) {
      html = `<div class="media-gallery">${o.grid.map((g) => figure({ id: g.id, label: g.label, ratio: g.ratio || "4/3", caption: g.caption })).join("")}</div>`;
    } else {
      html = figure(o);
    }
    if (o.full) html = `<section class="media-band"><div class="container">${html}</div></section>`;
    el.insertAdjacentHTML(o.pos || "beforeend", html);
  }

  /* ---- Upgrade the legacy .ph placeholders + doctor avatars in place ---- */
  function upgradeExisting(page) {
    document.querySelectorAll(".ph[data-label]").forEach((ph, i) => {
      const link = ph.closest('a[href*="?id="]');
      const key = ph.dataset.mediaId || (link ? "dept-" + new URL(link.href, location.href).searchParams.get("id") : page + "-ph-" + i);
      const ratio = ph.classList.contains("ph-1x1") ? "1/1" : ph.classList.contains("ph-4x3") ? "4/3" : ph.classList.contains("ph-3x1") ? "3/1" : "16/9";
      ph.classList.remove("ph");
      ph.style.aspectRatio = ratio;
      ph.style.position = "relative";
      ph.style.overflow = "hidden";
      ph.innerHTML = `<image-slot id="${at(key)}" shape="rect" fit="cover" placeholder="${at(ph.dataset.label)}"></image-slot>`;
    });
    document.querySelectorAll(".doc-card .avatar").forEach((av) => {
      const id = av.closest(".doc-card").id;
      if (!id) return;
      av.classList.add("avatar-slot");
      av.innerHTML = `<image-slot id="doc-${at(id)}" shape="circle" fit="cover" placeholder="${at(tx(P("Portrét", "Portrait")))}"></image-slot>`;
    });
  }

  /* ============ Per-page slot plan ============ */
  const PLAN = {
    "index.html": {
      inserts: [
        { sel: ".hero-wrap", pos: "afterend", hero: true, id: "home-campus", ratio: "21/6",
          label: P("Hlavná budova Nemocnice Snina — široká fotografia areálu", "Nemocnica Snina main building — wide campus photo") },
        { sel: "main > section.band-warm:last-of-type", pos: "beforebegin", full: true,
          grid: [
            { id: "home-care-1", label: P("Sestra pri pacientovi na oddelení", "Nurse with a patient on the ward") },
            { id: "home-care-2", label: P("Lekár pri konzultácii s pacientom", "Physician consulting with a patient") },
            { id: "home-care-3", label: P("Moderné diagnostické vybavenie", "Modern diagnostic equipment") }
          ] }
      ]
    },
    "o-nemocnici.html": {
      hero: { id: "about-hero", label: P("Budova nemocnice zvonku", "Hospital building exterior") },
      inserts: [
        { sel: "#historia .container", pos: "beforeend", id: "about-history", ratio: "16/9",
          label: P("Archívna fotografia nemocnice", "Archive photo of the hospital"),
          caption: P("Z archívu nemocnice", "From the hospital archive") },
        { sel: "#investicie .container", pos: "beforeend", id: "about-invest", ratio: "16/9",
          label: P("Zrekonštruované oddelenie / nové vybavenie", "Renovated ward / new equipment") }
      ]
    },
    "pre-pacientov.html": {
      hero: { id: "patients-hero", label: P("Recepcia a príjem pacientov", "Reception & patient admissions") },
      inserts: [
        { sel: "#cakacie-lehoty .container", pos: "beforeend",
          grid: [
            { id: "patients-admission", label: P("Príjmová kancelária — personál s pacientom", "Admissions office — staff with a patient"), ratio: "16/9" },
            { id: "patients-pharmacy", label: P("Nemocničná lekáreň", "Hospital pharmacy"), ratio: "16/9" }
          ] },
        { sel: "#informacie .container", pos: "beforeend",
          grid: [
            { id: "patients-room", label: P("Lôžková izba pre pacientov", "Inpatient room") },
            { id: "patients-visit", label: P("Návšteva pri lôžku pacienta", "Visitor at a patient's bedside") },
            { id: "patients-nurse", label: P("Sestra podáva informácie pacientovi", "Nurse briefing a patient") }
          ] },
        { sel: "#podakovania .container", pos: "beforeend", id: "patients-discharge", ratio: "21/8",
          label: P("Prepustenie pacienta — personál pri odchode pacienta", "Patient discharge — staff seeing a patient out") }
      ]
    },
    "kariera.html": {
      hero: { id: "careers-hero", label: P("Tím zdravotníckeho personálu", "Clinical team portrait") },
      inserts: [
        { sel: "main > section.section:not(.media-band) .container", pos: "beforeend",
          grid: [
            { id: "careers-1", label: P("Sestry pri práci na oddelení", "Nurses at work on the ward") },
            { id: "careers-2", label: P("Lekári na vizite", "Physicians on ward rounds") },
            { id: "careers-3", label: P("Vzdelávanie a stáže", "Training & residencies") }
          ] }
      ]
    },
    "edukacia.html": {
      hero: { id: "education-hero", label: P("Edukácia pacientov — sestra vysvetľuje pacientovi", "Patient education — nurse explaining to a patient") }
    },
    "oddelenia.html": {
      hero: { id: "departments-hero", label: P("Chodba lôžkového oddelenia", "Inpatient ward corridor") }
    },
    "oddelenie.html": {},
    "ambulancie.html": {
      hero: { id: "clinics-hero", label: P("Čakáreň ambulancií", "Outpatient clinic waiting area") }
    },
    "diagnostika.html": {
      hero: { id: "diagnostics-hero", label: P("CT / RTG pracovisko", "CT / X-ray suite") },
      inserts: [
        { sel: "main > section.section:not(.media-band) .container", pos: "beforeend",
          grid: [
            { id: "diag-1", label: P("Rádiológ pri vyhodnocovaní snímok", "Radiologist reading images") },
            { id: "diag-2", label: P("Laboratórium — spracovanie vzoriek", "Laboratory — sample processing") },
            { id: "diag-3", label: P("Ultrazvukové vyšetrenie", "Ultrasound examination") }
          ] }
      ]
    },
    "sluzby.html": {
      hero: { id: "services-hero", label: P("Sestra pomáha pacientovi", "Nurse assisting a patient") }
    },
    "lekari.html": {
      hero: { id: "physicians-hero", label: P("Lekári nemocnice — skupinová fotografia", "Hospital physicians — group photo") }
    },
    "aktuality.html": {
      hero: { id: "news-hero", label: P("Nemocnica — fotografia pre aktuality", "Hospital photo for the news page") }
    },
    "kontakt.html": {
      hero: { id: "contact-hero", label: P("Areál nemocnice z vtáčej perspektívy", "Hospital campus from above") }
    },
    "objednanie.html": {
      hero: { id: "booking-hero", label: P("Objednávanie — pacient s telefónom / recepcia", "Booking — patient with phone / reception"), ratio: "16/9" }
    },
    "telehealth.html": {
      hero: { id: "telehealth-hero", label: P("Pacient na videokonzultácii s lekárom", "Patient in a video consultation with a physician") }
    },
    "teleconsult.html": {
      hero: { id: "teleconsult-hero", label: P("Lekár počas telekonzultácie", "Physician during a teleconsultation"), ratio: "16/9" }
    },
    "zverejnovanie.html": {
      hero: { id: "disclosure-hero", label: P("Administratívna budova nemocnice", "Hospital administration building"), ratio: "16/9" }
    }
  };

  /* Fill mounted slots from assets/img/index.json (IMG_1_PLACEHOLDER_
     PHOTOGRAPHY.md) — sourced placeholder photos, not real hospital photos
     (see "placeholder": true / "credit" on each entry). A slot with no
     matching entry keeps its empty <image-slot> caption — that's the
     "framed placeholder" state for a genuine sourcing gap, not a bug. */
  function applyRealPhotos() {
    fetch("assets/img/index.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((index) => {
        Object.keys(index).forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const entry = index[id];
          el.setAttribute("src", "assets/img/" + entry.avif);
          const locale = document.documentElement.lang === "en" ? "en" : "sk";
          if (entry.alt && entry.alt[locale]) el.setAttribute("alt", entry.alt[locale]);
        });
      })
      .catch(() => { /* index.json not reachable (e.g. file:// origin) — slots stay framed placeholders */ });
  }

  function run() {
    const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    upgradeExisting(page.replace(".html", ""));
    const plan = PLAN[page];
    if (!plan) return;
    if (plan.hero) mountHero(plan.hero);
    (plan.inserts || []).forEach(mountInsert);
    /* dev guard: every declared slot must actually exist in the DOM */
    const declared = [];
    if (plan.hero) declared.push(plan.hero.id);
    (plan.inserts || []).forEach((i) => (i.grid ? i.grid.forEach((g) => declared.push(g.id)) : declared.push(i.id)));
    const missing = declared.filter((id) => id && !document.getElementById(id));
    if (missing.length) console.warn("[media.js] slots failed to mount on " + page + ":", missing);
    applyRealPhotos();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
