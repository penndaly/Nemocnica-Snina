/**
 * Development-time seed data from the design handoff.
 * In production this module is replaced by CMS/API calls.
 * Import this only in server components.
 */
import type { Seed } from '@ns/types';

export const SEED: Seed = {
  hospital: {
    name: 'Nemocnica Snina, s.r.o.',
    tagline: { sk: 'Poliklinika a lôžková časť', en: 'Polyclinic & Inpatient Care' },
    address: 'Sládkovičova 300/3, 069 01 Snina',
    ico: '36 509 108',
    dic: '2022075770',
    phone: '+421 57 766 01 11',
    reception: '0915 988 533',
    pharmacy: '057 / 7871 233',
    emergency: '112',
    email: 'sekretariat@nemocnicasnina.sk',
    region: { sk: 'Spádová oblasť Snina a Prešovský kraj', en: 'Snina district & Prešov region' },
  },

  pages: {
    hero: {
      badge: {
        sk: 'Prijímame nových pacientov · Urológia & Angiológia',
        en: 'Accepting new patients · Urology & Angiology',
      },
      title: { sk: 'Moderná nemocnica pre náš región', en: 'A modern hospital for our region' },
      subtitle: {
        sk: 'Poskytujeme ústavnú a ambulantnú zdravotnú starostlivosť pre obyvateľov Sniny a okolia — s obnovenými oddeleniami, novou diagnostikou a centrálnou recepciou, ktorá vás prevedie celou návštevou.',
        en: 'We provide inpatient and outpatient care for the people of Snina and the surrounding district — with renovated wards, new diagnostics, and a central reception that guides you through every visit.',
      },
    },
    about: {
      title: { sk: 'O nemocnici', en: 'About the hospital' },
      body: {
        sk: 'Nemocnica Snina, s.r.o. je spoločnosť vo vlastníctve mesta Snina a tvorí dôležitý pilier zdravotnej starostlivosti pre okres Snina a širší Prešovský región.',
        en: 'Nemocnica Snina, s.r.o. is a company owned by the City of Snina and a vital pillar of healthcare for the Snina district and the wider Prešov region.',
      },
    },
    aps: {
      title: {
        sk: 'Ambulantná pohotovostná služba (APS)',
        en: 'Ambulatory Emergency Service (APS)',
      },
      note: {
        sk: 'Nemocnica je organizátorom APS pre dospelých aj deti v okrese Snina. Pri ohrození života vždy volajte 112.',
        en: 'The hospital organises the APS for adults and children in the Snina district. In a life-threatening emergency always call 112.',
      },
    },
    telehealth: {
      badge: {
        sk: 'Telezdravotníctvo',
        en: 'Telehealth',
      },
      title: {
        sk: 'Videokonzultácia s lekárom z domu',
        en: 'Video consultation with your doctor from home',
      },
      subtitle: {
        sk: 'Bezpečná, šifrovaná videokonzultácia s lekárom Nemocnice Snina — bez čakárne, z pohodlia domova.',
        en: 'Secure, encrypted video consultation with a Nemocnica Snina physician — no waiting room, from the comfort of home.',
      },
    },
  },

  departments: [
    {
      id: 'chirurgia',
      name: { sk: 'Chirurgicko-traumatologické oddelenie', en: 'Surgery & Traumatology' },
      short: { sk: 'Chirurgia a traumatológia', en: 'Surgery & Trauma' },
      lead: 'MUDr. Andrej Kulan',
      leadRole: { sk: 'Primár', en: 'Head of Department' },
      deputy: 'MUDr. Marek Andraščík',
      beds: 47,
      phone: '057 / 7871 218',
      email: 'chirurgia@nemocnicasnina.sk',
      featured: true,
      summary: {
        sk: 'Komplexná chirurgická a úrazová starostlivosť. V marci 2024 sme zaviedli nové laparoskopické a traumatologické metódy.',
        en: 'Comprehensive surgical and trauma care. In March 2024 we introduced new laparoscopic and trauma methodologies.',
      },
      desc: {
        sk: 'Spojené chirurgicko-traumatologické oddelenie je jedným z hlavných pilierov nemocnice.',
        en: 'The combined surgery & traumatology department is one of the hospital\'s primary pillars.',
      },
      facilities: {
        sk: ['Obnovené operačné sály', 'Septická a aseptická chirurgia', 'Miniinvazívna laparoskopia', 'Úrazová ambulancia'],
        en: ['Renovated operating theatres', 'Septic & aseptic surgery', 'Minimally-invasive laparoscopy', 'Trauma clinic'],
      },
      visiting: { sk: 'Denne 14:00 – 16:00 a 18:00 – 19:00', en: 'Daily 14:00 – 16:00 and 18:00 – 19:00' },
    },
    {
      id: 'interne',
      name: { sk: 'Interné oddelenie', en: 'Internal Medicine' },
      short: { sk: 'Interné', en: 'Internal Medicine' },
      lead: 'MUDr. Jana Borščová',
      leadRole: { sk: 'Primárka', en: 'Head of Department' },
      deputy: 'Mgr. Citrjaková',
      deputyRole: { sk: 'Vedúca sestra', en: 'Head Nurse' },
      beds: 58,
      phone: '057 / 7871 240',
      email: 'interne@nemocnicasnina.sk',
      featured: true,
      summary: {
        sk: 'Najväčšie oddelenie nemocnice so špecializovanou jednotkou intenzívnej starostlivosti (JIS).',
        en: "The hospital's largest department, with a dedicated Intensive Care Unit (JIS).",
      },
      desc: {
        sk: 'Interné oddelenie pokrýva širokú internú patológiu — od kardiopulmonálnych ochorení po metabolické stavy.',
        en: 'Internal Medicine covers broad internal pathology — from cardiopulmonary disease to metabolic conditions.',
      },
      facilities: {
        sk: ['Jednotka intenzívnej starostlivosti (JIS)', 'Štandardné lôžkové izby', 'Príjmová interná ambulancia', 'Kardiologická diagnostika'],
        en: ['Intensive Care Unit (JIS)', 'Standard ward beds', 'Internal admission clinic', 'Cardiology diagnostics'],
      },
      visiting: {
        sk: 'Denne 14:30 – 16:30 · JIS po dohode so službukonajúcim lekárom',
        en: 'Daily 14:30 – 16:30 · ICU by arrangement with the duty physician',
      },
    },
    {
      id: 'gynekologia',
      name: { sk: 'Gynekologicko-pôrodnícke oddelenie', en: 'Gynecology & Obstetrics' },
      short: { sk: 'Gynekológia a pôrodníctvo', en: 'Gynecology & Obstetrics' },
      lead: 'MUDr. František Pavlovčin',
      leadRole: { sk: 'Primár', en: 'Head of Department' },
      beds: 30,
      phone: '057 / 7871 231',
      email: 'gynekologia@nemocnicasnina.sk',
      delivery: '057 / 7871 279',
      featured: true,
      summary: {
        sk: 'Starostlivosť o ženu v každom veku a humanizované pôrodníctvo s možnosťou prítomnosti blízkej osoby.',
        en: 'Care for women at every age and humanised childbirth, with the option of a companion present.',
      },
      desc: {
        sk: 'Naše pôrodnícke oddelenie kladie dôraz na humanizovaný a bezpečný pôrod.',
        en: 'Our maternity department emphasises a humanised, safe birth.',
      },
      facilities: {
        sk: ['Moderné pôrodné sály', 'Prítomnosť blízkej osoby pri pôrode', 'Rooming-in s novorodencom', 'Stiahnuteľný pôrodný plán'],
        en: ['Modern delivery rooms', 'Companion present at birth', 'Rooming-in with the newborn', 'Downloadable birth plan'],
      },
      visiting: { sk: 'Denne 15:00 – 17:00 · oddelenie šestonedelia individuálne', en: 'Daily 15:00 – 17:00 · postnatal ward individually' },
    },
    {
      id: 'pediatria',
      name: { sk: 'Detské oddelenie', en: 'Pediatrics' },
      short: { sk: 'Pediatria', en: 'Pediatrics' },
      lead: 'MUDr. Miroslava Seňková, MBA',
      leadRole: { sk: 'Primárka', en: 'Head of Department' },
      beds: 15,
      phone: '057 / 7871 278',
      email: 'pediatria@nemocnicasnina.sk',
      featured: false,
      summary: {
        sk: 'Starostlivosť o deti od novorodencov po dorast, s možnosťou pobytu rodiča (rooming-in).',
        en: 'Care for children from newborns to adolescents, with the option for a parent to stay (rooming-in).',
      },
      desc: { sk: 'Detské oddelenie poskytuje diagnostiku a liečbu.', en: 'Pediatrics provides diagnosis and treatment.' },
      facilities: {
        sk: ['Rooming-in pre rodičov', 'Detská JIS-ka pre akútne stavy', 'Herňa a priestor pre deti', 'Spolupráca s neonatológiou'],
        en: ['Rooming-in for parents', 'Pediatric acute care beds', 'Playroom & child-friendly space', 'Neonatology cooperation'],
      },
      visiting: { sk: 'Rodičia neobmedzene pri rooming-in · ostatní 14:00 – 17:00', en: 'Parents unrestricted with rooming-in · others 14:00 – 17:00' },
    },
    {
      id: 'neonatologia',
      name: { sk: 'Novorodenecké oddelenie', en: 'Neonatal Unit' },
      short: { sk: 'Neonatológia', en: 'Neonatology' },
      lead: 'MUDr. Gabriela Čopíková',
      leadRole: { sk: 'Vedúci lekár', en: 'Head physician' },
      deputy: 'Anna Bajusová, MBA',
      deputyRole: { sk: 'Vedúca sestra', en: 'Head Nurse' },
      beds: 10,
      phone: '057 / 7871 279',
      featured: false,
      summary: {
        sk: 'Špecializovaná starostlivosť o novorodencov v úzkej spolupráci s pôrodníctvom.',
        en: 'Specialised care for newborns in close cooperation with obstetrics.',
      },
      desc: { sk: 'Novorodenecké oddelenie zabezpečuje starostlivosť.', en: 'The neonatal unit cares for newborns.' },
      facilities: {
        sk: ['Starostlivosť o fyziologického novorodenca', 'Resuscitačný kútik', 'Podpora dojčenia'],
        en: ['Physiological newborn care', 'Resuscitation corner', 'Breastfeeding support'],
      },
      visiting: { sk: 'V rámci oddelenia šestonedelia', en: 'Within the postnatal ward' },
    },
    {
      id: 'oaim',
      name: { sk: 'Oddelenie anestéziológie a intenzívnej medicíny (OAIM)', en: 'Anesthesiology & Intensive Care (OAIM)' },
      short: { sk: 'OAIM', en: 'OAIM' },
      lead: 'MUDr. Norbert Orinín',
      leadRole: { sk: 'Primár', en: 'Head of Department' },
      beds: 4,
      phone: '057 / 7871 242',
      featured: false,
      summary: {
        sk: 'Resuscitačná a intenzívna starostlivosť o najkritickejších pacientov a perioperačná anestézia.',
        en: 'Resuscitation and intensive care for the most critical patients, and perioperative anaesthesia.',
      },
      desc: { sk: 'OAIM zabezpečuje anestéziu pri operačných výkonoch.', en: 'The OAIM provides anaesthesia for surgical procedures.' },
      facilities: {
        sk: ['Resuscitačné lôžka', 'Perioperačná anestéziológia', 'Monitorovanie vitálnych funkcií'],
        en: ['Resuscitation beds', 'Perioperative anaesthesiology', 'Vital-sign monitoring'],
      },
      visiting: { sk: 'Iba po dohode so službukonajúcim lekárom', en: 'Only by arrangement with the duty physician' },
    },
    {
      id: 'fro',
      name: { sk: 'Fyziatricko-rehabilitačné oddelenie (FRO)', en: 'Physiatry & Rehabilitation (FRO)' },
      short: { sk: 'Rehabilitácia', en: 'Rehabilitation' },
      lead: 'MUDr. Natália Kyjovská',
      leadRole: { sk: 'Primárka', en: 'Head of Department' },
      beds: 0,
      phone: '057 / 7871 237',
      email: 'fro@nemocnicasnina.sk',
      featured: true,
      summary: {
        sk: 'Liečebná rehabilitácia, fyzikálna terapia a individuálny pohybový program. Možnosť online objednania.',
        en: 'Therapeutic rehabilitation, physical therapy and individual exercise programmes. Online booking available.',
      },
      desc: { sk: 'FRO poskytuje fyzikálnu liečbu.', en: 'The FRO provides physical therapy.' },
      facilities: {
        sk: ['Elektroliečba a magnetoterapia', 'Vodoliečba', 'Individuálny liečebný telocvik', 'Online objednávanie termínov'],
        en: ['Electrotherapy & magnetotherapy', 'Hydrotherapy', 'Individual therapeutic exercise', 'Online appointment booking'],
      },
      visiting: { sk: 'Ambulantná prevádzka — podľa objednania', en: 'Outpatient operation — by appointment' },
    },
  ],

  clinics: [
    {
      id: 'urazova-chirurgia',
      name: { sk: 'Ambulancia úrazovej chirurgie', en: 'Trauma Surgery Clinic' },
      specialty: { sk: 'Úrazová chirurgia', en: 'Trauma surgery' },
      doctor: 'MUDr. Lukáš Harmaňoš',
      nurse: 'Radoslava Pauliková',
      location: { sk: 'Prízemie · meracie miesto protetiky (kontakt: Juraj Ledžinský, 0908 574 758)', en: 'Ground floor · prosthetics measuring point (contact: Juraj Ledžinský, 0908 574 758)' },
      phone: '057 / 7871 248',
      status: 'open',
      bookable: true,
      referral: false,
      schedule: { sk: ['Utorok & Štvrtok 09:00 – 14:00', 'Protetika: Ut/Št 08:00 – 10:30'], en: ['Tuesday & Thursday 09:00 – 14:00', 'Prosthetics: Tue/Thu 08:00 – 10:30'] },
      bookingDays: [2, 4],
      bookingRule: { sk: 'Termíny len v utorok a štvrtok. Pondelok, streda a piatok sú zablokované.', en: 'Appointments Tuesday & Thursday only. Monday, Wednesday and Friday are blocked.' },
    },
    {
      id: 'chirurgicka',
      name: { sk: 'Chirurgická ambulancia', en: 'General Surgery Clinic' },
      specialty: { sk: 'Všeobecná chirurgia', en: 'General surgery' },
      doctor: 'MUDr. Marek Andraščík, MUDr. M. Brečka, MUDr. L. Alušík, MUDr. Jakub Lakatoš',
      nurse: 'Andrea Gajdošová',
      location: { sk: 'Prízemie', en: 'Ground floor' },
      phone: '057 / 7871 254',
      status: 'open',
      bookable: true,
      referral: false,
      schedule: { sk: ['Pondelok – Piatok 07:00 – 15:00', 'Pohotovosť (APS): nepretržite 24/7'], en: ['Monday – Friday 07:00 – 15:00', 'Emergency (APS): continuous 24/7'] },
      bookingDays: [1, 2, 3, 4, 5],
      fee: { sk: 'Poplatok za pohotovostné použitie (LSPP): 1,99 €', en: 'Emergency-use fee (LSPP): €1.99' },
      bookingRule: { sk: 'Štandardné objednávanie počas pracovných dní. Akútne stavy ošetríme nepretržite cez APS.', en: 'Standard booking on weekdays. Acute cases treated continuously via APS.' },
    },
    {
      id: 'urologicka',
      name: { sk: 'Urologická ambulancia', en: 'Urology Clinic' },
      specialty: { sk: 'Urológia', en: 'Urology' },
      doctor: 'MUDr. Patrik Nebesník',
      nurse: 'M. Polačková',
      location: { sk: 'Budova polikliniky · 2. poschodie', en: 'Polyclinic building · 2nd floor' },
      phone: '057 / 7871 228',
      status: 'new',
      acceptingNew: true,
      bookable: true,
      referral: true,
      schedule: { sk: ['Pondelok – Piatok 07:00 – 15:00'], en: ['Monday – Friday 07:00 – 15:00'] },
      bookingDays: [1, 2, 3, 4, 5],
      opened: '2024-10-01',
      bookingRule: { sk: 'Nová ambulancia (otvorená 1. 10. 2024). Aktívne prijíma nových pacientov.', en: 'New clinic (opened 1 Oct 2024). Actively accepting new patients.' },
    },
    {
      id: 'angiologicka',
      name: { sk: 'Angiologická ambulancia', en: 'Angiology Clinic' },
      specialty: { sk: 'Angiológia (cievne ochorenia)', en: 'Angiology (vascular)' },
      doctor: 'MUDr. Juraj Miko',
      nurse: 'Bc. Edita Barnová, Adriana Ďuriová',
      location: { sk: 'Prízemie · priestory interného oddelenia', en: 'Ground floor · internal medicine premises' },
      phone: '057 / 7871 285',
      status: 'new',
      acceptingNew: true,
      bookable: true,
      referral: true,
      schedule: { sk: ['Ordinačné hodiny: Po – Str 07:00 – 15:00', 'Objednávanie LEN Štv/Pia 13:00 – 14:30'], en: ['Clinic hours: Mon – Wed 07:00 – 15:00', 'Booking ONLY Thu/Fri 13:00 – 14:30'] },
      bookingDays: [4, 5],
      bookingWindow: '13:00–14:30',
      bookingRule: { sk: 'Objednať sa možno iba vo štvrtok a piatok medzi 13:00 – 14:30. Vyžaduje sa výmenný lístok.', en: 'Booking is possible only Thursday & Friday between 13:00 – 14:30. A referral (výmenný lístok) is required.' },
      telehealth: true,
      telehealthWindow: '13:00–14:30',
      telehealthRule: { sk: 'Videokonzultácie Štv/Pia 13:00 – 14:30. Vyžaduje sa výmenný lístok.', en: 'Video consultations Thu/Fri 13:00 – 14:30. A referral is required.' },
    },
    {
      id: 'neurologicka',
      name: { sk: 'Neurologická ambulancia', en: 'Neurology Clinic' },
      specialty: { sk: 'Neurológia', en: 'Neurology' },
      doctor: 'MUDr. Vladimír Kičik',
      nurse: 'Slávka Aľušíková',
      location: { sk: 'Budova polikliniky · pri ambulancii funguje aj Neurologický stacionár', en: 'Polyclinic building · linked Neurology Day Unit also operates here' },
      phone: '057 / 7871 212',
      status: 'open',
      bookable: true,
      referral: true,
      schedule: { sk: ['Pondelok 06:00 – 11:00', 'Utorok & Štvrtok 06:00 – 12:00 a 13:00 – 14:00', 'Streda & Piatok 06:00 – 11:00'], en: ['Monday 06:00 – 11:00', 'Tuesday & Thursday 06:00 – 12:00 and 13:00 – 14:00', 'Wednesday & Friday 06:00 – 11:00'] },
      bookingDays: [1, 2, 3, 4, 5],
      bookingRule: { sk: 'Ambulancia je späť v štandardnej prevádzke; predchádzajúci náhradný kontakt (0918 088 183) už neplatí.', en: 'The clinic has returned to standard operation; the previous substitute contact (0918 088 183) is no longer in use.' },
    },
    {
      id: 'hematologicka',
      name: { sk: 'Hematologická ambulancia', en: 'Hematology Clinic' },
      specialty: { sk: 'Hematológia', en: 'Hematology' },
      doctor: 'MUDr. Viera Coraničová',
      location: { sk: 'Budova Revital Plus · 1. poschodie (nad lekárňou)', en: 'Revital Plus building · 1st floor (above the pharmacy)' },
      phone: '057 / 7871 610',
      status: 'open',
      bookable: true,
      referral: true,
      schedule: { sk: ['Pondelok – Štvrtok 07:00 – 15:00', 'Piatok zatvorené'], en: ['Monday – Thursday 07:00 – 15:00', 'Friday closed'] },
      bookingDays: [1, 2, 3, 4],
      bookingRule: { sk: 'Pozor: ambulancia sídli mimo hlavnej budovy. Piatok je zatvorené.', en: 'Note: this clinic is located outside the main building. Closed on Friday.' },
    },
    {
      id: 'diabetologicka',
      name: { sk: 'Ambulancia diabetológie a porúch látkovej výmeny', en: 'Diabetology & Metabolic Disorders Clinic' },
      specialty: { sk: 'Diabetológia', en: 'Diabetology' },
      doctor: 'MUDr. Lenka Lajtarová',
      location: { sk: 'Areál nemocnice', en: 'Hospital complex' },
      status: 'closed',
      bookable: false,
      referral: true,
      schedule: { sk: ['Dočasne mimo prevádzky / obmedzená prevádzka'], en: ['Temporarily closed / limited operation'] },
      bookingRule: { sk: 'Ambulancia je dočasne mimo prevádzky — online objednávanie je pozastavené.', en: 'The clinic is temporarily closed — online booking is suspended.' },
    },
    {
      id: 'vnutorne-lekarstvo',
      name: { sk: 'Ambulancia vnútorného lekárstva', en: 'Internal Medicine Clinic' },
      specialty: { sk: 'Vnútorné lekárstvo', en: 'Internal medicine' },
      doctor: 'MUDr. Jana Borščová',
      location: { sk: 'Prízemie', en: 'Ground floor' },
      phone: '057 / 7871 285',
      status: 'open',
      bookable: true,
      referral: true,
      schedule: { sk: ['Príjmová ambulancia interného oddelenia', 'Pondelok – Piatok 07:00 – 15:00'], en: ['Admission clinic for Internal Medicine', 'Monday – Friday 07:00 – 15:00'] },
      bookingDays: [1, 2, 3, 4, 5],
      bookingRule: { sk: 'Príjmová ambulancia interného oddelenia.', en: 'Admission clinic for the Internal Medicine department.' },
      telehealth: true,
      telehealthWindow: '09:00–11:00',
      telehealthRule: { sk: 'Videokonzultácie Po–Pia 09:00 – 11:00. Vyžaduje sa výmenný lístok.', en: 'Video consultations Mon–Fri 09:00 – 11:00. A referral is required.' },
    },
    {
      id: 'fro-konzultacia',
      name: { sk: 'Rehabilitačná videokonzultácia (FRO)', en: 'Rehabilitation Video Consultation (FRO)' },
      specialty: { sk: 'Fyziatria a rehabilitácia', en: 'Physiatry & rehabilitation' },
      doctor: 'MUDr. Natália Kyjovská',
      location: { sk: 'Fyziatricko-rehabilitačné oddelenie', en: 'Physiatry & Rehabilitation Department' },
      phone: '057 / 7871 237',
      status: 'open',
      bookable: true,
      referral: false,
      schedule: { sk: ['Videokonzultácie: Po, Str, Pia 10:00 – 12:00'], en: ['Video consultations: Mon, Wed, Fri 10:00 – 12:00'] },
      bookingDays: [1, 3, 5],
      bookingWindow: '10:00–12:00',
      bookingRule: { sk: 'Videokonzultácie sú dostupné v pondelok, stredu a piatok medzi 10:00 – 12:00.', en: 'Video consultations are available Monday, Wednesday and Friday between 10:00 – 12:00.' },
      telehealth: true,
      telehealthWindow: '10:00–12:00',
      telehealthRule: { sk: 'Videokonzultácie Po/Str/Pia 10:00 – 12:00. Bez výmenného lístka.', en: 'Video consultations Mon/Wed/Fri 10:00 – 12:00. No referral required.' },
    },
    {
      id: 'ortopedicka',
      name: { sk: 'Ortopedická ambulancia', en: 'Orthopedics Clinic' },
      specialty: { sk: 'Ortopédia', en: 'Orthopedics' },
      location: { sk: 'Budova polikliniky', en: 'Polyclinic building' },
      status: 'comingSoon',
      bookable: false,
      referral: true,
      schedule: { sk: ['Obsah sa pripravuje'], en: ['Content coming soon'] },
      bookingRule: { sk: 'Nová ambulancia — obsah sa pripravuje, lekár zatiaľ nie je uvedený.', en: 'New clinic — content is being prepared; no physician listed yet.' },
    },
    {
      id: 'kardiologicka',
      name: { sk: 'Kardiologická ambulancia', en: 'Cardiology Clinic' },
      specialty: { sk: 'Kardiológia', en: 'Cardiology' },
      location: { sk: 'Budova polikliniky', en: 'Polyclinic building' },
      status: 'comingSoon',
      bookable: false,
      referral: true,
      schedule: { sk: ['Obsah sa pripravuje'], en: ['Content coming soon'] },
      bookingRule: { sk: 'Nová ambulancia — obsah sa pripravuje, lekár zatiaľ nie je uvedený.', en: 'New clinic — content is being prepared; no physician listed yet.' },
    },
  ],

  physicians: [
    { id: 'kulan', name: 'MUDr. Andrej Kulan', role: { sk: 'Primár · Chirurgia a traumatológia', en: 'Head · Surgery & Traumatology' }, dept: 'chirurgia', langs: ['SK', 'EN'], accepting: false, bio: { sk: 'Primár chirurgicko-traumatologického oddelenia. Venuje sa všeobecnej a miniinvazívnej chirurgii.', en: 'Head of the surgery & traumatology department, focusing on general and minimally-invasive surgery.' } },
    { id: 'andrascik', name: 'MUDr. Marek Andraščík', role: { sk: 'Zástupca primára · Chirurgia', en: 'Deputy head · Surgery' }, dept: 'chirurgia', langs: ['SK'], accepting: false, bio: { sk: 'Zástupca primára, všeobecná a úrazová chirurgia.', en: 'Deputy head; general and trauma surgery.' } },
    { id: 'borscova', name: 'MUDr. Jana Borščová', role: { sk: 'Primárka · Interné oddelenie', en: 'Head · Internal Medicine' }, dept: 'interne', langs: ['SK', 'EN'], accepting: true, bio: { sk: 'Primárka interného oddelenia a vnútorného lekárstva.', en: 'Head of internal medicine and the internal admission clinic.' } },
    { id: 'pavlovcin', name: 'MUDr. František Pavlovčin', role: { sk: 'Primár · Gynekológia a pôrodníctvo', en: 'Head · Gynecology & Obstetrics' }, dept: 'gynekologia', langs: ['SK'], accepting: true, bio: { sk: 'Primár gynekologicko-pôrodníckeho oddelenia.', en: 'Head of the gynecology & obstetrics department.' } },
    { id: 'senkova', name: 'MUDr. Miroslava Seňková, MBA', role: { sk: 'Primárka · Detské oddelenie', en: 'Head · Pediatrics' }, dept: 'pediatria', langs: ['SK', 'EN'], accepting: true, bio: { sk: 'Primárka detského oddelenia.', en: 'Head of the pediatrics department.' } },
    { id: 'orinin', name: 'MUDr. Norbert Orinín', role: { sk: 'Primár · OAIM', en: 'Head · OAIM' }, dept: 'oaim', langs: ['SK'], accepting: false, bio: { sk: 'Primár oddelenia anestéziológie a intenzívnej medicíny.', en: 'Head of anesthesiology & intensive care.' } },
    { id: 'kyjovska', name: 'MUDr. Natália Kyjovská', role: { sk: 'Primárka · Rehabilitácia (FRO)', en: 'Head · Rehabilitation (FRO)' }, dept: 'fro', langs: ['SK'], accepting: true, bio: { sk: 'Primárka fyziatricko-rehabilitačného oddelenia.', en: 'Head of the physiatry & rehabilitation department.' } },
    { id: 'harmanos', name: 'MUDr. Lukáš Harmaňoš', role: { sk: 'Úrazová chirurgia', en: 'Trauma surgery' }, dept: 'chirurgia', clinic: 'urazova-chirurgia', langs: ['SK'], accepting: false, bio: { sk: 'Lekár úrazovej chirurgickej ambulancie.', en: 'Physician at the trauma surgery clinic.' } },
    { id: 'nebesnik', name: 'MUDr. Patrik Nebesník', role: { sk: 'Urológ', en: 'Urologist' }, clinic: 'urologicka', langs: ['SK', 'EN'], accepting: true, bio: { sk: 'Vedie novú urologickú ambulanciu, ktorá aktívne prijíma nových pacientov.', en: 'Leads the new urology clinic, which is actively accepting new patients.' } },
    { id: 'miko', name: 'MUDr. Juraj Miko', role: { sk: 'Angiológ', en: 'Angiologist' }, clinic: 'angiologicka', langs: ['SK'], accepting: true, bio: { sk: 'Angiológ — diagnostika a liečba cievnych ochorení. Vyžaduje sa výmenný lístok.', en: 'Angiologist — diagnosis and treatment of vascular disease. A referral is required.' } },
    { id: 'kicik', name: 'MUDr. Vladimír Kičik', role: { sk: 'Neurológ', en: 'Neurologist' }, clinic: 'neurologicka', langs: ['SK'], accepting: true, bio: { sk: 'Vedie neurologickú ambulanciu a súvisiaci neurologický stacionár.', en: 'Leads the neurology clinic and the linked neurology day unit.' } },
    { id: 'copikova', name: 'MUDr. Gabriela Čopíková', role: { sk: 'Vedúci lekár · Novorodenecké oddelenie', en: 'Head physician · Neonatal Unit' }, dept: 'neonatologia', langs: ['SK'], accepting: false, bio: { sk: 'Vedúca lekárka novorodeneckého oddelenia, pôsobí aj na detskom oddelení.', en: 'Head physician of the neonatal unit; also practises in pediatrics.' } },
    { id: 'coranicova', name: 'MUDr. Viera Coraničová', role: { sk: 'Hematológia · Laboratórna medicína', en: 'Hematology · Laboratory Medicine' }, clinic: 'hematologicka', langs: ['SK'], accepting: true, bio: { sk: 'Vedie hematologickú ambulanciu a oddelenie laboratórnej medicíny.', en: 'Leads the hematology clinic and the department of laboratory medicine.' } },
    { id: 'lajtarova', name: 'MUDr. Lenka Lajtarová', role: { sk: 'Diabetológia', en: 'Diabetology' }, clinic: 'diabetologicka', langs: ['SK'], accepting: false, bio: { sk: 'Diabetologická ambulancia — dočasne mimo prevádzky.', en: 'Diabetology clinic — temporarily closed.' } },
    { id: 'lajtar', name: 'MUDr. Michal Lajtar', role: { sk: 'Rádiodiagnostika', en: 'Radiodiagnostics' }, facility: 'rdg', langs: ['SK'], accepting: false, bio: { sk: 'Vedie rádiodiagnostické oddelenie (CT, RTG, USG).', en: 'Leads the radiodiagnostic department (CT, X-ray, ultrasound).' } },
  ],

  services: [
    { id: 'laparoskopia', name: { sk: 'Miniinvazívna laparoskopia', en: 'Minimally-invasive laparoscopy' }, dept: 'chirurgia', icon: 'scalpel', desc: { sk: 'Nové laparoskopické metódy zavedené v marci 2024 — kratšia rekonvalescencia a menšie jazvy.', en: 'New laparoscopic methods introduced March 2024 — shorter recovery and smaller scars.' } },
    { id: 'porod', name: { sk: 'Humanizovaný pôrod', en: 'Humanised childbirth' }, dept: 'gynekologia', icon: 'heart', desc: { sk: 'Moderné pôrodné sály, prítomnosť blízkej osoby a starostlivosť o novorodenca pri matke.', en: 'Modern delivery rooms, a companion present, and newborn care beside the mother.' } },
    { id: 'rehab', name: { sk: 'Liečebná rehabilitácia', en: 'Therapeutic rehabilitation' }, dept: 'fro', icon: 'activity', desc: { sk: 'Fyzikálna terapia, elektroliečba, vodoliečba a individuálny liečebný telocvik.', en: 'Physical therapy, electrotherapy, hydrotherapy and individual exercise programmes.' } },
    { id: 'urologia', name: { sk: 'Urologická starostlivosť', en: 'Urological care' }, clinic: 'urologicka', icon: 'stethoscope', desc: { sk: 'Nová ambulancia prijímajúca pacientov — diagnostika a liečba ochorení močových ciest.', en: 'A new clinic accepting patients — diagnosis and treatment of urinary-tract conditions.' } },
    { id: 'angio', name: { sk: 'Cievna (angiologická) diagnostika', en: 'Vascular (angiology) diagnostics' }, clinic: 'angiologicka', icon: 'pulse', desc: { sk: 'Vyšetrenie a liečba cievnych ochorení. Vyžaduje sa výmenný lístok.', en: 'Examination and treatment of vascular disease. A referral is required.' } },
    { id: 'intenzivna', name: { sk: 'Intenzívna a resuscitačná starostlivosť', en: 'Intensive & resuscitation care' }, dept: 'oaim', icon: 'shield', desc: { sk: 'Resuscitačné lôžka OAIM a jednotka intenzívnej starostlivosti (JIS) interného oddelenia.', en: 'OAIM resuscitation beds and the Internal Medicine intensive care unit (JIS).' } },
    { id: 'lab', name: { sk: 'Laboratórna diagnostika', en: 'Laboratory diagnostics' }, facility: 'lab-biochemia', icon: 'flask', desc: { sk: 'Klinická biochémia a hematológia s možnosťou stiahnutia výsledkov online.', en: 'Clinical biochemistry and hematology, with results downloadable online.' } },
    { id: 'zobrazovanie', name: { sk: 'Zobrazovacia diagnostika', en: 'Imaging diagnostics' }, facility: 'rdg', icon: 'scan', desc: { sk: 'CT, RTG a ultrazvuk (USG) s prípravou pre externých pacientov.', en: 'CT, X-ray and ultrasound (USG), with preparation guidance for external patients.' } },
  ],

  facilities: [
    { id: 'lab-biochemia', name: { sk: 'Úsek klinickej biochémie', en: 'Clinical Biochemistry Unit' }, lead: 'MUDr. Viera Coraničová', phone: '057 / 7871 610', kind: { sk: 'Klinická biochémia', en: 'Clinical biochemistry' }, desc: { sk: 'Laboratórna diagnostika klinickej biochémie. Pacienti si môžu výsledky bezpečne stiahnuť online.', en: 'Clinical-biochemistry laboratory diagnostics. Patients can securely download results online.' }, features: { sk: ['Klinická biochémia', 'Bezpečné stiahnutie výsledkov (PDF)'], en: ['Clinical biochemistry', 'Secure result download (PDF)'] } },
    { id: 'lab-hematologia', name: { sk: 'Úsek klinickej hematológie', en: 'Clinical Hematology Unit' }, lead: 'RNDr. Jana Sirková', phone: '057 / 7871 225', kind: { sk: 'Hematológia', en: 'Hematology' }, desc: { sk: 'Laboratórna diagnostika klinickej hematológie. Odborný garant: MUDr. Viera Coraničová. Vedúca laborantka: Bc. Ľubica Vološinová.', en: 'Clinical-hematology laboratory diagnostics. Professional lead: MUDr. Viera Coraničová. Lead laboratory technician: Bc. Ľubica Vološinová.' }, features: { sk: ['Hematológia', 'Bezpečné stiahnutie výsledkov (PDF)'], en: ['Hematology', 'Secure result download (PDF)'] } },
    { id: 'rdg', name: { sk: 'Rádiodiagnostické oddelenie', en: 'Radiodiagnostic Department' }, lead: 'MUDr. Michal Lajtar', phone: '057 / 7871 219', kind: { sk: 'CT · RTG · Ultrazvuk (USG)', en: 'CT · X-ray · Ultrasound (USG)' }, desc: { sk: 'Moderné zobrazovacie metódy.', en: 'Modern imaging methods.' }, features: { sk: ['Počítačová tomografia (CT)', 'RTG', 'Ultrazvuk (USG)', 'Pokyny pre externých pacientov'], en: ['Computed tomography (CT)', 'X-ray (RTG)', 'Ultrasound (USG)', 'Instructions for external patients'] } },
    { id: 'recepcia', name: { sk: 'Centrálna recepcia', en: 'Central Reception' }, phone: '0915 988 533', kind: { sk: 'Prvý kontakt · v prevádzke od 1. 9. 2024', en: 'First point of contact · operating since 1 Sep 2024' }, desc: { sk: 'Centrálna recepcia vás prevedie celou návštevou.', en: 'The central reception guides you through your whole visit.' }, features: { sk: ['Navigácia po areáli', 'Smerovanie na oddelenia', 'Informácie pre návštevy'], en: ['Campus navigation', 'Routing to departments', 'Visitor information'] } },
    { id: 'lekaren', name: { sk: 'Nemocničná lekáreň', en: 'Hospital Pharmacy' }, phone: '057 / 7871 233', kind: { sk: 'Výdaj liekov · v areáli nemocnice', en: 'Dispensing · within the hospital complex' }, desc: { sk: 'Lekáreň v areáli nemocnice s otváracími hodinami zosúladenými s ambulanciami.', en: 'A pharmacy within the hospital complex, with opening hours aligned to the clinics.' }, features: { sk: ['Výdaj na recept aj voľnopredajný', 'Hodiny zosúladené s ambulanciami'], en: ['Prescription & OTC dispensing', 'Hours aligned with clinics'] } },
    { id: 'sterilizacia', name: { sk: 'Centrálna sterilizácia', en: 'Central Sterilization' }, kind: { sk: 'Ostatné · podporné pracovisko', en: 'Other · support unit' }, desc: { sk: 'Zabezpečuje sterilizáciu nástrojov a materiálu pre celú nemocnicu.', en: 'Provides sterilization of instruments and materials for the whole hospital.' }, features: { sk: [], en: [] } },
    { id: 'kuchyna', name: { sk: 'Kuchyňa', en: 'Kitchen' }, kind: { sk: 'Ostatné · podporné pracovisko', en: 'Other · support unit' }, desc: { sk: 'Zabezpečuje stravovanie hospitalizovaných pacientov, vrátane diétneho stravovania.', en: 'Provides meals for inpatients, including therapeutic diets.' }, features: { sk: [], en: [] } },
    { id: 'pracovna', name: { sk: 'Práčovňa', en: 'Laundry' }, kind: { sk: 'Ostatné · podporné pracovisko', en: 'Other · support unit' }, desc: { sk: 'Zabezpečuje pranie a údržbu nemocničnej bielizne.', en: 'Handles washing and upkeep of hospital linen.' }, features: { sk: [], en: [] } },
  ],

  news: [
    { id: 'n-urologia-jednodnova', date: '2026-03-11', tag: { sk: 'Nová služba', en: 'New service' }, type: 'good', title: { sk: 'Rozšírili sme portfólio o jednodňovú urologickú starostlivosť', en: 'Portfolio expanded with one-day urology care' }, body: { sk: 'Nemocnica Snina rozšírila portfólio služieb o jednodňovú zdravotnú starostlivosť v odbore urológia — ambulantné operačné výkony bez potreby hospitalizácie. Prví pacienti už boli ošetrení.', en: 'Nemocnica Snina has expanded its services with one-day (outpatient) surgical care in urology, without the need for hospitalisation. The first patients have already been treated.' } },
    { id: 'n-bezhotovostne', date: '2026-03-01', tag: { sk: 'Oznam', en: 'Notice' }, type: 'info', title: { sk: 'Zavádzame bezhotovostné platby', en: 'Cashless payments introduced' }, body: { sk: 'Od 1. marca 2026 nemocnica akceptuje aj bezhotovostnú platbu pri sumách nad 1 €, v súlade s novou legislatívou. Platba v hotovosti je naďalej možná.', en: 'From 1 March 2026 the hospital also accepts cashless payment for amounts over €1, in line with new legislation. Cash payment remains available.' } },
    { id: 'n-dovera-hodnotenie', date: '2026-03-11', tag: { sk: 'Ocenenie', en: 'Recognition' }, type: 'good', title: { sk: 'Nemocnicu vysoko hodnotia poistenci Dôvery', en: 'Highly rated by Dôvera policyholders' }, body: { sk: 'V hodnotení nemocníc poistencami zdravotnej poisťovne Dôvera sa Nemocnica Snina umiestnila na 12. mieste zo 43 všeobecných nemocníc.', en: 'In a Dôvera health-insurer patient-satisfaction survey of hospitals, Nemocnica Snina ranked 12th out of 43 general hospitals.' } },
    { id: 'n-msm-dar', date: '2025-11-17', tag: { sk: 'Darcovstvo', en: 'Donation' }, type: 'good', title: { sk: 'Nové prístroje vďaka daru od MSM GROUP ĽUĎOM', en: 'New equipment thanks to a donation from MSM GROUP ĽUĎOM' }, body: { sk: 'Vďaka daru vo výške približne 40 000 € sme obstarali nový ultrazvukový prístroj a prístroj na lymfodrenáž.', en: 'A donation of roughly €40,000 funded a new ultrasound machine and a lymphatic-drainage device.' } },
    { id: 'n-angio', date: '2025-05-09', tag: { sk: 'Nová ambulancia', en: 'New clinic' }, type: 'good', title: { sk: 'Otvorili sme angiologickú ambulanciu', en: 'Angiology clinic now open' }, body: { sk: '5. mája 2025 sme otvorili novú angiologickú ambulanciu, ktorá rozširuje možnosti diagnostiky a liečby cievnych a lymfatických ochorení. Objednávanie prebieha vo štvrtok a piatok 13:00 – 14:30, vyžaduje sa výmenný lístok.', en: 'On 5 May 2025 we opened a new angiology clinic, expanding diagnosis and treatment of vascular and lymphatic disease. Booking takes place Thursday & Friday 13:00 – 14:30; a referral is required.' } },
    { id: 'n-urologia', date: '2024-10-01', tag: { sk: 'Nová ambulancia', en: 'New clinic' }, type: 'good', title: { sk: 'Otvorili sme urologickú ambulanciu', en: 'Urology clinic now open' }, body: { sk: 'Od 1. októbra 2024 je v budove polikliniky v prevádzke nová urologická ambulancia pod vedením MUDr. Patrika Nebesníka. Ambulancia aktívne prijíma nových pacientov.', en: 'From 1 October 2024 a new urology clinic, led by MUDr. Patrik Nebesník, operates in the polyclinic building. The clinic is actively accepting new patients.' } },
    { id: 'n-recepcia', date: '2024-09-01', tag: { sk: 'Prevádzka', en: 'Operations' }, type: 'info', title: { sk: 'Spustili sme centrálnu recepciu', en: 'Central reception launched' }, body: { sk: 'Od 1. septembra 2024 funguje centrálna recepcia, ktorá pacientov nasmeruje a odbremení čakárne.', en: 'Since 1 September 2024 a central reception directs patients and relieves the waiting areas.' } },
    { id: 'n-laparo', date: '2024-03-12', tag: { sk: 'Chirurgia', en: 'Surgery' }, type: 'good', title: { sk: 'Nové laparoskopické a traumatologické metódy', en: 'New laparoscopic & trauma methods' }, body: { sk: 'Chirurgicko-traumatologické oddelenie zaviedlo nové miniinvazívne laparoskopické a traumatologické postupy.', en: 'The surgery & traumatology department has introduced new minimally-invasive laparoscopic and trauma procedures.' } },
  ],

  disclosures: [
    { id: 'ZML-2024-051', type: { sk: 'Zmluva', en: 'Contract' }, partner: 'Siemens Healthineers — servis CT/MRI', value: '45 000 € / rok', date: '2024-09-20' },
    { id: 'FAK-2024-318', type: { sk: 'Faktúra', en: 'Invoice' }, partner: 'MedTech Medical Supplies, a.s.', value: '12 450,00 €', date: '2024-10-15' },
    { id: 'ZML-2024-047', type: { sk: 'Zmluva', en: 'Contract' }, partner: 'Východoslovenská energetika, a.s.', value: '—', date: '2024-08-01' },
    { id: 'FAK-2024-302', type: { sk: 'Faktúra', en: 'Invoice' }, partner: 'Slovak Energy Corp.', value: '8 200,00 €', date: '2024-10-10' },
    { id: 'ZML-2024-039', type: { sk: 'Zmluva', en: 'Contract' }, partner: 'Rekonštrukcia operačných sál — STAVON s.r.o.', value: '318 000,00 €', date: '2024-02-28' },
    { id: 'FAK-2024-281', type: { sk: 'Faktúra', en: 'Invoice' }, partner: 'B. Braun Medical s.r.o. — spotrebný materiál', value: '6 740,50 €', date: '2024-09-30' },
  ],

  // Flattened from design_handoff_nemocnica_snina/assets/data.js `educationLibrary`
  // (nested category -> articles) into a flat list keyed by category id. Only
  // `priprava` and `hypertenzia` ship as full articles in the handoff (`full: true`
  // with body copy in edukacia.html's EDU_CONTENT); every other article is an
  // excerpt-only "coming soon" stub with no body and therefore no detail route.
  educationArticles: [
    {
      id: 'priprava', slug: 'priprava', category: 'predoperacne', readingMinutes: 3,
      title: { sk: 'Príprava pred operáciou', en: 'Preparing for your operation' },
      excerpt: {
        sk: 'Čo si priniesť, ako dlho lačnieť a čo očakávať v deň zákroku.',
        en: 'What to bring, how long to fast, and what to expect on the day of your procedure.',
      },
      body: {
        sk: `<h4>Pred príchodom do nemocnice</h4>
      <ul><li>Prineste si preukaz poistenca, občiansky preukaz a odporúčanie lekára.</li>
      <li>Zoznam všetkých liekov, ktoré užívate, vrátane voľnopredajných a výživových doplnkov.</li>
      <li>Pohodlné oblečenie a hygienické potreby na dobu hospitalizácie.</li></ul>
      <h4>Lačnenie pred zákrokom</h4>
      <p>Ak vám lekár neurčí inak, prestaňte jesť tuhú stravu najmenej 6 hodín pred plánovaným časom operácie a čisté tekutiny najmenej 2 hodiny vopred. Nedodržanie lačnenia môže viesť k odloženiu zákroku z bezpečnostných dôvodov.</p>
      <h4>Pravidelne užívané lieky</h4>
      <p>Niektoré lieky (najmä antikoagulanciá ako warfarín) je potrebné vysadiť alebo upraviť podľa pokynov anestéziológa. Dávkovanie nikdy nemeňte bez konzultácie.</p>
      <h4>V deň zákroku</h4>
      <p>Príďte v stanovenom čase na centrálnu recepciu, ktorá vás nasmeruje na predoperačné vyšetrenie. Počítajte s časom na administratívu a záverečný pohovor s anestéziológom.</p>`,
        en: `<h4>Before you arrive</h4>
      <ul><li>Bring your insurance card, ID, and your physician's referral.</li>
      <li>A list of every medication you take, including over-the-counter drugs and supplements.</li>
      <li>Comfortable clothing and toiletries for your stay.</li></ul>
      <h4>Fasting before your procedure</h4>
      <p>Unless your doctor says otherwise, stop eating solid food at least 6 hours before your scheduled surgery time, and clear fluids at least 2 hours before. Not fasting can mean your procedure is postponed for safety.</p>
      <h4>Regular medications</h4>
      <p>Some medications (particularly anticoagulants such as warfarin) need to be paused or adjusted on your anesthesiologist's instructions. Never change your dose without checking first.</p>
      <h4>On the day</h4>
      <p>Arrive at the scheduled time at central reception, which will direct you to pre-operative assessment. Allow time for paperwork and a final conversation with your anesthesiologist.</p>`,
      },
    },
    {
      id: 'lokalna', slug: 'lokalna', category: 'predoperacne',
      title: { sk: 'Miestna anestézia — čo očakávať', en: 'Local anesthesia — what to expect' },
      excerpt: {
        sk: 'Ako prebieha miestne znecitlivenie a na čo sa pripraviť pred a po zákroku.',
        en: 'How local numbing works and what to prepare for before and after the procedure.',
      },
    },
    {
      id: 'celkova', slug: 'celkova', category: 'predoperacne',
      title: { sk: 'Celková anestézia — čo očakávať', en: 'General anesthesia — what to expect' },
      excerpt: {
        sk: 'Priebeh celkovej anestézie, nutné lačnenie a zotavenie po prebudení.',
        en: 'The course of general anesthesia, required fasting, and recovery after waking.',
      },
    },
    {
      id: 'hypertenzia', slug: 'hypertenzia', category: 'chronicke', readingMinutes: 2,
      title: { sk: 'Artériová hypertenzia', en: 'Arterial hypertension' },
      excerpt: {
        sk: 'Čo je artériová hypertenzia, ako merať tlak doma a kedy vyhľadať pomoc ihneď.',
        en: 'What arterial hypertension is, how to measure blood pressure at home, and when to seek help immediately.',
      },
      body: {
        sk: `<h4>Čo je artériová hypertenzia</h4>
      <p>Artériová hypertenzia je dlhodobo zvýšený krvný tlak (nad 140/90 mmHg pri opakovanom meraní). Neliečená zvyšuje riziko cievnej mozgovej príhody, infarktu myokardu a poškodenia obličiek.</p>
      <h4>Meranie tlaku doma</h4>
      <ul><li>Merajte v pokoji, po 5 minútach sedenia, ráno aj večer.</li>
      <li>Zaznamenávajte hodnoty a prineste si ich na kontrolu k lekárovi.</li></ul>
      <h4>Životospráva</h4>
      <ul><li>Obmedzte príjem soli na menej ako 5 g denne.</li>
      <li>Pravidelný pohyb — aspoň 150 minút týždenne strednej intenzity.</li>
      <li>Obmedzenie alkoholu a ukončenie fajčenia.</li></ul>
      <h4>Kedy vyhľadať pomoc ihneď</h4>
      <p>Pri hodnotách nad 180/120 mmHg spolu s bolesťou hlavy, bolesťou na hrudi, dýchavičnosťou alebo poruchou videnia okamžite volajte 112.</p>`,
        en: `<h4>What arterial hypertension is</h4>
      <p>Arterial hypertension is persistently elevated blood pressure (above 140/90 mmHg on repeated measurement). Left untreated it raises the risk of stroke, heart attack and kidney damage.</p>
      <h4>Measuring at home</h4>
      <ul><li>Measure at rest, after sitting for 5 minutes, morning and evening.</li>
      <li>Keep a log and bring it to your check-up.</li></ul>
      <h4>Lifestyle</h4>
      <ul><li>Limit salt intake to under 5g a day.</li>
      <li>Regular activity — at least 150 minutes a week of moderate intensity.</li>
      <li>Limit alcohol and stop smoking.</li></ul>
      <h4>When to seek help immediately</h4>
      <p>If your reading is above 180/120 mmHg together with headache, chest pain, shortness of breath, or vision changes, call 112 immediately.</p>`,
      },
    },
    {
      id: 'cdiff', slug: 'cdiff', category: 'chronicke',
      title: { sk: 'Infekcia Clostridioides difficile', en: 'Clostridioides difficile infection' },
      excerpt: {
        sk: 'Prenos, izolačné opatrenia a hygiena rúk pri liečbe C. difficile.',
        en: 'Transmission, isolation precautions and hand hygiene while treating C. difficile.',
      },
    },
    {
      id: 'warfarin', slug: 'warfarin', category: 'chronicke',
      title: { sk: 'Užívanie warfarínu', en: 'Taking warfarin' },
      excerpt: {
        sk: 'Pravidelné kontroly INR, liekové a potravinové interakcie.',
        en: 'Regular INR monitoring, drug and dietary interactions.',
      },
    },
    {
      id: 'heparin', slug: 'heparin', category: 'chronicke',
      title: { sk: 'Aplikácia nízkomolekulárneho heparínu', en: 'Administering low-molecular-weight heparin' },
      excerpt: {
        sk: 'Postup podania injekcie doma a bezpečná likvidácia striekačiek.',
        en: 'How to self-inject at home and safely dispose of syringes.',
      },
    },
    {
      id: 'porod-info', slug: 'porod-info', category: 'materska',
      title: { sk: 'Informácie o pôrode', en: 'About childbirth' },
      excerpt: {
        sk: 'Čo si zbaliť do pôrodnice a ako prebieha príjem na pôrodnú sálu.',
        en: 'What to pack for the maternity ward and how admission to the delivery room works.',
      },
    },
    {
      id: 'novorodenec', slug: 'novorodenec', category: 'materska',
      title: { sk: 'Starostlivosť o novorodenca', en: 'Newborn care' },
      excerpt: {
        sk: 'Dojčenie, kúpanie a starostlivosť o pupočný pahýľ v prvých dňoch.',
        en: 'Feeding, bathing and umbilical-cord care in the first days.',
      },
    },
    {
      id: 'diastaza', slug: 'diastaza', category: 'materska',
      title: { sk: 'Diastáza brušných svalov po pôrode', en: 'Postpartum abdominal diastasis' },
      excerpt: {
        sk: 'Rozpoznanie diastázy a bezpečné cvičenia po pôrode.',
        en: 'Recognising diastasis and safe postpartum exercises.',
      },
    },
    {
      id: 'dieta9', slug: 'dieta9', category: 'dieta',
      title: { sk: 'Diabetická diéta č. 9', en: 'Diabetic diet No. 9' },
      excerpt: {
        sk: 'Zásady sacharidových jednotiek a plán stravovania pri diabete.',
        en: 'Carbohydrate-unit principles and a meal plan for diabetes.',
      },
    },
    {
      id: 'dieta5', slug: 'dieta5', category: 'dieta',
      title: { sk: 'Diéta so zníženým obsahom zvyškov č. 5', en: 'Residue-restricted diet No. 5' },
      excerpt: {
        sk: 'Potraviny vhodné pri ochoreniach tráviaceho traktu s nízkym obsahom vlákniny.',
        en: 'Low-fibre foods suited to digestive-tract conditions.',
      },
    },
    {
      id: 'dieta4', slug: 'dieta4', category: 'dieta',
      title: { sk: 'Diéta so zníženým obsahom tuku č. 4', en: 'Fat-restricted diet No. 4' },
      excerpt: {
        sk: 'Odporúčania pri ochoreniach pečene, žlčníka a pankreasu.',
        en: 'Guidance for liver, gallbladder and pancreatic conditions.',
      },
    },
    {
      id: 'dieta6', slug: 'dieta6', category: 'dieta',
      title: { sk: 'Diéta so zníženým obsahom bielkovín č. 6', en: 'Protein-restricted diet No. 6' },
      excerpt: {
        sk: 'Plán stravovania pri ochoreniach obličiek.',
        en: 'A meal plan for kidney disease.',
      },
    },
    {
      id: 'bezlepok', slug: 'bezlepok', category: 'dieta',
      title: { sk: 'Bezlepková diéta', en: 'Gluten-free diet' },
      excerpt: {
        sk: 'Potraviny bez lepku a čítanie etikiet pri celiakii.',
        en: 'Gluten-free foods and label-reading for celiac disease.',
      },
    },
    {
      id: 'lymfodrenaz', slug: 'lymfodrenaz', category: 'fyziatria',
      title: { sk: 'Lymfodrenáž', en: 'Lymphatic drainage' },
      excerpt: {
        sk: 'Ako prebieha manuálna lymfodrenáž a kedy je indikovaná.',
        en: 'How manual lymphatic drainage works and when it\'s indicated.',
      },
    },
    {
      id: 'dlaha', slug: 'dlaha', category: 'fyziatria',
      title: { sk: 'Motorová dlaha', en: 'Motor splint therapy' },
      excerpt: {
        sk: 'Používanie motorovej dlahy na obnovu pohybu kĺbu po operácii.',
        en: 'Using a motor splint to restore joint movement after surgery.',
      },
    },
    {
      id: 'ultrazvuk-terapia', slug: 'ultrazvuk-terapia', category: 'fyziatria',
      title: { sk: 'Ultrazvuková terapia', en: 'Ultrasound therapy' },
      excerpt: {
        sk: 'Účinky terapeutického ultrazvuku pri bolestiach kĺbov a mäkkých tkanív.',
        en: 'The effects of therapeutic ultrasound for joint and soft-tissue pain.',
      },
    },
  ],

  // From design_handoff_nemocnica_snina/assets/data.js `jobs`. The prototype's
  // apply flow is a `mailto:` link (kariera.html) — no CV upload form exists
  // in the source, so this type carries only what the data actually has.
  jobPostings: [
    { id: 'j1', slug: 'j1', title: { sk: 'Lekár – pediater', en: 'Physician – Pediatrician' }, dept: 'pediatria', desc: { sk: 'Diagnostická a liečebno-preventívna starostlivosť o pacientov detského oddelenia. Vhodné aj pre absolventov. Výhodou je špecializácia v odbore pediatria.', en: 'Diagnostic and therapeutic-preventive care for pediatric ward patients. Open to recent graduates. Pediatric specialisation is an advantage.' } },
    { id: 'j2', slug: 'j2', title: { sk: 'Lekár – internista', en: 'Physician – Internist' }, dept: 'interne', desc: { sk: 'Diagnostická a liečebno-preventívna starostlivosť o pacientov interného oddelenia. Výhodou je špecializácia v internej medicíne a postupová skúška — internistický kmeň.', en: 'Diagnostic and therapeutic-preventive care for internal medicine patients. Internal-medicine specialisation and the core-exam are an advantage.' } },
    { id: 'j3', slug: 'j3', title: { sk: 'Lekár – anestéziológ a intenzivista', en: 'Physician – Anesthesiologist & Intensivist' }, dept: 'oaim', desc: { sk: 'Starostlivosť o pacientov OAIM. Ponúkame plný úväzok, čiastočný úväzok aj ústavnú pohotovostnú službu (ÚPS).', en: 'Care for OAIM patients. Full-time, part-time, and on-call service (ÚPS) all available.' } },
    { id: 'j4', slug: 'j4', title: { sk: 'Lekár – gynekológ', en: 'Physician – Gynecologist' }, dept: 'gynekologia', desc: { sk: 'Diagnostická a liečebno-preventívna starostlivosť o pacientky gynekologicko-pôrodníckeho oddelenia. Špecializácia v gynekológii a pôrodníctve vítaná.', en: 'Diagnostic and therapeutic-preventive care for gynecology & obstetrics patients. Specialisation welcomed.' } },
    { id: 'j5', slug: 'j5', title: { sk: 'Lekár – diabetológ', en: 'Physician – Diabetologist' }, clinic: 'diabetologicka', desc: { sk: 'Ambulantná starostlivosť v odbore diabetológia, poruchy látkovej premeny a výživy. Vyžaduje sa špecializácia alebo zaradenie v tomto odbore.', en: 'Outpatient care in diabetology and metabolic disorders. Specialisation or enrolment in this field is required.' } },
  ],

  careersInfo: {
    contact: { sk: 'Erika Ferková · sekretariát konateľa', en: "Erika Ferková · Managing Director's Secretariat" },
    phone: '057/7871 226',
    benefits: [
      { sk: 'Podpora zvyšovania kvalifikácie a špecializačného štúdia', en: 'Support for further education and specialisation training' },
      { sk: 'Finančné benefity — príplatky, príspevky zo sociálneho fondu, motivačná zložka mzdy', en: 'Financial benefits — allowances, social-fund contributions, a motivational wage component' },
      { sk: 'Možnosť osobného rastu v stabilnej a rozvíjajúcej sa organizácii', en: 'Room for personal growth in a stable, growing organisation' },
    ],
  },

  // From design_handoff_nemocnica_snina/assets/data.js `patientInfo`. Prices
  // are compiled from the hospital's SM-06 (valid from 1 Oct 2025), biochemistry
  // and hematology price lists — formatted strings as published, not numbers.
  pricing: [
    { id: 'p1', category: { sk: 'Klinická biochémia', en: 'Clinical biochemistry' }, item: { sk: 'Základný biochemický panel (samoplatca)', en: 'Basic biochemistry panel (self-pay)' }, price: '18,00 €' },
    { id: 'p2', category: { sk: 'Klinická biochémia', en: 'Clinical biochemistry' }, item: { sk: 'Lipidový profil', en: 'Lipid panel' }, price: '12,50 €' },
    { id: 'p3', category: { sk: 'Hematológia', en: 'Hematology' }, item: { sk: 'Krvný obraz s diferenciálom', en: 'Complete blood count with differential' }, price: '9,00 €' },
    { id: 'p4', category: { sk: 'Hematológia', en: 'Hematology' }, item: { sk: 'Koagulačné vyšetrenie', en: 'Coagulation panel' }, price: '14,00 €' },
    { id: 'p5', category: { sk: 'Zobrazovacia diagnostika', en: 'Imaging' }, item: { sk: 'CT vyšetrenie (samoplatca, bez kontrastu)', en: 'CT scan (self-pay, without contrast)' }, price: '85,00 €' },
    { id: 'p6', category: { sk: 'Zobrazovacia diagnostika', en: 'Imaging' }, item: { sk: 'Ultrazvukové vyšetrenie', en: 'Ultrasound scan' }, price: '25,00 €' },
    { id: 'p7', category: { sk: 'Ústavná starostlivosť', en: 'Inpatient care' }, item: { sk: 'Nadštandardná izba (gynekologicko-pôrodnícke odd., za deň)', en: 'Premium room (gynecology & obstetrics, per day)' }, price: '8,00 €' },
    { id: 'p8', category: { sk: 'Administratíva', en: 'Administrative' }, item: { sk: 'Poplatok LSPP (ambulantná pohotovostná služba)', en: 'LSPP fee (ambulatory emergency service)' }, price: '1,99 €' },
  ],

  // `clinic` is a display name, deliberately not a Clinic.id reference — see
  // ClinicWaitingTime's doc comment in packages/types.
  waitingTimes: [
    { id: 'w1', clinic: { sk: 'Urologická ambulancia', en: 'Urology clinic' }, wait: { sk: 'do 1 týždňa — nová ambulancia', en: 'within 1 week — new clinic' }, level: 'good' },
    { id: 'w2', clinic: { sk: 'Angiologická ambulancia', en: 'Angiology clinic' }, wait: { sk: '2–3 týždne · vyžaduje sa výmenný lístok', en: '2–3 weeks · referral required' }, level: 'ok' },
    { id: 'w3', clinic: { sk: 'Hematologická ambulancia', en: 'Hematology clinic' }, wait: { sk: '1–2 týždne', en: '1–2 weeks' }, level: 'good' },
    { id: 'w4', clinic: { sk: 'Diabetologická ambulancia', en: 'Diabetology clinic' }, wait: { sk: 'dočasne neprijíma nových pacientov', en: 'temporarily not accepting new patients' }, level: 'closed' },
    { id: 'w5', clinic: { sk: 'Neurologická ambulancia', en: 'Neurology clinic' }, wait: { sk: 'dočasný režim — náhradný kontakt 0918 088 183', en: 'temporary measures — substitute contact 0918 088 183' }, level: 'closed' },
    { id: 'w6', clinic: { sk: 'Fyziatricko-rehabilitačné oddelenie (FRO)', en: 'Physiatry & rehabilitation (FRO)' }, wait: { sk: 'do 2 týždňov · pilotné online objednávanie', en: 'up to 2 weeks · online-booking pilot' }, level: 'good' },
  ],

  testimonials: [
    { id: 't1', quote: { sk: 'Personál gynekologicko-pôrodníckeho oddelenia bol počas pôrodu mimoriadne empatický a trpezlivý.', en: 'The staff on the maternity ward were extraordinarily empathetic and patient throughout my delivery.' }, author: { sk: 'Pacientka · Gynekologicko-pôrodnícke oddelenie', en: 'Patient · Gynecology & Obstetrics' } },
    { id: 't2', quote: { sk: 'Rýchle a presné vyšetrenie, personál ma upokojil počas celého zákroku.', en: 'Fast, precise care — the staff kept me calm throughout the procedure.' }, author: { sk: 'Pacient · Chirurgicko-traumatologické oddelenie', en: 'Patient · Surgery & Traumatology' } },
    { id: 't3', quote: { sk: 'Nová centrálna recepcia mi ušetrila veľa času, hneď som vedel, kam ísť.', en: 'The new central reception saved me a lot of time — I knew exactly where to go.' }, author: { sk: 'Pacient · Ambulantná starostlivosť', en: 'Patient · Outpatient care' } },
  ],

  // From design_handoff_nemocnica_snina/assets/data.js `aboutInfo`, as corrected
  // against the live site by the content migration. Governance facts here are
  // load-bearing (named committee chairs, the whistleblower email, the real ISO
  // certificate number, the INEKO placement) — re-sync from data.js rather than
  // editing values here in isolation.
  aboutInfo: {
    owner: {
      sk: '100 % vlastníkom spoločnosti je Mesto Snina, v zastúpení primátorom Petrom Vološinom.',
      en: 'The company is 100% owned by the City of Snina, represented by Mayor Peter Vološin.',
    },
    leadership: {
      sk: 'Nemocnicu vedie MUDr. Andrej Kulan, ktorý zároveň pôsobí ako konateľ spoločnosti a primár chirurgicko-traumatologického oddelenia. Nemocnica aktívne žiada o zaradenie medzi urgentné príjmy 1. typu v rámci reformy Optimalizácie siete nemocníc (OSN).',
      en: 'The hospital is led by MUDr. Andrej Kulan, who serves as both managing director and Head of Surgery & Traumatology. The hospital has petitioned for Type 1 urgent-care status under the national Hospital Network Optimisation (OSN) reform.',
    },
    ethics: {
      sk: 'Etickú komisiu vedie MUDr. Norbert Orinín. Komisia posudzuje klinické štúdie a etické otázky starostlivosti a metodicky usmerňuje personál v otázkach informovaného súhlasu a dôstojnosti pacienta.',
      en: 'The ethics committee is chaired by MUDr. Norbert Orinín. It reviews clinical studies and care-related ethics questions, and guides staff on informed consent and patient dignity.',
    },
    adverseEvents: {
      sk: 'Nemocnica zverejňuje výročné prehľady nežiaducich udalostí (2016–2025) na stiahnutie, v záujme transparentnosti a v súlade s regulačnými požiadavkami. Pacienti a návštevy môžu udalosť nahlásiť cez sekretariát alebo formulár sťažností.',
      en: 'The hospital publishes downloadable annual adverse-event reports (2016–2025) for transparency and regulatory compliance. Patients and visitors can report an event via the secretariat or the complaints form.',
    },
    antiCorruption: {
      sk: 'Podozrenie na korupčné správanie možno nahlásiť dôverne e-mailom na sekretariat@nemocnicasnina.sk, nezávisle od bežného sťažnostného konania. Podnety sa posudzujú podľa zákona č. 307/2014 Z. z. o ochrane oznamovateľov; evidujú sa len podania s aktuálnymi, konkrétnymi a overiteľnými informáciami preukazujúcimi korupciu.',
      en: 'Suspected corrupt conduct can be reported confidentially by email at sekretariat@nemocnicasnina.sk, independent of the standard complaints process. Reports are handled under Act No. 307/2014 Coll. on whistleblower protection; only submissions with current, specific, verifiable evidence of corruption are recorded.',
    },
    transfusionCommittee: {
      sk: 'Transfúzna komisia, ktorú vedie MUDr. Norbert Orinín, dohliada na racionálnu a účelnú hemoterapiu a bezpečné používanie krvi a krvných derivátov naprieč oddeleniami, vrátane sledovania nežiaducich transfúznych reakcií.',
      en: 'The transfusion committee, chaired by MUDr. Norbert Orinín, oversees rational and purposeful hemotherapy and the safe use of blood and blood products across departments, including monitoring adverse transfusion reactions.',
    },
    rankings: {
      sk: 'Inštitút pre ekonomické a sociálne reformy (INEKO) v spolupráci s Transparency International Slovensko pravidelne hodnotí nemocnicu podľa kvality, efektívnosti a spokojnosti pacientov. V roku 2026 sa nemocnica umiestnila na 12. mieste zo 43 všeobecných nemocníc v hodnotení poistencov zdravotnej poisťovne Dôvera.',
      en: 'The Institute for Economic and Social Reforms (INEKO), with Transparency International Slovakia, regularly ranks the hospital on quality, efficiency and patient satisfaction. In 2026 the hospital ranked 12th of 43 general hospitals in a Dôvera health-insurer patient-satisfaction survey.',
    },
    board: [
      'Marek Gerboc', 'Mgr. Jana Karľová', 'JUDr. Tomáš Kirňák', 'Marián Lojan',
      'Tomáš Potocký', 'Mgr. Mária Todáková', 'Ing. Michal Vohar', 'Ing. Dana Mariničová',
    ],
    financials: { revenue: '14 027 000 €', assets: '4 039 000 €', profit: '398 000 €', year: '2024' },
  },

  leadershipTeam: [
    { id: 'kulan', name: 'MUDr. Andrej Kulan', role: { sk: 'Konateľ spoločnosti', en: 'Managing director' }, phone: '057/7871 226', email: 'sekretariat@nemocnicasnina.sk' },
    { id: 'simonova', name: 'Ing. Iveta Šimonová', role: { sk: 'Vedúca ekonomicko-technického úseku', en: 'Head of Economic & Technical Division' }, phone: '057/7871 640', email: 'ekonom@nemocnicasnina.sk' },
    { id: 'orinin', name: 'MUDr. Norbert Orinín', role: { sk: 'Námestník pre liečebno-preventívnu starostlivosť', en: 'Deputy Director for Medical Care' }, phone: '057/7871 242', email: 'nemocnica@nemocnicasnina.sk' },
    { id: 'kapakova', name: 'PhDr. Jana Kapáková, MBA', role: { sk: 'Námestníčka pre ošetrovateľstvo', en: 'Deputy Director for Nursing' }, phone: '057/7871 245', email: 'namosetrovatelstvo@nemocnicasnina.sk' },
  ],

  history: [
    { id: 'h1945', year: '1945', text: { sk: 'Vznik Ligy proti TBC a poradne pre matky — základ zdravotnej starostlivosti v regióne.', en: 'The League against TB and a maternal counselling centre are founded — the origin of regional healthcare.' } },
    { id: 'h1948', year: '1948', text: { sk: 'Založený Okresný ústav národného zdravia (OÚNZ) pod vedením MUDr. Gabriela Hoffmanna.', en: 'The District Institute of National Health (OÚNZ) is founded, led by Dr. Gabriel Hoffmann.' } },
    { id: 'h1951', year: '1951–1952', text: { sk: 'Otvorené samostatné detské a gynekologické oddelenie.', en: 'Independent pediatric and gynecological wards open.' } },
    { id: 'h1963', year: '1963', text: { sk: 'Slávnostné otvorenie hlavnej nemocničnej budovy so 180 lôžkami.', en: 'The main 180-bed hospital building officially opens.' } },
    { id: 'h1985', year: '1985', text: { sk: 'Vzniká samostatné oddelenie anestéziológie a resuscitácie (ARO).', en: 'An independent Anesthesiology & Resuscitation department (ARO) is established.' } },
    { id: 'h1991', year: '1991', text: { sk: 'Nemocnica sa stáva samostatným právnym subjektom.', en: 'The hospital becomes an independent legal entity.' } },
    { id: 'h2006', year: '2006', text: { sk: 'Transformácia na mestskú spoločnosť; vznik JIS na chirurgickom a internom oddelení; spustenie jednodňovej chirurgie.', en: 'Transformation into a municipal company; ICUs established on the surgical and internal-medicine wards; day-surgery launched.' } },
    { id: 'h2007', year: '2007', text: { sk: 'Uvedenie mamografického pracoviska do prevádzky.', en: 'A mammography unit is commissioned.' } },
    { id: 'h2008', year: '2008', text: { sk: 'Prvé pracovisko počítačovej tomografie (CT).', en: 'The first computed tomography (CT) workplace opens.' } },
    { id: 'h2024', year: '2024', text: { sk: 'Spustenie centrálnej recepcie a nových ambulancií — urológia, angiológia.', en: 'Central reception launches, alongside new urology and angiology clinics.' } },
    { id: 'h2025', year: '2025–2026', text: { sk: 'Komplexná modernizácia rádiológie z Plánu obnovy — nové CT, sonografia, C-rameno; rozšírenie o jednodňovú urologickú starostlivosť.', en: 'Comprehensive radiology modernisation via the Recovery & Resilience Plan — new CT, sonography, C-arm; expansion into one-day urological care.' } },
  ],

  investments: [
    { id: 'i-radiologia', amount: '340 000 €', desc: { sk: 'Modernizácia rádiológie z Plánu obnovy a odolnosti SR — nové CT, sonografia, chirurgické C-rameno.', en: 'Radiology modernisation via the Recovery & Resilience Plan — new CT scanner, sonography, surgical C-arm.' } },
    { id: 'i-endoskopia', amount: '50 000 €', desc: { sk: 'Mestská dotácia na nové gastroskopy a kolonoskopy.', en: 'Municipal subsidy for new gastroscopes and colonoscopes.' } },
  ],

  certifications: [
    { id: 'iso-9001-2015', name: 'ISO 9001:2015', desc: { sk: 'Systém manažérstva kvality (SK08/0393, SGS Slovakia, akreditácia SNAS). Nadväzuje na certifikáciu ISO 9001:2008 (certifikovaní od októbra 2005).', en: 'Quality management system (certificate SK08/0393, SGS Slovakia, SNAS-accredited). Succeeds the ISO 9001:2008 certification (certified since October 2005).' } },
    { id: 'iso-9001-2008', name: 'ISO 9001:2008', desc: { sk: 'Historická certifikácia systému manažérstva kvality, platná 2014–2017; nahradená ISO 9001:2015.', en: 'Historical quality-management-system certification, valid 2014–2017; superseded by ISO 9001:2015.' } },
  ],
};
