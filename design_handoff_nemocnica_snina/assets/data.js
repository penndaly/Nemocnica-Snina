/* =========================================================
   Nemocnica Snina — Seeded database + localStorage store
   All real content compiled from the hospital audit.
   Bilingual fields are { sk, en }. The admin CMS edits these
   collections; the public pages read from them.
   ========================================================= */

const SEED_VERSION = 10;

const SEED = {
  hospital: {
    name: "Nemocnica Snina, s.r.o.",
    tagline: { sk: "Poliklinika a lôžková časť", en: "Polyclinic & Inpatient Care" },
    address: "Sládkovičova 300/3, 069 01 Snina",
    ico: "36 509 108",
    dic: "2022075770",
    phone: "+421 57 766 01 11",
    reception: "0915 988 533",
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
      beds: 58,
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
      lead: "MUDr. Gabriela Čopíková",
      leadRole: { sk: "Vedúci lekár", en: "Head physician" },
      deputy: "Anna Bajusová, MBA",
      deputyRole: { sk: "Vedúca sestra", en: "Head Nurse" },
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
      location: { sk: "Prízemie · meracie miesto protetiky (kontakt: Juraj Ledžinský, 0908 574 758)", en: "Ground floor · prosthetics measuring point (contact: Juraj Ledžinský, 0908 574 758)" },
      phone: "057 / 7871 248",
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
      doctor: "MUDr. Marek Andraščík, MUDr. M. Brečka, MUDr. L. Alušík, MUDr. Jakub Lakatoš",
      nurse: "Andrea Gajdošová",
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
      nurse: "Bc. Edita Barnová, Adriana Ďuriová",
      location: { sk: "Prízemie · priestory interného oddelenia", en: "Ground floor · internal medicine premises" },
      phone: "057 / 7871 285",
      status: "new",
      acceptingNew: true,
      bookable: true,
      referral: true,
      schedule: { sk: ["Ordinačné hodiny: Po – Str 07:00 – 15:00", "Objednávanie LEN Štv/Pia 13:00 – 14:30"], en: ["Clinic hours: Mon – Wed 07:00 – 15:00", "Booking ONLY Thu/Fri 13:00 – 14:30"] },
      bookingDays: [4, 5],
      bookingWindow: "13:00–14:30",
      referralRequired: true,
      bookingRule: { sk: "Objednať sa možno iba vo štvrtok a piatok medzi 13:00 – 14:30. Vyžaduje sa výmenný lístok.", en: "Booking is possible only Thursday & Friday between 13:00 – 14:30. A referral (výmenný lístok) is required." }
    },
    {
      id: "neurologicka",
      name: { sk: "Neurologická ambulancia", en: "Neurology Clinic" },
      specialty: { sk: "Neurológia", en: "Neurology" },
      doctor: "MUDr. Vladimír Kičik",
      nurse: "Slávka Aľušíková",
      location: { sk: "Budova polikliniky · pri ambulancii funguje aj Neurologický stacionár", en: "Polyclinic building · linked Neurology Day Unit also operates here" },
      phone: "057 / 7871 212",
      status: "open",
      bookable: true,
      referral: true,
      schedule: { sk: ["Pondelok 06:00 – 11:00", "Utorok & Štvrtok 06:00 – 12:00 a 13:00 – 14:00", "Streda & Piatok 06:00 – 11:00"], en: ["Monday 06:00 – 11:00", "Tuesday & Thursday 06:00 – 12:00 and 13:00 – 14:00", "Wednesday & Friday 06:00 – 11:00"] },
      bookingDays: [1, 2, 3, 4, 5],
      bookingRule: { sk: "Ambulancia je späť v štandardnej prevádzke; predchádzajúci náhradný kontakt (0918 088 183) už neplatí.", en: "The clinic has returned to standard operation; the previous substitute contact (0918 088 183) is no longer in use." }
    },
    {
      id: "hematologicka",
      name: { sk: "Hematologická ambulancia", en: "Hematology Clinic" },
      specialty: { sk: "Hematológia", en: "Hematology" },
      doctor: "MUDr. Viera Coraničová",
      location: { sk: "Budova Revital Plus · 1. poschodie (nad lekárňou)", en: "Revital Plus building · 1st floor (above the pharmacy)" },
      phone: "057 / 7871 610",
      status: "open",
      bookable: true,
      referral: true,
      schedule: { sk: ["Pondelok – Štvrtok 07:00 – 15:00", "Piatok zatvorené"], en: ["Monday – Thursday 07:00 – 15:00", "Friday closed"] },
      bookingDays: [1, 2, 3, 4],
      bookingRule: { sk: "Pozor: ambulancia sídli mimo hlavnej budovy. Piatok je zatvorené.", en: "Note: this clinic is located outside the main building. Closed on Friday." }
    },
    {
      id: "diabetologicka",
      name: { sk: "Ambulancia diabetológie a porúch látkovej výmeny", en: "Diabetology & Metabolic Disorders Clinic" },
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
    },
    {
      id: "ortopedicka",
      name: { sk: "Ortopedická ambulancia", en: "Orthopedics Clinic" },
      specialty: { sk: "Ortopédia", en: "Orthopedics" },
      location: { sk: "Budova polikliniky", en: "Polyclinic building" },
      status: "comingSoon",
      bookable: false,
      referral: true,
      schedule: { sk: ["Obsah sa pripravuje"], en: ["Content coming soon"] },
      bookingRule: { sk: "Nová ambulancia — obsah sa pripravuje, lekár zatiaľ nie je uvedený.", en: "New clinic — content is being prepared; no physician listed yet." }
    },
    {
      id: "kardiologicka",
      name: { sk: "Kardiologická ambulancia", en: "Cardiology Clinic" },
      specialty: { sk: "Kardiológia", en: "Cardiology" },
      location: { sk: "Budova polikliniky", en: "Polyclinic building" },
      status: "comingSoon",
      bookable: false,
      referral: true,
      schedule: { sk: ["Obsah sa pripravuje"], en: ["Content coming soon"] },
      bookingRule: { sk: "Nová ambulancia — obsah sa pripravuje, lekár zatiaľ nie je uvedený.", en: "New clinic — content is being prepared; no physician listed yet." }
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
    { id: "kicik", name: "MUDr. Vladimír Kičik", role: { sk: "Neurológ", en: "Neurologist" }, clinic: "neurologicka", langs: ["SK"], accepting: true, bio: { sk: "Vedie neurologickú ambulanciu a súvisiaci neurologický stacionár.", en: "Leads the neurology clinic and the linked neurology day unit." } },
    { id: "copikova", name: "MUDr. Gabriela Čopíková", role: { sk: "Vedúci lekár · Novorodenecké oddelenie", en: "Head physician · Neonatal Unit" }, dept: "neonatologia", langs: ["SK"], accepting: false, bio: { sk: "Vedúca lekárka novorodeneckého oddelenia, pôsobí aj na detskom oddelení.", en: "Head physician of the neonatal unit; also practises in pediatrics." } },
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
    { id: "lab", name: { sk: "Laboratórna diagnostika", en: "Laboratory diagnostics" }, facility: "lab-biochemia", icon: "flask", desc: { sk: "Klinická biochémia a hematológia s možnosťou stiahnutia výsledkov online.", en: "Clinical biochemistry and hematology, with results downloadable online." } },
    { id: "zobrazovanie", name: { sk: "Zobrazovacia diagnostika", en: "Imaging diagnostics" }, facility: "rdg", icon: "scan", desc: { sk: "CT, RTG a ultrazvuk (USG) s prípravou pre externých pacientov.", en: "CT, X-ray and ultrasound (USG), with preparation guidance for external patients." } }
  ],

  /* ---------------- Diagnostic & support facilities (SVaLZ) ---------------- */
  facilities: [
    {
      id: "lab-biochemia",
      name: { sk: "Úsek klinickej biochémie", en: "Clinical Biochemistry Unit" },
      lead: "MUDr. Viera Coraničová",
      phone: "057 / 7871 610",
      kind: { sk: "Klinická biochémia", en: "Clinical biochemistry" },
      desc: { sk: "Laboratórna diagnostika klinickej biochémie. Pacienti si môžu výsledky bezpečne stiahnuť online — bez nutnosti vracať sa po papierový výsledok.", en: "Clinical-biochemistry laboratory diagnostics. Patients can securely download results online — no need to return for a paper report." },
      features: { sk: ["Klinická biochémia", "Bezpečné stiahnutie výsledkov (PDF)"], en: ["Clinical biochemistry", "Secure result download (PDF)"] }
    },
    {
      id: "lab-hematologia",
      name: { sk: "Úsek klinickej hematológie", en: "Clinical Hematology Unit" },
      lead: "RNDr. Jana Sirková",
      leadRole: { sk: "Vedúca úseku", en: "Unit head" },
      deputy: "MUDr. Viera Coraničová",
      deputyRole: { sk: "Odborný garant", en: "Professional lead" },
      phone: "057 / 7871 225",
      kind: { sk: "Hematológia", en: "Hematology" },
      desc: { sk: "Laboratórna diagnostika klinickej hematológie. Vedúca laborantka: Bc. Ľubica Vološinová.", en: "Clinical-hematology laboratory diagnostics. Lead laboratory technician: Bc. Ľubica Vološinová." },
      features: { sk: ["Hematológia", "Bezpečné stiahnutie výsledkov (PDF)"], en: ["Hematology", "Secure result download (PDF)"] }
    },
    {
      id: "rdg",
      name: { sk: "Rádiodiagnostické oddelenie", en: "Radiodiagnostic Department" },
      lead: "MUDr. Michal Lajtar",
      phone: "057 / 7871 219",
      kind: { sk: "CT · RTG · Ultrazvuk (USG)", en: "CT · X-ray · Ultrasound (USG)" },
      desc: { sk: "Moderné zobrazovacie metódy. Pre externých pacientov uvádzame presné pokyny na prípravu (napr. CT s kontrastnou látkou).", en: "Modern imaging methods. For external patients we provide precise preparation instructions (e.g. CT with contrast)." },
      features: { sk: ["Počítačová tomografia (CT)", "RTG", "Ultrazvuk (USG)", "Pokyny pre externých pacientov"], en: ["Computed tomography (CT)", "X-ray (RTG)", "Ultrasound (USG)", "Instructions for external patients"] },
      physicians: ["MUDr. Renáta Filčáková", "MUDr. Martin Morong"]
    },
    {
      id: "recepcia",
      name: { sk: "Centrálna recepcia", en: "Central Reception" },
      phone: "0915 988 533",
      hours: { sk: "Pondelok – Piatok 07:00 – 15:00", en: "Monday – Friday 07:00 – 15:00" },
      location: { sk: "Vestibul pri hlavnom vchode do budovy nemocnice", en: "Vestibule at the hospital's main entrance" },
      kind: { sk: "Prvý kontakt · v prevádzke od 1. 9. 2024", en: "First point of contact · operating since 1 Sep 2024" },
      desc: { sk: "Centrálna recepcia vás prevedie celou návštevou a nasmeruje na správne pracovisko. Web je „prvou líniou“ tejto recepcie.", en: "The central reception guides you through your whole visit and directs you to the right department. This website is the 'first line' of that reception." },
      features: { sk: ["Navigácia po areáli", "Smerovanie na oddelenia", "Informácie pre návštevy"], en: ["Campus navigation", "Routing to departments", "Visitor information"] },
      handles: { sk: ["Všeobecné informácie o oddeleniach a ambulanciách", "Navigácia po areáli", "Pokladňa pre platené a nadštandardné služby", "Riešenie núdzových/krízových situácií", "Stratené a nájdené veci"], en: ["General information about departments & clinics", "Wayfinding around the campus", "Cashier for paid & premium services", "Emergency/crisis handling", "Lost & found"] }
    },
    {
      id: "lekaren",
      name: { sk: "Nemocničná lekáreň", en: "Hospital Pharmacy" },
      phone: "057 / 7871 232",
      kind: { sk: "Výdaj liekov · v areáli nemocnice", en: "Dispensing · within the hospital complex" },
      desc: { sk: "Lekáreň v areáli nemocnice s otváracími hodinami zosúladenými s ambulanciami.", en: "A pharmacy within the hospital complex, with opening hours aligned to the clinics." },
      features: { sk: ["Výdaj na recept aj voľnopredajný", "Hodiny zosúladené s ambulanciami"], en: ["Prescription & OTC dispensing", "Hours aligned with clinics"] }
    },
    {
      id: "sterilizacia",
      name: { sk: "Centrálna sterilizácia", en: "Central Sterilization" },
      kind: { sk: "Ostatné · podporné pracovisko", en: "Other · support unit" },
      desc: { sk: "Zabezpečuje sterilizáciu nástrojov a materiálu pre celú nemocnicu.", en: "Provides sterilization of instruments and materials for the whole hospital." },
      features: { sk: [], en: [] }
    },
    {
      id: "kuchyna",
      name: { sk: "Kuchyňa", en: "Kitchen" },
      kind: { sk: "Ostatné · podporné pracovisko", en: "Other · support unit" },
      desc: { sk: "Zabezpečuje stravovanie hospitalizovaných pacientov, vrátane diétneho stravovania.", en: "Provides meals for inpatients, including therapeutic diets." },
      features: { sk: [], en: [] }
    },
    {
      id: "pracovna",
      name: { sk: "Práčovňa", en: "Laundry" },
      kind: { sk: "Ostatné · podporné pracovisko", en: "Other · support unit" },
      desc: { sk: "Zabezpečuje pranie a údržbu nemocničnej bielizne.", en: "Handles washing and upkeep of hospital linen." },
      features: { sk: [], en: [] }
    }
  ],

  /* ---------------- News & announcements ---------------- */
  news: [
    { id: "n-urologia-jednodnova", date: "2026-03-11", tag: { sk: "Nová služba", en: "New service" }, type: "good", title: { sk: "Rozšírili sme portfólio o jednodňovú urologickú starostlivosť", en: "Portfolio expanded with one-day urology care" }, body: { sk: "Nemocnica Snina rozšírila portfólio služieb o jednodňovú zdravotnú starostlivosť v odbore urológia — ambulantné operačné výkony bez potreby hospitalizácie. Prví pacienti už boli ošetrení.", en: "Nemocnica Snina has expanded its services with one-day (outpatient) surgical care in urology, without the need for hospitalisation. The first patients have already been treated." } },
    { id: "n-bezhotovostne", date: "2026-03-01", tag: { sk: "Oznam", en: "Notice" }, type: "info", title: { sk: "Zavádzame bezhotovostné platby", en: "Cashless payments introduced" }, body: { sk: "Od 1. marca 2026 nemocnica akceptuje aj bezhotovostnú platbu pri sumách nad 1 €, v súlade s novou legislatívou. Platba v hotovosti je naďalej možná.", en: "From 1 March 2026 the hospital also accepts cashless payment for amounts over €1, in line with new legislation. Cash payment remains available." } },
    { id: "n-dovera-hodnotenie", date: "2026-03-11", tag: { sk: "Ocenenie", en: "Recognition" }, type: "good", title: { sk: "Nemocnicu vysoko hodnotia poistenci Dôvery", en: "Highly rated by Dôvera policyholders" }, body: { sk: "V hodnotení nemocníc poistencami zdravotnej poisťovne Dôvera sa Nemocnica Snina umiestnila na 12. mieste zo 43 všeobecných nemocníc.", en: "In a Dôvera health-insurer patient-satisfaction survey of hospitals, Nemocnica Snina ranked 12th out of 43 general hospitals." } },
    { id: "n-msm-dar", date: "2025-11-17", tag: { sk: "Darcovstvo", en: "Donation" }, type: "good", title: { sk: "Nové prístroje vďaka daru od MSM GROUP ĽUĎOM", en: "New equipment thanks to a donation from MSM GROUP ĽUĎOM" }, body: { sk: "Vďaka daru vo výške približne 40 000 € sme obstarali nový ultrazvukový prístroj a prístroj na lymfodrenáž.", en: "A donation of roughly €40,000 funded a new ultrasound machine and a lymphatic-drainage device." } },
    { id: "n-angio", date: "2025-05-09", tag: { sk: "Nová ambulancia", en: "New clinic" }, type: "good", title: { sk: "Otvorili sme angiologickú ambulanciu", en: "Angiology clinic now open" }, body: { sk: "5. mája 2025 sme otvorili novú angiologickú ambulanciu, ktorá rozširuje možnosti diagnostiky a liečby cievnych a lymfatických ochorení. Objednávanie prebieha vo štvrtok a piatok 13:00 – 14:30, vyžaduje sa výmenný lístok.", en: "On 5 May 2025 we opened a new angiology clinic, expanding diagnosis and treatment of vascular and lymphatic disease. Booking takes place Thursday & Friday 13:00 – 14:30; a referral is required." } },
    { id: "n-urologia", date: "2024-10-01", tag: { sk: "Nová ambulancia", en: "New clinic" }, type: "good", title: { sk: "Otvorili sme urologickú ambulanciu", en: "Urology clinic now open" }, body: { sk: "Od 1. októbra 2024 je v budove polikliniky v prevádzke nová urologická ambulancia pod vedením MUDr. Patrika Nebesníka. Ambulancia aktívne prijíma nových pacientov.", en: "From 1 October 2024 a new urology clinic, led by MUDr. Patrik Nebesník, operates in the polyclinic building. The clinic is actively accepting new patients." } },
    { id: "n-recepcia", date: "2024-09-01", tag: { sk: "Prevádzka", en: "Operations" }, type: "info", title: { sk: "Spustili sme centrálnu recepciu", en: "Central reception launched" }, body: { sk: "Od 1. septembra 2024 funguje centrálna recepcia, ktorá pacientov nasmeruje a odbremení čakárne. Web sa stáva prvou líniou tejto recepcie.", en: "Since 1 September 2024 a central reception directs patients and relieves the waiting areas. The website becomes the first line of this reception." } },
    { id: "n-laparo", date: "2024-03-12", tag: { sk: "Chirurgia", en: "Surgery" }, type: "good", title: { sk: "Nové laparoskopické a traumatologické metódy", en: "New laparoscopic & trauma methods" }, body: { sk: "Chirurgicko-traumatologické oddelenie zaviedlo nové miniinvazívne laparoskopické a traumatologické postupy, ktoré skracujú rekonvalescenciu pacientov.", en: "The surgery & traumatology department has introduced new minimally-invasive laparoscopic and trauma procedures that shorten patient recovery." } }
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
    pricingNote: {
      sk: "Vzorka z aktuálneho cenníka výkonov a služieb za priamu úhradu (platný od 1. 10. 2025). Toto je reprezentatívny výber, nie kompletný zoznam — úplný cenník (~90 položiek) je dostupný ako PDF nižšie, spolu so samostatnými cenníkmi biochémie a hematológie.",
      en: "A sample from the current price list for self-pay procedures & services (valid from 1 Oct 2025). This is a representative selection, not the complete list — the full price list (~90 items) is available as a PDF below, alongside separate biochemistry and hematology price lists."
    },
    pricingDocuments: [
      { title: { sk: "Cenník výkonov a služieb (platný od 1.10.2025)", en: "Price list of procedures & services (valid from 1 Oct 2025)" }, url: "https://www.nemocnicasnina.sk/files/documents/sm-06%20cenník%2001.10.2025.pdf" },
      { title: { sk: "Cenník výkonov — biochémia", en: "Price list — biochemistry" }, url: "https://www.nemocnicasnina.sk/files/documents/cennik/cenník%20výkonov%20biochemia%2001092024.pdf" },
      { title: { sk: "Cenník výkonov — hematológia", en: "Price list — hematology" }, url: "https://www.nemocnicasnina.sk/files/documents/cennik/cenník%20výkonov%20hemat%2001092024.pdf" }
    ],
    pricing: [
      { id: "p1", category: { sk: "Hospitalizácia / pobyt", en: "Hospitalisation / stay" }, item: { sk: "Pobyt sprievodcu pri hospitalizácii pacienta (1 deň)", en: "Stay of an accompanying person during hospitalisation (1 day)" }, price: "3,50 €" },
      { id: "p2", category: { sk: "Hospitalizácia / pobyt", en: "Hospitalisation / stay" }, item: { sk: "Hospitalizácia na nadštandardnej izbe (1 deň/1 osobu/1 lôžko)", en: "Stay in a premium room (1 day / 1 person / 1 bed)" }, price: "20,00 €" },
      { id: "p3", category: { sk: "Administratíva", en: "Administrative" }, item: { sk: "Kopírovanie – formát A4 / 1 strana", en: "Copying – A4 format / 1 page" }, price: "0,50 €" },
      { id: "p4", category: { sk: "Administratíva", en: "Administrative" }, item: { sk: "Výpis zo zdravotnej dokumentácie (na iné účely)", en: "Extract from medical records (for other purposes)" }, price: "10,00 €" },
      { id: "p5", category: { sk: "Potvrdenia", en: "Certificates" }, item: { sk: "Potvrdenie zdravotnej spôsobilosti na vedenie motorového vozidla", en: "Medical fitness certificate for driving a motor vehicle" }, price: "20,00 €" },
      { id: "p6", category: { sk: "Potvrdenia", en: "Certificates" }, item: { sk: "Potvrdenie zdravotnej spôsobilosti na držanie zbraní a streliva", en: "Medical fitness certificate for firearms possession" }, price: "20,00 €" },
      { id: "p7", category: { sk: "Vyšetrenia", en: "Examinations" }, item: { sk: "Vyšetrenie pacienta pred cestou do/po návrate z cudziny", en: "Examination before travel abroad / after return" }, price: "40,00 €" },
      { id: "p8", category: { sk: "Spoplatnené výkony a služby", en: "Chargeable procedures & services" }, item: { sk: "Epidurálna anestézia (nebolestivý pôrod)", en: "Epidural anaesthesia (pain-free childbirth)" }, price: "83,00 €" },
      { id: "p9", category: { sk: "Spoplatnené výkony a služby", en: "Chargeable procedures & services" }, item: { sk: "Sterilizácia (na vlastnú žiadosť)", en: "Sterilisation (on personal request)" }, price: "246,00 €" },
      { id: "p10", category: { sk: "Pracovisko FBLR", en: "FBLR unit" }, item: { sk: "Klasická masáž celý chrbát (20 min.)", en: "Classic full-back massage (20 min.)" }, price: "7,00 €" },
      { id: "p11", category: { sk: "Ostatné služby nezdravotnícke", en: "Other non-medical services" }, item: { sk: "Pranie bielizne (1 kg)", en: "Laundry service (1 kg)" }, price: "2,40 €" }
    ],
    waitingTimeInfo: {
      note: {
        sk: "Nemocnica aktuálne nezverejňuje vlastný odhad čakacích lehôt na jednotlivé ambulancie. Presné čakacie lehoty a poradovníky vedú zdravotné poisťovne — odkazy na ich portály nájdete nižšie.",
        en: "The hospital does not currently publish its own per-clinic wait-time estimates. Exact waiting times and waiting lists are maintained by the health insurers — links to their portals are below."
      },
      insurerLinks: [
        { name: "Dôvera zdravotná poisťovňa", url: "https://www.dovera.sk/cakacie-listiny" },
        { name: "Všeobecná zdravotná poisťovňa (VšZP)", url: "https://www.vszp.sk/poistenci/cakacie-listiny/" },
        { name: "Union zdravotná poisťovňa", url: "https://www.union.sk/planovana-zdravotna-starostlivosti" }
      ]
    },
    satisfactionSurvey: {
      intro: { sk: "Vaša spätná väzba nám pomáha zlepšovať starostlivosť. Dotazník je anonymný a vypĺňa sa cez externý formulár.", en: "Your feedback helps us improve care. The survey is anonymous and completed via an external form." },
      externalFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdzm2Yp2YOUBelN8trQD2s3lv1EYahOlvg6RnVwDK0ouyMf5w/viewform"
    },
    complaints: {
      legalRef: "Zákon NR SR č. 9/2010 Z. z. o sťažnostiach",
      process: { sk: "Sťažnosť možno podať písomne alebo ústne v sekretariáte nemocnice; sťažovateľ sa identifikuje a uvedie predmet/požiadavku, s možnosťou anonymity.", en: "Complaints may be submitted in writing or orally at the hospital secretariat; the complainant is identified and states the subject/demand, with an anonymity option." },
      timelineDays: 60,
      extensionDays: 30,
      anonymityAllowed: true,
      contactEmail: "sekretariat@nemocnicasnina.sk",
      contactAddress: "NEMOCNICA SNINA, s.r.o., Sládkovičova 300/03, 069 01 Snina"
    },
    pharmacyOnCall: {
      note: { sk: "Nemocnica sama neprevádzkuje pevný rozpis lekárenskej pohotovosti — rozpis pohotovostných lekární pre okres Snina vedie Prešovský samosprávny kraj.", en: "The hospital does not itself maintain a fixed pharmacy on-call rota — the on-call pharmacy rotation for the Snina district is maintained by the Prešov self-governing region." },
      url: "https://www.e-vuc.sk/psk/zdravotnictvo/lekarenska-pohotovostna-sluzba.html?page_id=92640&okres=Snina"
    },
    documents: [
      { title: { sk: "Charta práv pacienta", en: "Charter of Patient Rights" } },
      { title: { sk: "Etický kódex zdravotníckeho pracovníka", en: "Healthcare Worker Ethical Code" } }
    ],
    faq: [
      { id: "f1", question: { sk: "Ako sa môžem objednať na vyšetrenie?", en: "How can I book an appointment?" }, answerSummary: { sk: "Objednať sa môžete telefonicky alebo osobne priamo na príslušnom oddelení či ambulancii.", en: "Book by phone or in person directly at the relevant department or clinic." } },
      { id: "f2", question: { sk: "Aké dokumenty si mám priniesť na vyšetrenie?", en: "What documents should I bring to my appointment?" }, answerSummary: { sk: "Preukaz poistenca, relevantnú zdravotnú dokumentáciu a prípadnú predchádzajúcu zobrazovaciu dokumentáciu (RTG/MRI).", en: "Your insurance card, relevant medical records, and any prior imaging (X-ray/MRI)." } },
      { id: "f3", question: { sk: "Aké sú návštevné hodiny v nemocnici?", en: "What are the hospital's visiting hours?" }, answerSummary: { sk: "Líšia sa podľa oddelenia (pozri stránku daného oddelenia); výnimky po dohode s lekárom.", en: "They vary by department (see that department's page); exceptions by arrangement with the physician." } },
      { id: "f4", question: { sk: "Je možné parkovanie v areáli nemocnice?", en: "Is parking available on the hospital grounds?" }, answerSummary: { sk: "Verejné parkovanie je k dispozícii pred budovou nemocnice.", en: "Public parking is available in front of the hospital." } },
      { id: "f5", question: { sk: "Aké máte poplatky?", en: "What fees do you charge?" }, answerSummary: { sk: "Výkony hradené poisťovňou sú bezplatné; nehradené služby sú spoplatnené podľa cenníka.", en: "Insurer-covered procedures are free; non-covered services are priced per the price list." } },
      { id: "f6", question: { sk: "Aká je čakacia doba na vyšetrenie?", en: "How long is the wait for an appointment?" }, answerSummary: { sk: "Líši sa podľa ambulancie — od pár hodín až približne po mesiac.", en: "Varies by clinic — from a few hours up to roughly a month." } },
      { id: "f7", question: { sk: "Ako získam výsledky vyšetrení?", en: "How do I get my test results?" }, answerSummary: { sk: "Kontaktujte ošetrujúceho lekára alebo oddelenie priamo, telefonicky alebo osobne.", en: "Contact your attending physician or department directly, by phone or in person." } },
      { id: "f8", question: { sk: "Prijímate pacientov aj bez objednania?", en: "Do you accept patients without an appointment?" }, answerSummary: { sk: "Urgentné prípady bez objednania ošetríme, ak je to medicínsky nevyhnutné.", en: "Urgent cases without an appointment are treated when medically necessary." } }
    ],
    testimonials: [
      { id: "t1", quote: { sk: "Personál gynekologicko-pôrodníckeho oddelenia bol počas pôrodu mimoriadne empatický a trpezlivý.", en: "The staff on the maternity ward were extraordinarily empathetic and patient throughout my delivery." }, author: { sk: "Pacientka · Gynekologicko-pôrodnícke oddelenie", en: "Patient · Gynecology & Obstetrics" } },
      { id: "t2", quote: { sk: "Rýchle a presné vyšetrenie, personál ma upokojil počas celého zákroku.", en: "Fast, precise care — the staff kept me calm throughout the procedure." }, author: { sk: "Pacient · Chirurgicko-traumatologické oddelenie", en: "Patient · Surgery & Traumatology" } },
      { id: "t3", quote: { sk: "Nová centrálna recepcia mi ušetrila veľa času, hneď som vedel, kam ísť.", en: "The new central reception saved me a lot of time — I knew exactly where to go." }, author: { sk: "Pacient · Ambulantná starostlivosť", en: "Patient · Outpatient care" } }
    ]
  },

  /* ---------------- Duchovná služba (chaplaincy) ---------------- */
  chaplaincy: {
    location: { sk: "Nemocničná kaplnka (vstup cez administratívnu budovu)", en: "Hospital chapel (entrance via the administrative building)" },
    schedule: { sk: "Utorok a štvrtok 16:00 · nedeľa 10:30", en: "Tuesday & Thursday 16:00 · Sunday 10:30" },
    requestMethod: { sk: "Nahláste sa u ošetrujúcej sestry alebo zavolajte priamo príslušnému duchovnému.", en: "Tell the attending ward nurse, or call the relevant chaplain directly." },
    denominations: [
      { name: { sk: "Rímskokatolícka", en: "Roman Catholic" }, phone: "0918 601 051" },
      { name: { sk: "Gréckokatolícka", en: "Greek Catholic" }, phone: "0904 738 125" },
      { name: { sk: "Pravoslávna", en: "Orthodox" }, phone: "0907 974 713" }
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
    antiCorruption: { sk: "Podozrenie na korupčné správanie možno nahlásiť dôverne e-mailom na sekretariat@nemocnicasnina.sk, nezávisle od bežného sťažnostného konania. Podnety sa posudzujú podľa zákona č. 307/2014 Z. z. o ochrane oznamovateľov; evidujú sa len podania s aktuálnymi, konkrétnymi a overiteľnými informáciami preukazujúcimi korupciu.", en: "Suspected corrupt conduct can be reported confidentially by email at sekretariat@nemocnicasnina.sk, independent of the standard complaints process. Reports are handled under Act No. 307/2014 Coll. on whistleblower protection; only submissions with current, specific, verifiable evidence of corruption are recorded." },
    transfusionCommittee: { sk: "Transfúzna komisia, ktorú vedie MUDr. Norbert Orinín, dohliada na racionálnu a účelnú hemoterapiu a bezpečné používanie krvi a krvných derivátov naprieč oddeleniami, vrátane sledovania nežiaducich transfúznych reakcií.", en: "The transfusion committee, chaired by MUDr. Norbert Orinín, oversees rational and purposeful hemotherapy and the safe use of blood and blood products across departments, including monitoring adverse transfusion reactions." },
    kralapni: { sk: "Komisia pre racionálnu antiinfekčnú liečbu, antibiotickú politiku a nozokomiálne infekcie (KRALAPNI), vedená MUDr. Norbertom Oriním, dohliada na racionálne používanie antibiotík a antiinfekčnej liečby a na prevenciu šírenia nozokomiálnych infekcií a rezistentných mikroorganizmov v nemocnici.", en: "The Commission for Rational Anti-infective Treatment, Antibiotic Policy and Nosocomial Infections (KRALAPNI), chaired by MUDr. Norbert Orinín, oversees rational use of antibiotics/anti-infective therapy and prevention of nosocomial infections and resistant organisms in the hospital." },
    leadership: { sk: "Nemocnicu vedie MUDr. Andrej Kulan, ktorý zároveň pôsobí ako konateľ spoločnosti a primár chirurgicko-traumatologického oddelenia. Nemocnica aktívne žiada o zaradenie medzi urgentné príjmy 1. typu v rámci reformy Optimalizácie siete nemocníc (OSN).", en: "The hospital is led by MUDr. Andrej Kulan, who serves as both managing director and Head of Surgery & Traumatology. The hospital has petitioned for Type 1 urgent-care status under the national Hospital Network Optimisation (OSN) reform." },
    ethics: { sk: "Etickú komisiu vedie MUDr. Norbert Orinín. Komisia posudzuje klinické štúdie a etické otázky starostlivosti a metodicky usmerňuje personál v otázkach informovaného súhlasu a dôstojnosti pacienta.", en: "The ethics committee is chaired by MUDr. Norbert Orinín. It reviews clinical studies and care-related ethics questions, and guides staff on informed consent and patient dignity." },
    adverseEvents: { sk: "Nemocnica zverejňuje výročné prehľady nežiaducich udalostí (2016–2025) na stiahnutie, v záujme transparentnosti a v súlade s regulačnými požiadavkami. Pacienti a návštevy môžu udalosť nahlásiť cez sekretariát alebo formulár sťažností.", en: "The hospital publishes downloadable annual adverse-event reports (2016–2025) for transparency and regulatory compliance. Patients and visitors can report an event via the secretariat or the complaints form." },
    gdpr: {
      dpo: "PhDr. Jana Kapáková, MBA",
      email: "zodpovednaosoba@nemocnicasnina.sk",
      address: "Nemocnica Snina, s.r.o., Sládkovičova 30/3, 069 01 Snina",
      note: { sk: "Nemocnica spracúva osobné údaje pacientov v súlade s GDPR a slovenskou legislatívou na účely poskytovania zdravotnej starostlivosti. Zdravotnú dokumentáciu uchováva 20 rokov od ukončenia liečby alebo úmrtia pacienta. Pacienti majú právo na prístup, opravu, výmaz a podanie sťažnosti dozornému orgánu.", en: "The hospital processes patient personal data under GDPR and Slovak law for healthcare purposes. Medical records are retained 20 years after treatment ends or the patient's death. Patients have rights to access, correction, erasure, and to file a complaint with the supervisory authority." }
    },
    certifications: [
      { name: "ISO 9001:2015", desc: { sk: "Systém manažérstva kvality (SK08/0393, SGS Slovakia, akreditácia SNAS). Nadväzuje na certifikáciu ISO 9001:2008 (certifikovaní od októbra 2005).", en: "Quality management system (certificate SK08/0393, SGS Slovakia, SNAS-accredited). Succeeds the ISO 9001:2008 certification (certified since October 2005)." } },
      { name: "ISO 9001:2008", desc: { sk: "Historická certifikácia systému manažérstva kvality, platná 2014–2017; nahradená ISO 9001:2015.", en: "Historical quality-management-system certification, valid 2014–2017; superseded by ISO 9001:2015." } }
    ],
    awards: [
      { name: { sk: "Biele srdce", en: "White Heart" }, recipient: "PhDr. Jana Kapáková", category: { sk: "sestra – manažér, republiková úroveň", en: "nurse–manager, national level" }, issuer: "Slovenská komora sestier a pôrodných asistentiek", date: "2015-05-22", desc: { sk: "Národné ocenenie za osobný prínos v ošetrovateľstve, udelené vtedajšej (dnes) námestníčke pre ošetrovateľstvo.", en: "A national nursing award for personal contribution to nursing care, awarded to the hospital's Deputy Director for Nursing." } }
    ],
    rankings: { sk: "Inštitút pre ekonomické a sociálne reformy (INEKO) v spolupráci s Transparency International Slovensko pravidelne hodnotí nemocnicu podľa kvality, efektívnosti a spokojnosti pacientov. V roku 2026 sa nemocnica umiestnila na 12. mieste zo 43 všeobecných nemocníc v hodnotení poistencov zdravotnej poisťovne Dôvera.", en: "The Institute for Economic and Social Reforms (INEKO), with Transparency International Slovakia, regularly ranks the hospital on quality, efficiency and patient satisfaction. In 2026 the hospital ranked 12th of 43 general hospitals in a Dôvera health-insurer patient-satisfaction survey." },
    insurers: [
      { name: "Všeobecná zdravotná poisťovňa (VšZP)", url: "https://www.vszp.sk/" },
      { name: "Dôvera zdravotná poisťovňa", url: "https://www.dovera.sk" },
      { name: "Union zdravotná poisťovňa", url: "https://www.union.sk/" }
    ],
    sponsors: [
      { name: "MSM GROUP ĽUĎOM", desc: { sk: "Dar na zdravotnícke vybavenie (ultrazvuk, prístroj na lymfodrenáž), cca 40 000 €.", en: "Donation for medical equipment (ultrasound, lymphatic-drainage device), approx. €40,000." } },
      { name: "Občianske združenie WellGiving", desc: { sk: "1 000 € na vybavenie covidového oddelenia.", en: "€1,000 for COVID-ward equipment." } },
      { name: "Nadácia Križovatka", desc: { sk: "10 dychových monitorov Babysense pre novorodenecké oddelenie.", en: "10 Babysense breathing monitors for the neonatal unit." } },
      { name: "merga s.r.o.", desc: { sk: "Materiál a služby pri výmene plynového kotla, cca 3 000 €.", en: "Materials & services for a gas-boiler replacement, approx. €3,000." } },
      { name: "Nadácia COOP Jednota", desc: { sk: "Zdravotnícke pomôcky a laparoskopické nástroje, cca 4 000 €.", en: "Medical devices and laparoscopic instruments, approx. €4,000." } },
      { name: "Tesco Store SR, a.s.", desc: { sk: "Podpora počas pandémie.", en: "Support during the pandemic period." } },
      { name: "FelixRem s.r.o.", desc: { sk: "300 kusov prírodného zázvorového extraktu.", en: "300 units of natural ginger extract product." } },
      { name: "Únia žien Slovenska", desc: { sk: "Podpora nemocnice.", en: "Support for the hospital." } },
      { name: "Hyundai", desc: { sk: "Vozidlá pre prevoz novorodencov.", en: "Vehicles for newborn transport." } },
      { name: "LIDL", desc: { sk: "Život zachraňujúce vybavenie pre novorodencov (zákaznícky program).", en: "Life-saving neonatal equipment (customer donation programme)." } }
    ],
    projects: [
      { name: { sk: "Opatrenia na skrátenie času reakcie pri náraste ochorenia COVID-19", en: "Measures to shorten response time to a COVID-19 surge" }, amount: "155 541,17 €", fund: { sk: "Európsky fond regionálneho rozvoja", en: "European Regional Development Fund" }, desc: { sk: "Zdravotnícke vybavenie, OOP a spotrebný materiál na rýchlejšiu reakciu pri náraste ochorenia COVID-19.", en: "Medical equipment, PPE and supplies to speed the response to a COVID-19 case surge." } },
      { name: { sk: "Rozšírenie spôsobilosti v oblasti informačnej a kybernetickej bezpečnosti", en: "Expanding information & cybersecurity capability" }, amount: "172 751,09 € (z toho 119 945,45 € z EÚ)", fund: { sk: "Operačný program Integrovaná infraštruktúra", en: "Integrated Infrastructure Operational Programme" }, desc: { sk: "Dokumentácia, politiky, monitoring a nástroje na detekciu hrozieb v súlade so zákonom o kybernetickej bezpečnosti.", en: "Documentation, policy, monitoring and threat-detection tooling for cybersecurity-law compliance." } },
      { name: { sk: "Doplnenie prístrojového vybavenia pre Nemocnicu Snina, s.r.o.", en: "Supplementary equipment for Nemocnica Snina, s.r.o." }, amount: null, fund: null, desc: { sk: "Projekt na doplnenie prístrojového vybavenia; presná výška financovania nebola z verejne dostupných zdrojov overiteľná.", en: "A project supplementing medical equipment; the exact funding amount could not be verified from publicly available sources." } }
    ],
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
      { year: "1991", text: { sk: "Nemocnica sa stáva samostatným právnym subjektom.", en: "The hospital becomes an independent legal entity." } },
      { year: "2006", text: { sk: "Transformácia na mestskú spoločnosť; vznik JIS na chirurgickom a internom oddelení; spustenie jednodňovej chirurgie.", en: "Transformation into a municipal company; ICUs established on the surgical and internal-medicine wards; day-surgery launched." } },
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
      { id: "dieta2", title: { sk: "Šetriaca diéta č. 2", en: "Bland diet No. 2" }, full: false, summary: { sk: "Ľahko stráviteľná strava pri ochoreniach tráviaceho traktu, šetrná k žalúdočnej sliznici.", en: "Easily digestible food for digestive-tract conditions, gentle on the stomach lining." } },
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
    ] },
    { id: "bezpecnost", category: { sk: "Bezpečnosť pacienta", en: "Patient safety" }, articles: [
      { id: "pady", title: { sk: "Prevencia pádov počas hospitalizácie", en: "Fall prevention during hospitalisation" }, full: false, summary: { sk: "Ako znížiť riziko pádu na oddelení a čo robiť pri pocite nestability.", en: "How to reduce fall risk on the ward and what to do if you feel unsteady." } }
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
