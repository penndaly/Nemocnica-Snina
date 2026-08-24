/* =========================================================
   Nemocnica Snina — Seeded database + localStorage store
   All real content compiled from the hospital audit.
   Bilingual fields are { sk, en }. The admin CMS edits these
   collections; the public pages read from them.
   ========================================================= */

const SEED_VERSION = 9;

const SEED = {
  hospital: {
    name: "Nemocnica Snina, s.r.o.",
    tagline: { sk: "Poliklinika a lôžková časť", en: "Polyclinic & Inpatient Care" },
    address: "Sládkovičova 300/3, 069 01 Snina",
    ico: "36 509 108",
    dic: "2022075770",
    phone: "+421 57 766 01 11",
    reception: "057 / 7871 200",
    pharmacy: "057 / 7871 233",
    regTitle: { sk: "Obchodný register Okresného súdu Prešov, odd. Sro, vložka č. 16588/P", en: "Commercial Register, Prešov District Court, Section Sro, File No. 16588/P" },
    emergency: "112",
    email: "sekretariat@nemocnicasnina.sk",
    region: { sk: "Spádová oblasť Snina a Prešovský kraj", en: "Snina district & Prešov region" }
  },

  pages: {
    hero: {
      badge: { sk: "Prijímame nových pacientov · Urológia & Angiológia", en: "Accepting new patients · Urology & Angiology" },
      title: { sk: "Moderná nemocnica pre náš región", en: "A modern hospital for our region" },
      subtitle: {
        sk: "Poskytujeme ústavnú a ambulantnú zdravotnú starostlivosť pre obyvateľov Sniny a okolia — s obnovenými oddeleniami, novou diagnostikou a centrálnou recepciou, ktorá vás prevedie celou návštevou.",
        en: "We provide inpatient and outpatient care for the people of Snina and the surrounding district — with renovated wards, new diagnostics, and a central reception that guides you through every visit."
      }
    },
    about: {
      title: { sk: "O nemocnici", en: "About the hospital" },
      body: {
        sk: "Nemocnica Snina, s.r.o. je spoločnosť vo vlastníctve mesta Snina a tvorí dôležitý pilier zdravotnej starostlivosti pre okres Snina a širší Prešovský región. V posledných rokoch sme významne investovali do modernizácie — od centrálnej recepcie (september 2024), cez novú diagnostickú techniku, až po rozšírenie špecializovaných ambulancií, ako sú urológia a angiológia. Sme organizátorom ambulantnej pohotovostnej služby (APS) pre dospelých aj deti v okrese.",
        en: "Nemocnica Snina, s.r.o. is a company owned by the City of Snina and a vital pillar of healthcare for the Snina district and the wider Prešov region. In recent years we have invested heavily in modernisation — from a central reception (September 2024), to new diagnostic technology, to expanded specialised clinics such as urology and angiology. We are the organiser of the ambulatory emergency service (APS) for adults and children in the district."
      }
    },
    aps: {
      title: { sk: "Ambulantná pohotovostná služba (APS)", en: "Ambulatory Emergency Service (APS)" },
      note: {
        sk: "Nemocnica je organizátorom APS pre dospelých aj deti v okrese Snina. Pri ohrození života vždy volajte 112.",
        en: "The hospital organises the APS for adults and children in the Snina district. In a life-threatening emergency always call 112."
      }
    }
  },

  /* ---------------- Inpatient departments ---------------- */
  departments: [
    {
      id: "chirurgia",
      name: { sk: "Chirurgicko-traumatologické oddelenie", en: "Surgery & Traumatology" },
      short: { sk: "Chirurgia a traumatológia", en: "Surgery & Trauma" },
      lead: "MUDr. Andrej Kulan",
      leadRole: { sk: "Primár", en: "Head of Department" },
      deputy: "MUDr. Marek Andraščík",
      beds: 47,
      phone: "057 / 7871 218",
      email: "chirurgia@nemocnicasnina.sk",
      featured: true,
      summary: {
        sk: "Komplexná chirurgická a úrazová starostlivosť. V marci 2024 sme zaviedli nové laparoskopické a traumatologické metódy.",
        en: "Comprehensive surgical and trauma care. In March 2024 we introduced new laparoscopic and trauma methodologies."
      },
      desc: {
        sk: "Spojené chirurgicko-traumatologické oddelenie je jedným z hlavných pilierov nemocnice. Pod vedením primára MUDr. Andreja Kulana sme rozšírili portfólio operačných výkonov — vrátane miniinvazívnej laparoskopie. Disponujeme obnovenými operačnými sálami a úzko spolupracujeme s OAIM a úrazovou ambulanciou.",
        en: "The combined surgery & traumatology department is one of the hospital's primary pillars. Under head physician MUDr. Andrej Kulan we have expanded our portfolio of procedures — including minimally-invasive laparoscopy. We operate renovated theatres and work closely with the OAIM and trauma clinic."
      },
      facilities: { sk: ["Obnovené operačné sály", "Septická a aseptická chirurgia", "Miniinvazívna laparoskopia", "Úrazová ambulancia"], en: ["Renovated operating theatres", "Septic & aseptic surgery", "Minimally-invasive laparoscopy", "Trauma clinic"] },
      visiting: { sk: "Denne 14:00 – 16:00 a 18:00 – 19:00", en: "Daily 14:00 – 16:00 and 18:00 – 19:00" }
    },
    {
      id: "interne",
      name: { sk: "Interné oddelenie", en: "Internal Medicine" },
      short: { sk: "Interné", en: "Internal Medicine" },
      lead: "MUDr. Jana Borščová",
      leadRole: { sk: "Primárka", en: "Head of Department" },
      deputy: "Mgr. Citrjaková",
      deputyRole: { sk: "Vedúca sestra", en: "Head Nurse" },
      beds: 57,
      phone: "057 / 7871 240",
      email: "interne@nemocnicasnina.sk",
      featured: true,
      summary: {
        sk: "Najväčšie oddelenie nemocnice so špecializovanou jednotkou intenzívnej starostlivosti (JIS).",
        en: "The hospital's largest department, with a dedicated Intensive Care Unit (JIS)."
      },
      desc: {
        sk: "Interné oddelenie pokrýva širokú internú patológiu — od kardiopulmonálnych ochorení po metabolické stavy. Súčasťou je jednotka intenzívnej starostlivosti (JIS) pre akútne stavy a štandardné lôžkové izby. Prístup na JIS je obmedzený; návštevné pravidlá sú zverejnené nižšie.",
        en: "Internal Medicine covers broad internal pathology — from cardiopulmonary disease to metabolic conditions. It includes an Intensive Care Unit (JIS) for acute states and standard ward beds. Access to the JIS is restricted; visiting rules are published below."
      },
      facilities: { sk: ["Jednotka intenzívnej starostlivosti (JIS)", "Štandardné lôžkové izby", "Príjmová interná ambulancia", "Kardiologická diagnostika"], en: ["Intensive Care Unit (JIS)", "Standard ward beds", "Internal admission clinic", "Cardiology diagnostics"] },
      visiting: { sk: "Denne 14:30 – 16:30 · JIS po dohode so službukonajúcim lekárom", en: "Daily 14:30 – 16:30 · ICU by arrangement with the duty physician" }
    },
    {
      id: "gynekologia",
      name: { sk: "Gynekologicko-pôrodnícke oddelenie", en: "Gynecology & Obstetrics" },
      short: { sk: "Gynekológia a pôrodníctvo", en: "Gynecology & Obstetrics" },
      lead: "MUDr. František Pavlovčin",
      leadRole: { sk: "Primár", en: "Head of Department" },
      beds: 30,
      phone: "057 / 7871 231",
      email: "gynekologia@nemocnicasnina.sk",
      delivery: "057 / 7871 279",
      featured: true,
      summary: {
        sk: "Starostlivosť o ženu v každom veku a humanizované pôrodníctvo s možnosťou prítomnosti blízkej osoby.",
        en: "Care for women at every age and humanised childbirth, with the option of a companion present."
      },
      desc: {
        sk: "Naše pôrodnícke oddelenie kladie dôraz na humanizovaný a bezpečný pôrod — moderné pôrodné sály, možnosť prítomnosti partnera a starostlivosť o novorodenca priamo pri matke. Pripravili sme aj stiahnuteľný Pôrodný plán a informácie o neonatológii.",
        en: "Our maternity department emphasises a humanised, safe birth — modern delivery rooms, the option for a partner to be present, and newborn care right beside the mother. We also provide a downloadable Birth Plan and neonatology information."
      },
      facilities: { sk: ["Moderné pôrodné sály", "Prítomnosť blízkej osoby pri pôrode", "Rooming-in s novorodencom", "Stiahnuteľný pôrodný plán"], en: ["Modern delivery rooms", "Companion present at birth", "Rooming-in with the newborn", "Downloadable birth plan"] },
      visiting: { sk: "Denne 15:00 – 17:00 · oddelenie šestonedelia individuálne", en: "Daily 15:00 – 17:00 · postnatal ward individually" }
    },
    {
      id: "pediatria",
      name: { sk: "Detské oddelenie", en: "Pediatrics" },
      short: { sk: "Pediatria", en: "Pediatrics" },
      lead: "MUDr. Miroslava Seňková, MBA",
      leadRole: { sk: "Primárka", en: "Head of Department" },
      beds: 15,
      phone: "057 / 7871 278",
      email: "pediatria@nemocnicasnina.sk",
      featured: false,
      summary: {
        sk: "Starostlivosť o deti od novorodencov po dorast, s možnosťou pobytu rodiča (rooming-in).",
        en: "Care for children from newborns to adolescents, with the option for a parent to stay (rooming-in)."
      },
      desc: {
        sk: "Detské oddelenie poskytuje diagnostiku a liečbu akútnych aj chronických ochorení detského veku. Umožňujeme pobyt rodiča s dieťaťom (rooming-in) — najčastejšiu otázku rodičov zodpovedáme priamo tu.",
        en: "Pediatrics provides diagnosis and treatment of acute and chronic childhood conditions. We allow a parent to stay with the child (rooming-in) — the most frequent parental question, answered right here."
      },
      facilities: { sk: ["Rooming-in pre rodičov", "Detská JIS-ka pre akútne stavy", "Herňa a priestor pre deti", "Spolupráca s neonatológiou"], en: ["Rooming-in for parents", "Pediatric acute care beds", "Playroom & child-friendly space", "Neonatology cooperation"] },
      visiting: { sk: "Rodičia neobmedzene pri rooming-in · ostatní 14:00 – 17:00", en: "Parents unrestricted with rooming-in · others 14:00 – 17:00" }
    },
    {
      id: "neonatologia",
      name: { sk: "Novorodenecké oddelenie", en: "Neonatal Unit" },
      short: { sk: "Neonatológia", en: "Neonatology" },
      lead: "Tím neonatológie",
      leadRole: { sk: "Ošetrujúci personál", en: "Attending staff" },
      beds: 10,
      phone: "057 / 7871 279",
      featured: false,
      summary: {
        sk: "Špecializovaná starostlivosť o novorodencov v úzkej spolupráci s pôrodníctvom.",
        en: "Specialised care for newborns in close cooperation with obstetrics."
      },
      desc: {
        sk: "Novorodenecké oddelenie zabezpečuje starostlivosť o fyziologických aj rizikových novorodencov bezprostredne po pôrode, s dôrazom na kontakt matky a dieťaťa.",
        en: "The neonatal unit cares for both physiological and at-risk newborns immediately after birth, with emphasis on mother–child contact."
      },
      facilities: { sk: ["Starostlivosť o fyziologického novorodenca", "Resuscitačný kútik", "Podpora dojčenia"], en: ["Physiological newborn care", "Resuscitation corner", "Breastfeeding support"] },
      visiting: { sk: "V rámci oddelenia šestonedelia", en: "Within the postnatal ward" }
    },
    {
      id: "oaim",
      name: { sk: "Oddelenie anestéziológie a intenzívnej medicíny (OAIM)", en: "Anesthesiology & Intensive Care (OAIM)" },
      short: { sk: "OAIM", en: "OAIM" },
      lead: "MUDr. Norbert Orinín",
      leadRole: { sk: "Primár", en: "Head of Department" },
      beds: 4,
      phone: "057 / 7871 242",
      featured: false,
      summary: {
        sk: "Resuscitačná a intenzívna starostlivosť o najkritickejších pacientov a perioperačná anestézia.",
        en: "Resuscitation and intensive care for the most critical patients, and perioperative anaesthesia."
      },
      desc: {
        sk: "OAIM zabezpečuje anestéziu pri operačných výkonoch a intenzívnu starostlivosť o pacientov v kritickom stave. Obsah pre verejnosť je informačný — uvádzame kontakty pre rodinných príslušníkov hospitalizovaných pacientov.",
        en: "The OAIM provides anaesthesia for surgical procedures and intensive care for critically-ill patients. Public content here is informational — we list contacts for family members of hospitalised patients."
      },
      facilities: { sk: ["Resuscitačné lôžka", "Perioperačná anestéziológia", "Monitorovanie vitálnych funkcií"], en: ["Resuscitation beds", "Perioperative anaesthesiology", "Vital-sign monitoring"] },
      visiting: { sk: "Iba po dohode so službukonajúcim lekárom", en: "Only by arrangement with the duty physician" }
    },
    {
      id: "fro",
      name: { sk: "Fyziatricko-rehabilitačné oddelenie (FRO)", en: "Physiatry & Rehabilitation (FRO)" },
      short: { sk: "Rehabilitácia", en: "Rehabilitation" },
      lead: "MUDr. Natália Kyjovská",
      leadRole: { sk: "Primárka", en: "Head of Department" },
      beds: 0,
      phone: "057 / 7871 237",
      email: "fro@nemocnicasnina.sk",
      featured: true,
      summary: {
        sk: "Liečebná rehabilitácia, fyzikálna terapia a individuálny pohybový program. Možnosť online objednania.",
        en: "Therapeutic rehabilitation, physical therapy and individual exercise programmes. Online booking available."
      },
      desc: {
        sk: "FRO poskytuje fyzikálnu liečbu, elektroliečbu, vodoliečbu a individuálny liečebný telocvik. Pre opakované rehabilitačné termíny odporúčame online objednávkový systém, ktorý uľahčuje plánovanie pravidelných sedení.",
        en: "The FRO provides physical therapy, electrotherapy, hydrotherapy and individual therapeutic exercise. For recurring rehabilitation appointments we recommend the online booking system, which makes scheduling regular sessions easier."
      },
      facilities: { sk: ["Elektroliečba a magnetoterapia", "Vodoliečba", "Individuálny liečebný telocvik", "Online objednávanie termínov"], en: ["Electrotherapy & magnetotherapy", "Hydrotherapy", "Individual therapeutic exercise", "Online appointment booking"] },
      visiting: { sk: "Ambulantná prevádzka — podľa objednania", en: "Outpatient operation — by appointment" }
    }
  ],

  /* ---------------- Outpatient clinics (ambulancie) ---------------- */
  clinics: [
    {
      id: "urazova-chirurgia",
      name: { sk: "Ambulancia úrazovej chirurgie", en: "Trauma Surgery Clinic" },
      specialty: { sk: "Úrazová chirurgia", en: "Trauma surgery" },
      doctor: "MUDr. Lukáš Harmaňoš",
      nurse: "Radoslava Pauliková",
      location: { sk: "Prízemie · meracie miesto protetiky „Neoprot“", en: "Ground floor · 'Neoprot' prosthetics measuring point" },
      phone: "057 / 7871 218",
      status: "open",
      bookable: true,
      referral: false,
      schedule: { sk: ["Utorok & Štvrtok 09:00 – 14:00", "Protetika: Ut/Št 08:00 – 10:30"], en: ["Tuesday & Thursday 09:00 – 14:00", "Prosthetics: Tue/Thu 08:00 – 10:30"] },
      bookingDays: [2, 4],
      bookingRule: { sk: "Termíny len v utorok a štvrtok. Pondelok, streda a piatok sú zablokované.", en: "Appointments Tuesday & Thursday only. Monday, Wednesday and Friday are blocked." }
    },
    {
      id: "chirurgicka",
      name: { sk: "Chirurgická ambulancia", en: "General Surgery Clinic" },
      specialty: { sk: "Všeobecná chirurgia", en: "General surgery" },
      doctor: "MUDr. Marek Andraščík, MUDr. M. Brečka, MUDr. L. Alušík",
      location: { sk: "Prízemie", en: "Ground floor" },
      phone: "057 / 7871 254",
      status: "open",
      bookable: true,
      referral: false,
      schedule: { sk: ["Pondelok – Piatok 07:00 – 15:00", "Pohotovosť (APS): nepretržite 24/7"], en: ["Monday – Friday 07:00 – 15:00", "Emergency (APS): continuous 24/7"] },
      bookingDays: [1, 2, 3, 4, 5],
      fee: { sk: "Poplatok za pohotovostné použitie (LSPP): 1,99 €", en: "Emergency-use fee (LSPP): €1.99" },
      bookingRule: { sk: "Štandardné objednávanie počas pracovných dní. Akútne stavy ošetríme nepretržite cez APS.", en: "Standard booking on weekdays. Acute cases treated continuously via APS." }
    },
    {
      id: "urologicka",
      name: { sk: "Urologická ambulancia", en: "Urology Clinic" },
      specialty: { sk: "Urológia", en: "Urology" },
      doctor: "MUDr. Patrik Nebesník",
      nurse: "M. Polačková",
      location: { sk: "Budova polikliniky · 2. poschodie", en: "Polyclinic building · 2nd floor" },
      phone: "057 / 7871 228",
      status: "new",
      acceptingNew: true,
      bookable: true,
      referral: true,
      schedule: { sk: ["Pondelok – Piatok 07:00 – 15:00"], en: ["Monday – Friday 07:00 – 15:00"] },
      bookingDays: [1, 2, 3, 4, 5],
      opened: "2024-10-01",
      bookingRule: { sk: "Nová ambulancia (otvorená 1. 10. 2024). Aktívne prijíma nových pacientov.", en: "New clinic (opened 1 Oct 2024). Actively accepting new patients." }
    },
    {
      id: "angiologicka",
      name: { sk: "Angiologická ambulancia", en: "Angiology Clinic" },
      specialty: { sk: "Angiológia (cievne ochorenia)", en: "Angiology (vascular)" },
      doctor: "MUDr. Juraj Miko",
      nurse: "Bc. Edita Barnová",
      location: { sk: "Prízemie · priestory interného oddelenia", en: "Ground floor · internal medicine premises" },
      phone: "057 / 7871 285",
      status: "new",
      acceptingNew: true,
      bookable: true,
      referral: true,
      schedule: { sk: ["Ordinačné hodiny: Po – Str 07:00 – 15:00", "Objednávanie LEN Štv/Pia 13:00 – 14:00"], en: ["Clinic hours: Mon – Wed 07:00 – 15:00", "Booking ONLY Thu/Fri 13:00 – 14:00"] },
      bookingDays: [4, 5],
      bookingWindow: "13:00–14:00",
      referralRequired: true,
      bookingRule: { sk: "Objednať sa možno iba vo štvrtok a piatok medzi 13:00 – 14:00. Vyžaduje sa výmenný lístok.", en: "Booking is possible only Thursday & Friday between 13:00 – 14:00. A referral (výmenný lístok) is required." }
    },
    {
      id: "neurologicka",
      name: { sk: "Neurologická ambulancia", en: "Neurology Clinic" },
      specialty: { sk: "Neurológia", en: "Neurology" },
      doctor: "MUDr. Kičik",
      location: { sk: "Budova polikliniky", en: "Polyclinic building" },
      phone: "0918 088 183",
      status: "alert",
      bookable: false,
      referral: true,
      schedule: { sk: ["Dočasný režim — kontaktujte na uvedenom čísle"], en: ["Temporary measures — contact on the number listed"] },
      bookingRule: { sk: "Ambulancia funguje v dočasnom režime s náhradným kontaktom. Sledujte aktuálne oznamy.", en: "The clinic operates under temporary measures with a substitute contact. Watch the announcements." }
    },
    {
      id: "hematologicka",
      name: { sk: "Hematologická ambulancia", en: "Hematology Clinic" },
      specialty: { sk: "Hematológia", en: "Hematology" },
      doctor: "MUDr. Viera Coraničová",
      location: { sk: "Budova Revital Plus · 1. poschodie (nad lekárňou)", en: "Revital Plus building · 1st floor (above the pharmacy)" },
      phone: "057 / 7871 284",
      status: "open",
      bookable: true,
      referral: true,
      schedule: { sk: ["Pondelok – Štvrtok 07:00 – 15:00", "Piatok zatvorené"], en: ["Monday – Thursday 07:00 – 15:00", "Friday closed"] },
      bookingDays: [1, 2, 3, 4],
      bookingRule: { sk: "Pozor: ambulancia sídli mimo hlavnej budovy. Piatok je zatvorené.", en: "Note: this clinic is located outside the main building. Closed on Friday." }
    },
    {
      id: "diabetologicka",
      name: { sk: "Diabetologická ambulancia", en: "Diabetology Clinic" },
      specialty: { sk: "Diabetológia", en: "Diabetology" },
      doctor: "MUDr. Lenka Lajtarová",
      location: { sk: "Areál nemocnice", en: "Hospital complex" },
      status: "closed",
      bookable: false,
      referral: true,
      schedule: { sk: ["Dočasne mimo prevádzky / obmedzená prevádzka"], en: ["Temporarily closed / limited operation"] },
      bookingRule: { sk: "Ambulancia je dočasne mimo prevádzky — online objednávanie je pozastavené.", en: "The clinic is temporarily closed — online booking is suspended." }
    },
    {
      id: "vnutorne-lekarstvo",
      name: { sk: "Ambulancia vnútorného lekárstva", en: "Internal Medicine Clinic" },
      specialty: { sk: "Vnútorné lekárstvo", en: "Internal medicine" },
      doctor: "MUDr. Jana Borščová",
      location: { sk: "Prízemie", en: "Ground floor" },
      phone: "057 / 7871 285",
      status: "open",
      bookable: true,
      referral: true,
      schedule: { sk: ["Príjmová ambulancia interného oddelenia", "Pondelok – Piatok 07:00 – 15:00"], en: ["Admission clinic for Internal Medicine", "Monday – Friday 07:00 – 15:00"] },
      bookingDays: [1, 2, 3, 4, 5],
      bookingRule: { sk: "Príjmová ambulancia interného oddelenia.", en: "Admission clinic for the Internal Medicine department." }
    }
  ],

  /* ---------------- Physicians directory ---------------- */
  physicians: [
    { id: "kulan", name: "MUDr. Andrej Kulan", role: { sk: "Primár · Chirurgia a traumatológia", en: "Head · Surgery & Traumatology" }, dept: "chirurgia", langs: ["SK", "EN"], accepting: false, bio: { sk: "Primár chirurgicko-traumatologického oddelenia. Venuje sa všeobecnej a miniinvazívnej chirurgii.", en: "Head of the surgery & traumatology department, focusing on general and minimally-invasive surgery." } },
    { id: "andrascik", name: "MUDr. Marek Andraščík", role: { sk: "Zástupca primára · Chirurgia", en: "Deputy head · Surgery" }, dept: "chirurgia", langs: ["SK"], accepting: false, bio: { sk: "Zástupca primára, všeobecná a úrazová chirurgia.", en: "Deputy head; general and trauma surgery." } },
    { id: "borscova", name: "MUDr. Jana Borščová", role: { sk: "Primárka · Interné oddelenie", en: "Head · Internal Medicine" }, dept: "interne", langs: ["SK", "EN"], accepting: true, bio: { sk: "Primárka interného oddelenia a vnútorného lekárstva.", en: "Head of internal medicine and the internal admission clinic." } },
    { id: "pavlovcin", name: "MUDr. František Pavlovčin", role: { sk: "Primár · Gynekológia a pôrodníctvo", en: "Head · Gynecology & Obstetrics" }, dept: "gynekologia", langs: ["SK"], accepting: true, bio: { sk: "Primár gynekologicko-pôrodníckeho oddelenia.", en: "Head of the gynecology & obstetrics department." } },
    { id: "senkova", name: "MUDr. Miroslava Seňková, MBA", role: { sk: "Primárka · Detské oddelenie", en: "Head · Pediatrics" }, dept: "pediatria", langs: ["SK", "EN"], accepting: true, bio: { sk: "Primárka detského oddelenia.", en: "Head of the pediatrics department." } },
    { id: "orinin", name: "MUDr. Norbert Orinín", role: { sk: "Primár · OAIM", en: "Head · OAIM" }, dept: "oaim", langs: ["SK"], accepting: false, bio: { sk: "Primár oddelenia anestéziológie a intenzívnej medicíny.", en: "Head of anesthesiology & intensive care." } },
    { id: "kyjovska", name: "MUDr. Natália Kyjovská", role: { sk: "Primárka · Rehabilitácia (FRO)", en: "Head · Rehabilitation (FRO)" }, dept: "fro", langs: ["SK"], accepting: true, bio: { sk: "Primárka fyziatricko-rehabilitačného oddelenia.", en: "Head of the physiatry & rehabilitation department." } },
    { id: "harmanos", name: "MUDr. Lukáš Harmaňoš", role: { sk: "Úrazová chirurgia", en: "Trauma surgery" }, dept: "chirurgia", clinic: "urazova-chirurgia", langs: ["SK"], accepting: false, bio: { sk: "Lekár úrazovej chirurgickej ambulancie.", en: "Physician at the trauma surgery clinic." } },
    { id: "nebesnik", name: "MUDr. Patrik Nebesník", role: { sk: "Urológ", en: "Urologist" }, clinic: "urologicka", langs: ["SK", "EN"], accepting: true, bio: { sk: "Vedie novú urologickú ambulanciu, ktorá aktívne prijíma nových pacientov.", en: "Leads the new urology clinic, which is actively accepting new patients." } },
    { id: "miko", name: "MUDr. Juraj Miko", role: { sk: "Angiológ", en: "Angiologist" }, clinic: "angiologicka", langs: ["SK"], accepting: true, bio: { sk: "Angiológ — diagnostika a liečba cievnych ochorení. Vyžaduje sa výmenný lístok.", en: "Angiologist — diagnosis and treatment of vascular disease. A referral is required." } },
    { id: "kicik", name: "MUDr. Kičik", role: { sk: "Neurológ", en: "Neurologist" }, clinic: "neurologicka", langs: ["SK"], accepting: false, bio: { sk: "Neurologická ambulancia v dočasnom režime.", en: "Neurology clinic operating under temporary measures." } },
    { id: "coranicova", name: "MUDr. Viera Coraničová", role: { sk: "Hematológia · Laboratórna medicína", en: "Hematology · Laboratory Medicine" }, clinic: "hematologicka", langs: ["SK"], accepting: true, bio: { sk: "Vedie hematologickú ambulanciu a oddelenie laboratórnej medicíny.", en: "Leads the hematology clinic and the department of laboratory medicine." } },
    { id: "lajtarova", name: "MUDr. Lenka Lajtarová", role: { sk: "Diabetológia", en: "Diabetology" }, clinic: "diabetologicka", langs: ["SK"], accepting: false, bio: { sk: "Diabetologická ambulancia — dočasne mimo prevádzky.", en: "Diabetology clinic — temporarily closed." } },
    { id: "lajtar", name: "MUDr. Michal Lajtar", role: { sk: "Rádiodiagnostika", en: "Radiodiagnostics" }, facility: "rdg", langs: ["SK"], accepting: false, bio: { sk: "Vedie rádiodiagnostické oddelenie (CT, RTG, USG).", en: "Leads the radiodiagnostic department (CT, X-ray, ultrasound)." } }
  ],

  /* ---------------- Services & clinical practices ---------------- */
  services: [
    { id: "laparoskopia", name: { sk: "Miniinvazívna laparoskopia", en: "Minimally-invasive laparoscopy" }, dept: "chirurgia", icon: "scalpel", desc: { sk: "Nové laparoskopické metódy zavedené v marci 2024 — kratšia rekonvalescencia a menšie jazvy.", en: "New laparoscopic methods introduced March 2024 — shorter recovery and smaller scars." } },
    { id: "porod", name: { sk: "Humanizovaný pôrod", en: "Humanised childbirth" }, dept: "gynekologia", icon: "heart", desc: { sk: "Moderné pôrodné sály, prítomnosť blízkej osoby a starostlivosť o novorodenca pri matke.", en: "Modern delivery rooms, a companion present, and newborn care beside the mother." } },
    { id: "rehab", name: { sk: "Liečebná rehabilitácia", en: "Therapeutic rehabilitation" }, dept: "fro", icon: "activity", desc: { sk: "Fyzikálna terapia, elektroliečba, vodoliečba a individuálny liečebný telocvik.", en: "Physical therapy, electrotherapy, hydrotherapy and individual exercise programmes." } },
    { id: "urologia", name: { sk: "Urologická starostlivosť", en: "Urological care" }, clinic: "urologicka", icon: "stethoscope", desc: { sk: "Nová ambulancia prijímajúca pacientov — diagnostika a liečba ochorení močových ciest.", en: "A new clinic accepting patients — diagnosis and treatment of urinary-tract conditions." } },
    { id: "angio", name: { sk: "Cievna (angiologická) diagnostika", en: "Vascular (angiology) diagnostics" }, clinic: "angiologicka", icon: "pulse", desc: { sk: "Vyšetrenie a liečba cievnych ochorení. Vyžaduje sa výmenný lístok.", en: "Examination and treatment of vascular disease. A referral is required." } },
    { id: "intenzivna", name: { sk: "Intenzívna a resuscitačná starostlivosť", en: "Intensive & resuscitation care" }, dept: "oaim", icon: "shield", desc: { sk: "Resuscitačné lôžka OAIM a jednotka intenzívnej starostlivosti (JIS) interného oddelenia.", en: "OAIM resuscitation beds and the Internal Medicine intensive care unit (JIS)." } },
    { id: "lab", name: { sk: "Laboratórna diagnostika", en: "Laboratory diagnostics" }, facility: "lab", icon: "flask", desc: { sk: "Klinická biochémia a hematológia s možnosťou stiahnutia výsledkov online.", en: "Clinical biochemistry and hematology, with results downloadable online." } },
    { id: "zobrazovanie", name: { sk: "Zobrazovacia diagnostika", en: "Imaging diagnostics" }, facility: "rdg", icon: "scan", desc: { sk: "CT, RTG a ultrazvuk (USG) s prípravou pre externých pacientov.", en: "CT, X-ray and ultrasound (USG), with preparation guidance for external patients." } }
  ],

  /* ---------------- Diagnostic & support facilities (SVaLZ) ---------------- */
  facilities: [
    {
      id: "lab",
      name: { sk: "Oddelenie laboratórnej medicíny", en: "Department of Laboratory Medicine" },
      lead: "MUDr. Viera Coraničová",
      phone: "057 / 7871 284",
      kind: { sk: "Klinická biochémia · Hematológia", en: "Clinical biochemistry · Hematology" },
      desc: { sk: "Komplexná laboratórna diagnostika. Pacienti si môžu výsledky bezpečne stiahnuť online — bez nutnosti vracať sa po papierový výsledok.", en: "Comprehensive laboratory diagnostics. Patients can securely download results online — no need to return for a paper report." },
      features: { sk: ["Klinická biochémia", "Hematológia", "Bezpečné stiahnutie výsledkov (PDF)"], en: ["Clinical biochemistry", "Hematology", "Secure result download (PDF)"] }
    },
    {
      id: "rdg",
      name: { sk: "Rádiodiagnostické oddelenie", en: "Radiodiagnostic Department" },
      lead: "MUDr. Michal Lajtar",
      phone: "057 / 7871 219",
      kind: { sk: "CT · RTG · Ultrazvuk (USG)", en: "CT · X-ray · Ultrasound (USG)" },
      desc: { sk: "Moderné zobrazovacie metódy. Pre externých pacientov uvádzame presné pokyny na prípravu (napr. CT s kontrastnou látkou).", en: "Modern imaging methods. For external patients we provide precise preparation instructions (e.g. CT with contrast)." },
      features: { sk: ["Počítačová tomografia (CT)", "RTG", "Ultrazvuk (USG)", "Pokyny pre externých pacientov"], en: ["Computed tomography (CT)", "X-ray (RTG)", "Ultrasound (USG)", "Instructions for external patients"] }
    },
    {
      id: "recepcia",
      name: { sk: "Centrálna recepcia", en: "Central Reception" },
      phone: "057 / 7871 200",
      kind: { sk: "Prvý kontakt · v prevádzke od 1. 9. 2024", en: "First point of contact · operating since 1 Sep 2024" },
      desc: { sk: "Centrálna recepcia vás prevedie celou návštevou a nasmeruje na správne pracovisko. Web je „prvou líniou“ tejto recepcie.", en: "The central reception guides you through your whole visit and directs you to the right department. This website is the 'first line' of that reception." },
      features: { sk: ["Navigácia po areáli", "Smerovanie na oddelenia", "Informácie pre návštevy"], en: ["Campus navigation", "Routing to departments", "Visitor information"] }
    },
    {
      id: "lekaren",
      name: { sk: "Nemocničná lekáreň", en: "Hospital Pharmacy" },
      phone: "057 / 7871 232",
      kind: { sk: "Výdaj liekov · v areáli nemocnice", en: "Dispensing · within the hospital complex" },
      desc: { sk: "Lekáreň v areáli nemocnice s otváracími hodinami zosúladenými s ambulanciami.", en: "A pharmacy within the hospital complex, with opening hours aligned to the clinics." },
      features: { sk: ["Výdaj na recept aj voľnopredajný", "Hodiny zosúladené s ambulanciami"], en: ["Prescription & OTC dispensing", "Hours aligned with clinics"] }
    }
  ],

  /* ---------------- News & announcements ---------------- */
  news: [
    { id: "n-urologia", date: "2024-10-01", tag: { sk: "Nová ambulancia", en: "New clinic" }, type: "good", title: { sk: "Otvorili sme urologickú ambulanciu", en: "Urology clinic now open" }, body: { sk: "Od 1. októbra 2024 je v budove polikliniky v prevádzke nová urologická ambulancia pod vedením MUDr. Patrika Nebesníka. Ambulancia aktívne prijíma nových pacientov.", en: "From 1 October 2024 a new urology clinic, led by MUDr. Patrik Nebesník, operates in the polyclinic building. The clinic is actively accepting new patients." } },
    { id: "n-recepcia", date: "2024-09-01", tag: { sk: "Prevádzka", en: "Operations" }, type: "info", title: { sk: "Spustili sme centrálnu recepciu", en: "Central reception launched" }, body: { sk: "Od 1. septembra 2024 funguje centrálna recepcia, ktorá pacientov nasmeruje a odbremení čakárne. Web sa stáva prvou líniou tejto recepcie.", en: "Since 1 September 2024 a central reception directs patients and relieves the waiting areas. The website becomes the first line of this reception." } },
    { id: "n-angio", date: "2024-08-15", tag: { sk: "Nová ambulancia", en: "New clinic" }, type: "good", title: { sk: "Angiologická ambulancia rozširuje cievnu diagnostiku", en: "Angiology clinic expands vascular diagnostics" }, body: { sk: "Nová angiologická ambulancia rozširuje možnosti diagnostiky a liečby cievnych ochorení. Objednávanie prebieha vo štvrtok a piatok 13:00 – 14:00, vyžaduje sa výmenný lístok.", en: "The new angiology clinic expands diagnosis and treatment of vascular disease. Booking takes place Thursday & Friday 13:00 – 14:00; a referral is required." } },
    { id: "n-laparo", date: "2024-03-12", tag: { sk: "Chirurgia", en: "Surgery" }, type: "good", title: { sk: "Nové laparoskopické a traumatologické metódy", en: "New laparoscopic & trauma methods" }, body: { sk: "Chirurgicko-traumatologické oddelenie zaviedlo nové miniinvazívne laparoskopické a traumatologické postupy, ktoré skracujú rekonvalescenciu pacientov.", en: "The surgery & traumatology department has introduced new minimally-invasive laparoscopic and trauma procedures that shorten patient recovery." } },
    { id: "n-neuro", date: "2024-06-03", tag: { sk: "Oznam", en: "Notice" }, type: "alert", title: { sk: "Neurologická ambulancia — dočasný režim", en: "Neurology clinic — temporary measures" }, body: { sk: "Neurologická ambulancia funguje v dočasnom režime. Pacientov prosíme, aby využívali náhradný kontakt 0918 088 183. O obnovení štandardnej prevádzky budeme informovať.", en: "The neurology clinic operates under temporary measures. Please use the substitute contact 0918 088 183. We will announce the return to standard operation." } }
  ],

  /* ---------------- Public disclosures (Zverejňovanie) ---------------- */
  disclosures: [
    { id: "ZML-2024-051", type: { sk: "Zmluva", en: "Contract" }, partner: "Siemens Healthineers — servis CT/MRI", value: "45 000 € / rok", date: "2024-09-20" },
    { id: "FAK-2024-318", type: { sk: "Faktúra", en: "Invoice" }, partner: "MedTech Medical Supplies, a.s.", value: "12 450,00 €", date: "2024-10-15" },
    { id: "ZML-2024-047", type: { sk: "Zmluva", en: "Contract" }, partner: "Východoslovenská energetika, a.s.", value: "—", date: "2024-08-01" },
    { id: "FAK-2024-302", type: { sk: "Faktúra", en: "Invoice" }, partner: "Slovak Energy Corp.", value: "8 200,00 €", date: "2024-10-10" },
    { id: "ZML-2024-039", type: { sk: "Zmluva", en: "Contract" }, partner: "Rekonštrukcia operačných sál — STAVON s.r.o.", value: "318 000,00 €", date: "2024-02-28" },
    { id: "FAK-2024-281", type: { sk: "Faktúra", en: "Invoice" }, partner: "B. Braun Medical s.r.o. — spotrebný materiál", value: "6 740,50 €", date: "2024-09-30" }
  ],

  /* ---------------- Patient portal mock data ---------------- */
  patient: {
    name: "Jozef Mak",
    id: "850315/1234",
    dob: "1985-03-15",
    blood: "A+",
    insurance: "VšZP (25)",
    conditions: [
      { id: "c1", date: "2024-10-12", code: "I10", dx: { sk: "Esenciálna (primárna) hypertenzia", en: "Essential (primary) hypertension" }, status: "active", doctor: "MUDr. Jana Borščová" },
      { id: "c2", date: "2022-04-05", code: "E11", dx: { sk: "Diabetes mellitus 2. typu", en: "Type 2 diabetes mellitus" }, status: "active", doctor: "MUDr. Lenka Lajtarová" }
    ],
    meds: [
      { id: "m1", date: "2024-10-12", name: "Nebivolol 5 mg", dose: { sk: "1× denne (ráno)", en: "1× daily (morning)" }, refills: 2 },
      { id: "m2", date: "2024-09-20", name: "Metformín 850 mg", dose: { sk: "2× denne (s jedlom)", en: "2× daily (with meals)" }, refills: 1 }
    ],
    labs: [
      { id: "l1", date: "2024-09-28", test: { sk: "Lipidový profil", en: "Lipid panel" }, result: { sk: "Cholesterol 5,8 mmol/l", en: "Cholesterol 5.8 mmol/l" }, flag: "high", dept: { sk: "Klinická biochémia", en: "Clinical biochem" } },
      { id: "l2", date: "2024-09-28", test: { sk: "HbA1c", en: "HbA1c" }, result: { sk: "48 mmol/mol (6,5 %)", en: "48 mmol/mol (6.5%)" }, flag: "normal", dept: { sk: "Klinická biochémia", en: "Clinical biochem" } }
    ],
    appointments: [
      { id: "a1", date: "2024-11-15", time: "09:30", clinic: { sk: "Diabetologická ambulancia", en: "Diabetology clinic" }, doctor: "MUDr. Lenka Lajtarová" }
    ]
  },

  /* ---------------- Pre pacientov — pricing, waits, testimonials ---------------- */
  patientInfo: {
    pricing: [
      { id: "p1", category: { sk: "Klinická biochémia", en: "Clinical biochemistry" }, item: { sk: "Základný biochemický panel (samoplatca)", en: "Basic biochemistry panel (self-pay)" }, price: "18,00 €" },
      { id: "p2", category: { sk: "Klinická biochémia", en: "Clinical biochemistry" }, item: { sk: "Lipidový profil", en: "Lipid panel" }, price: "12,50 €" },
      { id: "p3", category: { sk: "Hematológia", en: "Hematology" }, item: { sk: "Krvný obraz s diferenciálom", en: "Complete blood count with differential" }, price: "9,00 €" },
      { id: "p4", category: { sk: "Hematológia", en: "Hematology" }, item: { sk: "Koagulačné vyšetrenie", en: "Coagulation panel" }, price: "14,00 €" },
      { id: "p5", category: { sk: "Zobrazovacia diagnostika", en: "Imaging" }, item: { sk: "CT vyšetrenie (samoplatca, bez kontrastu)", en: "CT scan (self-pay, without contrast)" }, price: "85,00 €" },
      { id: "p6", category: { sk: "Zobrazovacia diagnostika", en: "Imaging" }, item: { sk: "Ultrazvukové vyšetrenie", en: "Ultrasound scan" }, price: "25,00 €" },
      { id: "p7", category: { sk: "Ústavná starostlivosť", en: "Inpatient care" }, item: { sk: "Nadštandardná izba (gynekologicko-pôrodnícke odd., za deň)", en: "Premium room (gynecology & obstetrics, per day)" }, price: "8,00 €" },
      { id: "p8", category: { sk: "Administratíva", en: "Administrative" }, item: { sk: "Poplatok LSPP (ambulantná pohotovostná služba)", en: "LSPP fee (ambulatory emergency service)" }, price: "1,99 €" }
    ],
    waitingTimes: [
      { clinic: { sk: "Urologická ambulancia", en: "Urology clinic" }, wait: { sk: "do 1 týždňa — nová ambulancia", en: "within 1 week — new clinic" }, level: "good" },
      { clinic: { sk: "Angiologická ambulancia", en: "Angiology clinic" }, wait: { sk: "2–3 týždne · vyžaduje sa výmenný lístok", en: "2–3 weeks · referral required" }, level: "ok" },
      { clinic: { sk: "Hematologická ambulancia", en: "Hematology clinic" }, wait: { sk: "1–2 týždne", en: "1–2 weeks" }, level: "good" },
      { clinic: { sk: "Diabetologická ambulancia", en: "Diabetology clinic" }, wait: { sk: "dočasne neprijíma nových pacientov", en: "temporarily not accepting new patients" }, level: "closed" },
      { clinic: { sk: "Neurologická ambulancia", en: "Neurology clinic" }, wait: { sk: "dočasný režim — náhradný kontakt 0918 088 183", en: "temporary measures — substitute contact 0918 088 183" }, level: "closed" },
      { clinic: { sk: "Fyziatricko-rehabilitačné oddelenie (FRO)", en: "Physiatry & rehabilitation (FRO)" }, wait: { sk: "do 2 týždňov · pilotné online objednávanie", en: "up to 2 weeks · online-booking pilot" }, level: "good" }
    ],
    testimonials: [
      { id: "t1", quote: { sk: "Personál gynekologicko-pôrodníckeho oddelenia bol počas pôrodu mimoriadne empatický a trpezlivý.", en: "The staff on the maternity ward were extraordinarily empathetic and patient throughout my delivery." }, author: { sk: "Pacientka · Gynekologicko-pôrodnícke oddelenie", en: "Patient · Gynecology & Obstetrics" } },
      { id: "t2", quote: { sk: "Rýchle a presné vyšetrenie, personál ma upokojil počas celého zákroku.", en: "Fast, precise care — the staff kept me calm throughout the procedure." }, author: { sk: "Pacient · Chirurgicko-traumatologické oddelenie", en: "Patient · Surgery & Traumatology" } },
      { id: "t3", quote: { sk: "Nová centrálna recepcia mi ušetrila veľa času, hneď som vedel, kam ísť.", en: "The new central reception saved me a lot of time — I knew exactly where to go." }, author: { sk: "Pacient · Ambulantná starostlivosť", en: "Patient · Outpatient care" } }
    ]
  },

  /* ---------------- O nemocnici — history, governance, transparency ---------------- */
  aboutInfo: {
    owner: { sk: "100 % vlastníkom spoločnosti je Mesto Snina, v zastúpení primátorom Petrom Vološinom.", en: "The company is 100% owned by the City of Snina, represented by Mayor Peter Vološin." },
    leadershipTeam: [
      { name: "MUDr. Andrej Kulan", role: { sk: "Konateľ spoločnosti", en: "Managing director" }, phone: "057/7871 226", email: "sekretariat@nemocnicasnina.sk" },
      { name: "Ing. Iveta Šimonová", role: { sk: "Vedúca ekonomicko-technického úseku", en: "Head of Economic & Technical Division" }, phone: "057/7871 640", email: "ekonom@nemocnicasnina.sk" },
      { name: "MUDr. Norbert Orinín", role: { sk: "Námestník pre liečebno-preventívnu starostlivosť", en: "Deputy Director for Medical Care" }, phone: "057/7871 242", email: "nemocnica@nemocnicasnina.sk" },
      { name: "PhDr. Jana Kapáková, MBA", role: { sk: "Námestníčka pre ošetrovateľstvo", en: "Deputy Director for Nursing" }, phone: "057/7871 245", email: "namosetrovatelstvo@nemocnicasnina.sk" }
    ],
    board: ["Marek Gerboc", "Mgr. Jana Karľová", "JUDr. Tomáš Kirňák", "Marián Lojan", "Tomáš Potocký", "Mgr. Mária Todáková", "Ing. Michal Vohar", "Ing. Dana Mariničová"],
    antiCorruption: { sk: "Podozrenie na korupčné správanie možno nahlásiť dôverne cez antikorupčnú linku nemocnice, nezávisle od bežného sťažnostného konania.", en: "Suspected corrupt conduct can be reported confidentially via the hospital's anti-corruption line, independent of the standard complaints process." },
    transfusionCommittee: { sk: "Transfúzna komisia dohliada na bezpečné používanie krvi a krvných derivátov naprieč oddeleniami.", en: "The transfusion committee oversees the safe use of blood and blood products across departments." },
    leadership: { sk: "Nemocnicu vedie MUDr. Andrej Kulan, ktorý zároveň pôsobí ako konateľ spoločnosti a primár chirurgicko-traumatologického oddelenia. Nemocnica aktívne žiada o zaradenie medzi urgentné príjmy 1. typu v rámci reformy Optimalizácie siete nemocníc (OSN).", en: "The hospital is led by MUDr. Andrej Kulan, who serves as both managing director and Head of Surgery & Traumatology. The hospital has petitioned for Type 1 urgent-care status under the national Hospital Network Optimisation (OSN) reform." },
    ethics: { sk: "Etická komisia posudzuje klinické štúdie a etické otázky starostlivosti a metodicky usmerňuje personál v otázkach informovaného súhlasu a dôstojnosti pacienta. Podnety možno adresovať sekretariátu nemocnice.", en: "The ethics committee reviews clinical studies and care-related ethics questions, and guides staff on informed consent and patient dignity. Submissions can be addressed to the hospital secretariat." },
    adverseEvents: { sk: "Nežiaduce udalosti evidujeme a vyhodnocujeme interne s cieľom priebežne zvyšovať bezpečnosť starostlivosti. Pacienti a návštevy môžu nežiaducu udalosť nahlásiť cez sekretariát alebo formulár sťažností.", en: "Adverse events are logged and reviewed internally to continuously improve care safety. Patients and visitors can report an adverse event via the secretariat or the complaints form." },
    certifications: [
      { name: "ISO 9001:2015", desc: { sk: "Systém manažérstva kvality — nadväzuje na certifikáciu ISO 9001:2008.", en: "Quality management system — succeeding the ISO 9001:2008 certification." } }
    ],
    rankings: { sk: "Inštitút pre ekonomické a sociálne reformy (INEKO) v spolupráci s Transparency International Slovensko pravidelne hodnotí nemocnicu podľa kvality, efektívnosti a spokojnosti pacientov.", en: "The Institute for Economic and Social Reforms (INEKO), with Transparency International Slovakia, regularly ranks the hospital on quality, efficiency and patient satisfaction." },
    investments: [
      { amount: "340 000 €", desc: { sk: "Modernizácia rádiológie z Plánu obnovy a odolnosti SR — nové CT, sonografia, chirurgické C-rameno.", en: "Radiology modernisation via the Recovery & Resilience Plan — new CT scanner, sonography, surgical C-arm." } },
      { amount: "50 000 €", desc: { sk: "Mestská dotácia na nové gastroskopy a kolonoskopy.", en: "Municipal subsidy for new gastroscopes and colonoscopes." } }
    ],
    financials: { revenue: "14 027 000 €", assets: "4 039 000 €", profit: "398 000 €", year: "2024" },
    history: [
      { year: "1945", text: { sk: "Vznik Ligy proti TBC a poradne pre matky — základ zdravotnej starostlivosti v regióne.", en: "The League against TB and a maternal counselling centre are founded — the origin of regional healthcare." } },
      { year: "1948", text: { sk: "Založený Okresný ústav národného zdravia (OÚNZ) pod vedením MUDr. Gabriela Hoffmanna.", en: "The District Institute of National Health (OÚNZ) is founded, led by Dr. Gabriel Hoffmann." } },
      { year: "1951–1952", text: { sk: "Otvorené samostatné detské a gynekologické oddelenie.", en: "Independent pediatric and gynecological wards open." } },
      { year: "1963", text: { sk: "Slávnostné otvorenie hlavnej nemocničnej budovy so 180 lôžkami.", en: "The main 180-bed hospital building officially opens." } },
      { year: "1985", text: { sk: "Vzniká samostatné oddelenie anestéziológie a resuscitácie (ARO).", en: "An independent Anesthesiology & Resuscitation department (ARO) is established." } },
      { year: "2007", text: { sk: "Uvedenie mamografického pracoviska do prevádzky.", en: "A mammography unit is commissioned." } },
      { year: "2008", text: { sk: "Prvé pracovisko počítačovej tomografie (CT).", en: "The first computed tomography (CT) workplace opens." } },
      { year: "2024", text: { sk: "Spustenie centrálnej recepcie a nových ambulancií — urológia, angiológia.", en: "Central reception launches, alongside new urology and angiology clinics." } },
      { year: "2025–2026", text: { sk: "Komplexná modernizácia rádiológie z Plánu obnovy — nové CT, sonografia, C-rameno; rozšírenie o jednodňovú urologickú starostlivosť.", en: "Comprehensive radiology modernisation via the Recovery & Resilience Plan — new CT, sonography, C-arm; expansion into one-day urological care." } }
    ]
  },

  /* ---------------- Careers ---------------- */
  /* ---------------- Careers ---------------- */
  careersInfo: {
    contact: { sk: "Erika Ferková · sekretariát konateľa", en: "Erika Ferková · Managing Director's Secretariat" },
    phone: "057/7871 226",
    benefits: [
      { sk: "Podpora zvyšovania kvalifikácie a špecializačného štúdia", en: "Support for further education and specialisation training" },
      { sk: "Finančné benefity — príplatky, príspevky zo sociálneho fondu, motivačná zložka mzdy", en: "Financial benefits — allowances, social-fund contributions, a motivational wage component" },
      { sk: "Možnosť osobného rastu v stabilnej a rozvíjajúcej sa organizácii", en: "Room for personal growth in a stable, growing organisation" }
    ]
  },

  jobs: [
    { id: "j1", title: { sk: "Lekár – pediater", en: "Physician – Pediatrician" }, dept: "pediatria", desc: { sk: "Diagnostická a liečebno-preventívna starostlivosť o pacientov detského oddelenia. Vhodné aj pre absolventov. Výhodou je špecializácia v odbore pediatria.", en: "Diagnostic and therapeutic-preventive care for pediatric ward patients. Open to recent graduates. Pediatric specialisation is an advantage." } },
    { id: "j2", title: { sk: "Lekár – internista", en: "Physician – Internist" }, dept: "interne", desc: { sk: "Diagnostická a liečebno-preventívna starostlivosť o pacientov interného oddelenia. Výhodou je špecializácia v internej medicíne a postupová skúška — internistický kmeň.", en: "Diagnostic and therapeutic-preventive care for internal medicine patients. Internal-medicine specialisation and the core-exam are an advantage." } },
    { id: "j3", title: { sk: "Lekár – anestéziológ a intenzivista", en: "Physician – Anesthesiologist & Intensivist" }, dept: "oaim", desc: { sk: "Starostlivosť o pacientov OAIM. Ponúkame plný úväzok, čiastočný úväzok aj ústavnú pohotovostnú službu (ÚPS).", en: "Care for OAIM patients. Full-time, part-time, and on-call service (ÚPS) all available." } },
    { id: "j4", title: { sk: "Lekár – gynekológ", en: "Physician – Gynecologist" }, dept: "gynekologia", desc: { sk: "Diagnostická a liečebno-preventívna starostlivosť o pacientky gynekologicko-pôrodníckeho oddelenia. Špecializácia v gynekológii a pôrodníctve vítaná.", en: "Diagnostic and therapeutic-preventive care for gynecology & obstetrics patients. Specialisation welcomed." } },
    { id: "j5", title: { sk: "Lekár – diabetológ", en: "Physician – Diabetologist" }, clinic: "diabetologicka", desc: { sk: "Ambulantná starostlivosť v odbore diabetológia, poruchy látkovej premeny a výživy. Vyžaduje sa špecializácia alebo zaradenie v tomto odbore.", en: "Outpatient care in diabetology and metabolic disorders. Specialisation or enrolment in this field is required." } }
  ],

  /* ---------------- Patient education library (replaces AlejTech's PDF/PNG library) ---------------- */
  educationLibrary: [
    { id: "predoperacne", category: { sk: "Pred operáciou a anestézia", en: "Pre-operative & anesthesia" }, articles: [
      { id: "priprava", title: { sk: "Príprava pred operáciou", en: "Preparing for your operation" }, full: true },
      { id: "lokalna", title: { sk: "Miestna anestézia — čo očakávať", en: "Local anesthesia — what to expect" }, full: false, summary: { sk: "Ako prebieha miestne znecitlivenie a na čo sa pripraviť pred a po zákroku.", en: "How local numbing works and what to prepare for before and after the procedure." } },
      { id: "celkova", title: { sk: "Celková anestézia — čo očakávať", en: "General anesthesia — what to expect" }, full: false, summary: { sk: "Priebeh celkovej anestézie, nutné lačnenie a zotavenie po prebudení.", en: "The course of general anesthesia, required fasting, and recovery after waking." } }
    ] },
    { id: "chronicke", category: { sk: "Chronické a akútne stavy", en: "Chronic & acute management" }, articles: [
      { id: "hypertenzia", title: { sk: "Artériová hypertenzia", en: "Arterial hypertension" }, full: true },
      { id: "cdiff", title: { sk: "Infekcia Clostridioides difficile", en: "Clostridioides difficile infection" }, full: false, summary: { sk: "Prenos, izolačné opatrenia a hygiena rúk pri liečbe C. difficile.", en: "Transmission, isolation precautions and hand hygiene while treating C. difficile." } },
      { id: "warfarin", title: { sk: "Užívanie warfarínu", en: "Taking warfarin" }, full: false, summary: { sk: "Pravidelné kontroly INR, liekové a potravinové interakcie.", en: "Regular INR monitoring, drug and dietary interactions." } },
      { id: "heparin", title: { sk: "Aplikácia nízkomolekulárneho heparínu", en: "Administering low-molecular-weight heparin" }, full: false, summary: { sk: "Postup podania injekcie doma a bezpečná likvidácia striekačiek.", en: "How to self-inject at home and safely dispose of syringes." } }
    ] },
    { id: "materska", category: { sk: "Materská a detská starostlivosť", en: "Maternal & pediatric care" }, articles: [
      { id: "porod-info", title: { sk: "Informácie o pôrode", en: "About childbirth" }, full: false, summary: { sk: "Čo si zbaliť do pôrodnice a ako prebieha príjem na pôrodnú sálu.", en: "What to pack for the maternity ward and how admission to the delivery room works." } },
      { id: "novorodenec", title: { sk: "Starostlivosť o novorodenca", en: "Newborn care" }, full: false, summary: { sk: "Dojčenie, kúpanie a starostlivosť o pupočný pahýľ v prvých dňoch.", en: "Feeding, bathing and umbilical-cord care in the first days." } },
      { id: "diastaza", title: { sk: "Diastáza brušných svalov po pôrode", en: "Postpartum abdominal diastasis" }, full: false, summary: { sk: "Rozpoznanie diastázy a bezpečné cvičenia po pôrode.", en: "Recognising diastasis and safe postpartum exercises." } }
    ] },
    { id: "dieta", category: { sk: "Nemocničná diétna terapia", en: "Inpatient nutritional therapy" }, articles: [
      { id: "dieta9", title: { sk: "Diabetická diéta č. 9", en: "Diabetic diet No. 9" }, full: false, summary: { sk: "Zásady sacharidových jednotiek a plán stravovania pri diabete.", en: "Carbohydrate-unit principles and a meal plan for diabetes." } },
      { id: "dieta5", title: { sk: "Diéta so zníženým obsahom zvyškov č. 5", en: "Residue-restricted diet No. 5" }, full: false, summary: { sk: "Potraviny vhodné pri ochoreniach tráviaceho traktu s nízkym obsahom vlákniny.", en: "Low-fibre foods suited to digestive-tract conditions." } },
      { id: "dieta4", title: { sk: "Diéta so zníženým obsahom tuku č. 4", en: "Fat-restricted diet No. 4" }, full: false, summary: { sk: "Odporúčania pri ochoreniach pečene, žlčníka a pankreasu.", en: "Guidance for liver, gallbladder and pancreatic conditions." } },
      { id: "dieta6", title: { sk: "Diéta so zníženým obsahom bielkovín č. 6", en: "Protein-restricted diet No. 6" }, full: false, summary: { sk: "Plán stravovania pri ochoreniach obličiek.", en: "A meal plan for kidney disease." } },
      { id: "bezlepok", title: { sk: "Bezlepková diéta", en: "Gluten-free diet" }, full: false, summary: { sk: "Potraviny bez lepku a čítanie etikiet pri celiakii.", en: "Gluten-free foods and label-reading for celiac disease." } }
    ] },
    { id: "fyziatria", category: { sk: "Fyziatria a rehabilitácia", en: "Physiatry & rehabilitation" }, articles: [
      { id: "lymfodrenaz", title: { sk: "Lymfodrenáž", en: "Lymphatic drainage" }, full: false, summary: { sk: "Ako prebieha manuálna lymfodrenáž a kedy je indikovaná.", en: "How manual lymphatic drainage works and when it's indicated." } },
      { id: "dlaha", title: { sk: "Motorová dlaha", en: "Motor splint therapy" }, full: false, summary: { sk: "Používanie motorovej dlahy na obnovu pohybu kĺbu po operácii.", en: "Using a motor splint to restore joint movement after surgery." } },
      { id: "ultrazvuk-terapia", title: { sk: "Ultrazvuková terapia", en: "Ultrasound therapy" }, full: false, summary: { sk: "Účinky terapeutického ultrazvuku pri bolestiach kĺbov a mäkkých tkanív.", en: "The effects of therapeutic ultrasound for joint and soft-tissue pain." } }
    ] }
  ]
};

