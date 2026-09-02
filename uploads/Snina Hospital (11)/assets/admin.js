/* =========================================================
   Nemocnica Snina — Admin CMS engine (schema-driven CRUD)
   Edits the same DB the public site reads from (localStorage).
   ========================================================= */

const ADMIN = (function () {
  const AUTH_KEY = "ns_admin_auth";

  /* Field types:
     text | textarea | number | date | bool
     biltext | biltextarea | billist  (bilingual { sk, en })
     select  (opts)
     ref     (collection -> id; titleField for label)
     tags    (csv -> array)
  */
  const STATUS_OPTS = [
    { v: "open", l: { sk: "V prevádzke", en: "Open" } },
    { v: "new", l: { sk: "Nová · prijíma pacientov", en: "New · accepting" } },
    { v: "alert", l: { sk: "Dočasný režim", en: "Temporary measures" } },
    { v: "closed", l: { sk: "Mimo prevádzky", en: "Closed" } }
  ];
  const NEWS_OPTS = [
    { v: "good", l: { sk: "Pozitívne / Nová služba", en: "Good / New service" } },
    { v: "info", l: { sk: "Informácia", en: "Info" } },
    { v: "alert", l: { sk: "Upozornenie", en: "Alert" } }
  ];

  const SCHEMAS = {
    departments: {
      label: { sk: "Oddelenia", en: "Departments" }, icon: "building", title: "short", idFrom: "short",
      fields: [
        { k: "name", t: "biltext", label: { sk: "Plný názov", en: "Full name" } },
        { k: "short", t: "biltext", label: { sk: "Krátky názov", en: "Short name" } },
        { k: "lead", t: "text", label: { sk: "Vedúci lekár", en: "Head physician" } },
        { k: "leadRole", t: "biltext", label: { sk: "Funkcia vedúceho", en: "Head role" } },
        { k: "deputy", t: "text", label: { sk: "Zástupca", en: "Deputy" } },
        { k: "beds", t: "number", label: { sk: "Počet lôžok", en: "Beds" } },
        { k: "phone", t: "text", label: { sk: "Telefón", en: "Phone" } },
        { k: "email", t: "text", label: { sk: "E-mail", en: "Email" } },
        { k: "delivery", t: "text", label: { sk: "Pôrodná sála (tel.)", en: "Delivery room (tel.)" } },
        { k: "featured", t: "bool", label: { sk: "Zobraziť na úvode", en: "Feature on home" } },
        { k: "summary", t: "biltextarea", label: { sk: "Stručný popis", en: "Summary" } },
        { k: "desc", t: "biltextarea", label: { sk: "Podrobný popis", en: "Description" } },
        { k: "facilities", t: "billist", label: { sk: "Vybavenie (1/riadok)", en: "Facilities (1/line)" } },
        { k: "visiting", t: "biltext", label: { sk: "Návštevné hodiny", en: "Visiting hours" } }
      ]
    },
    clinics: {
      label: { sk: "Ambulancie", en: "Clinics" }, icon: "calendar", title: "name", idFrom: "name",
      fields: [
        { k: "name", t: "biltext", label: { sk: "Názov ambulancie", en: "Clinic name" } },
        { k: "specialty", t: "biltext", label: { sk: "Odbornosť", en: "Specialty" } },
        { k: "doctor", t: "text", label: { sk: "Lekár(i)", en: "Physician(s)" } },
        { k: "nurse", t: "text", label: { sk: "Sestra", en: "Nurse" } },
        { k: "location", t: "biltext", label: { sk: "Umiestnenie", en: "Location" } },
        { k: "phone", t: "text", label: { sk: "Telefón", en: "Phone" } },
        { k: "status", t: "select", opts: STATUS_OPTS, label: { sk: "Stav", en: "Status" } },
        { k: "bookable", t: "bool", label: { sk: "Online objednávanie", en: "Online booking" } },
        { k: "referral", t: "bool", label: { sk: "Vyžaduje výmenný lístok", en: "Referral required" } },
        { k: "acceptingNew", t: "bool", label: { sk: "Prijíma nových pacientov", en: "Accepting new patients" } },
        { k: "bookingDays", t: "text", label: { sk: "Dni na objednanie (Po=1…Ne=0, čiarka)", en: "Booking weekdays (Mon=1…Sun=0, csv)" } },
        { k: "bookingWindow", t: "text", label: { sk: "Objednávacie okno (napr. 13:00–14:00)", en: "Booking window (e.g. 13:00–14:00)" } },
        { k: "schedule", t: "billist", label: { sk: "Ordinačné hodiny (1/riadok)", en: "Operating hours (1/line)" } },
        { k: "bookingRule", t: "biltextarea", label: { sk: "Pravidlo objednávania", en: "Booking rule" } },
        { k: "fee", t: "biltext", label: { sk: "Poplatok (nepovinné)", en: "Fee (optional)" } }
      ]
    },
    physicians: {
      label: { sk: "Lekári", en: "Physicians" }, icon: "user", title: "name", idFrom: "name", titlePlain: true,
      fields: [
        { k: "name", t: "text", label: { sk: "Meno (vrátane titulov)", en: "Name (with titles)" } },
        { k: "role", t: "biltext", label: { sk: "Pozícia / Odbornosť", en: "Role / Specialty" } },
        { k: "bio", t: "biltextarea", label: { sk: "Profil", en: "Bio" } },
        { k: "accepting", t: "bool", label: { sk: "Prijíma nových pacientov", en: "Accepting new patients" } },
        { k: "dept", t: "ref", ref: "departments", label: { sk: "Oddelenie", en: "Department" } },
        { k: "clinic", t: "ref", ref: "clinics", label: { sk: "Ambulancia", en: "Clinic" } },
        { k: "facility", t: "ref", ref: "facilities", label: { sk: "Pracovisko", en: "Facility" } },
        { k: "langs", t: "tags", label: { sk: "Jazyky (čiarka: SK, EN, UK…)", en: "Languages (csv)" } }
      ]
    },
    services: {
      label: { sk: "Služby", en: "Services" }, icon: "activity", title: "name", idFrom: "name",
      fields: [
        { k: "name", t: "biltext", label: { sk: "Názov služby", en: "Service name" } },
        { k: "desc", t: "biltextarea", label: { sk: "Popis", en: "Description" } },
        { k: "icon", t: "select", opts: ["scalpel","heart","activity","stethoscope","pulse","shield","flask","scan","pill"].map(v=>({v,l:{sk:v,en:v}})), label: { sk: "Ikona", en: "Icon" } },
        { k: "dept", t: "ref", ref: "departments", label: { sk: "Súvisiace oddelenie", en: "Related department" } },
        { k: "clinic", t: "ref", ref: "clinics", label: { sk: "Súvisiaca ambulancia", en: "Related clinic" } },
        { k: "facility", t: "ref", ref: "facilities", label: { sk: "Súvisiace pracovisko", en: "Related facility" } }
      ]
    },
    facilities: {
      label: { sk: "Diagnostika", en: "Facilities" }, icon: "flask", title: "name", idFrom: "name",
      fields: [
        { k: "name", t: "biltext", label: { sk: "Názov pracoviska", en: "Facility name" } },
        { k: "lead", t: "text", label: { sk: "Vedúci", en: "Lead" } },
        { k: "phone", t: "text", label: { sk: "Telefón", en: "Phone" } },
        { k: "kind", t: "biltext", label: { sk: "Zameranie", en: "Kind" } },
        { k: "desc", t: "biltextarea", label: { sk: "Popis", en: "Description" } },
        { k: "features", t: "billist", label: { sk: "Vlastnosti (1/riadok)", en: "Features (1/line)" } }
      ]
    },
    news: {
      label: { sk: "Aktuality", en: "News" }, icon: "doc", title: "title", idFrom: "title",
      fields: [
        { k: "title", t: "biltext", label: { sk: "Titulok", en: "Title" } },
        { k: "body", t: "biltextarea", label: { sk: "Text oznamu", en: "Body" } },
        { k: "tag", t: "biltext", label: { sk: "Štítok", en: "Tag" } },
        { k: "type", t: "select", opts: NEWS_OPTS, label: { sk: "Typ", en: "Type" } },
        { k: "date", t: "date", label: { sk: "Dátum", en: "Date" } }
      ]
    },
    disclosures: {
      label: { sk: "Zverejňovanie", en: "Disclosures" }, icon: "download", title: "partner", idEditable: true,
      fields: [
        { k: "id", t: "text", label: { sk: "Číslo dokumentu", en: "Document ID" } },
        { k: "type", t: "biltext", label: { sk: "Typ (Zmluva/Faktúra)", en: "Type" } },
        { k: "partner", t: "text", label: { sk: "Partner / Predmet", en: "Partner / Subject" } },
        { k: "value", t: "text", label: { sk: "Hodnota", en: "Value" } },
        { k: "date", t: "date", label: { sk: "Dátum", en: "Date" } }
      ]
    }
  };

  const SINGLETONS = {
    hospital: {
      label: { sk: "Údaje o nemocnici", en: "Hospital info" }, icon: "shield",
      fields: [
        { k: "name", t: "text", label: { sk: "Názov", en: "Name" } },
        { k: "tagline", t: "biltext", label: { sk: "Podtitul", en: "Tagline" } },
        { k: "address", t: "text", label: { sk: "Adresa", en: "Address" } },
        { k: "ico", t: "text", label: { sk: "IČO", en: "Reg. no." } },
        { k: "dic", t: "text", label: { sk: "DIČ", en: "Tax ID" } },
        { k: "phone", t: "text", label: { sk: "Centrála", en: "Switchboard" } },
        { k: "reception", t: "text", label: { sk: "Recepcia", en: "Reception" } },
        { k: "pharmacy", t: "text", label: { sk: "Lekáreň", en: "Pharmacy" } },
        { k: "email", t: "text", label: { sk: "E-mail", en: "Email" } },
        { k: "region", t: "biltext", label: { sk: "Región", en: "Region" } }
      ]
    },
    pages: {
      label: { sk: "Obsah stránok", en: "Page content" }, icon: "edit",
      groups: [
        { title: { sk: "Úvodný banner (Hero)", en: "Hero banner" }, path: "hero", fields: [
          { k: "badge", t: "biltext", label: { sk: "Štítok", en: "Badge" } },
          { k: "title", t: "biltext", label: { sk: "Nadpis", en: "Title" } },
          { k: "subtitle", t: "biltextarea", label: { sk: "Podnadpis", en: "Subtitle" } }
        ]},
        { title: { sk: "O nemocnici", en: "About" }, path: "about", fields: [
          { k: "title", t: "biltext", label: { sk: "Nadpis", en: "Title" } },
          { k: "body", t: "biltextarea", label: { sk: "Text", en: "Body" } }
        ]},
        { title: { sk: "Pohotovosť (APS)", en: "Emergency (APS)" }, path: "aps", fields: [
          { k: "title", t: "biltext", label: { sk: "Nadpis", en: "Title" } },
          { k: "note", t: "biltextarea", label: { sk: "Text", en: "Note" } }
        ]}
      ]
    }
  };

  /* ---------- auth ---------- */
  function isAuthed() { return sessionStorage.getItem(AUTH_KEY) === "1"; }
  function login(pw) { if (pw === "admin") { sessionStorage.setItem(AUTH_KEY, "1"); return true; } return false; }
  function logout() { sessionStorage.removeItem(AUTH_KEY); }

  /* ---------- helpers ---------- */
  function slugify(s) {
    return (s || "item").toString().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || ("item-" + Date.now());
  }
  function blank(schema) {
    const o = {};
    schema.fields.forEach(f => {
      if (f.t === "biltext" || f.t === "biltextarea") o[f.k] = { sk: "", en: "" };
      else if (f.t === "billist") o[f.k] = { sk: [], en: [] };
      else if (f.t === "bool") o[f.k] = false;
      else if (f.t === "tags") o[f.k] = [];
      else o[f.k] = "";
    });
    return o;
  }

  return { SCHEMAS, SINGLETONS, STATUS_OPTS, isAuthed, login, logout, slugify, blank };
})();