/* =========================================================
   Store — localStorage-backed, seeds on first load / version bump
   ========================================================= */
const DB = (function () {
  const KEY = "ns_db_v1";
  const VKEY = "ns_db_version";
  let state = null;

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    if (state) return state;
    try {
      const v = parseInt(localStorage.getItem(VKEY) || "0", 10);
      const raw = localStorage.getItem(KEY);
      if (raw && v === SEED_VERSION) {
        state = JSON.parse(raw);
        return state;
      }
    } catch (e) { /* fall through to seed */ }
    state = deepClone(SEED);
    persist();
    try { localStorage.setItem(VKEY, String(SEED_VERSION)); } catch (e) {}
    return state;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  return {
    all() { return load(); },
    get(collection) { const s = load(); return s[collection]; },
    list(collection) { const s = load(); return Array.isArray(s[collection]) ? s[collection] : []; },
    find(collection, id) { return this.list(collection).find(x => x.id === id); },
    save(collection, value) { const s = load(); s[collection] = value; persist(); },
    upsert(collection, item) {
      const s = load();
      const arr = s[collection];
      const i = arr.findIndex(x => x.id === item.id);
      if (i >= 0) arr[i] = item; else arr.push(item);
      persist();
      return item;
    },
    remove(collection, id) {
      const s = load();
      s[collection] = s[collection].filter(x => x.id !== id);
      persist();
    },
    setField(collection, value) { this.save(collection, value); },
    reset() {
      state = deepClone(SEED);
      persist();
      try { localStorage.setItem(VKEY, String(SEED_VERSION)); } catch (e) {}
    },
    export() { return JSON.stringify(load(), null, 2); },
    import(json) {
      try { state = JSON.parse(json); persist(); return true; }
      catch (e) { return false; }
    }
  };
})();
