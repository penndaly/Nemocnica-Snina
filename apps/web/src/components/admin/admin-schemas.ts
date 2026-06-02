/**
 * Admin CMS schema definitions — ported from assets/admin.js SCHEMAS/SINGLETONS.
 * These drive the list views and schema-driven editor.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'bool'
  | 'biltext'
  | 'biltextarea'
  | 'billist'
  | 'select'
  | 'ref'
  | 'tags';

export interface SelectOption {
  v: string;
  l: { sk: string; en: string };
}

export interface FieldDef {
  k: string;
  t: FieldType;
  label: { sk: string; en: string };
  opts?: SelectOption[];
  ref?: string;
}

export interface CollectionSchema {
  label: { sk: string; en: string };
  icon: string;
  title: string;
  idFrom?: string;
  titlePlain?: boolean;
  idEditable?: boolean;
  fields: FieldDef[];
}

export interface SingletonGroup {
  title: { sk: string; en: string };
  path: string;
  fields: FieldDef[];
}

export interface SingletonSchema {
  label: { sk: string; en: string };
  icon: string;
  fields?: FieldDef[];
  groups?: SingletonGroup[];
}

const STATUS_OPTS: SelectOption[] = [
  { v: 'open',   l: { sk: 'V prevádzke',          en: 'Open'              } },
  { v: 'new',    l: { sk: 'Nová · prijíma',        en: 'New · accepting'   } },
  { v: 'alert',  l: { sk: 'Dočasný režim',         en: 'Temporary measures'} },
  { v: 'closed', l: { sk: 'Mimo prevádzky',        en: 'Closed'            } },
];

const NEWS_TYPE_OPTS: SelectOption[] = [
  { v: 'good',  l: { sk: 'Pozitívne / Nová služba', en: 'Good / New service' } },
  { v: 'info',  l: { sk: 'Informácia',              en: 'Info'               } },
  { v: 'alert', l: { sk: 'Upozornenie',             en: 'Alert'              } },
];

const ICON_OPTS: SelectOption[] = [
  'scalpel','heart','activity','stethoscope','pulse','shield','flask','scan','pill'
].map((v) => ({ v, l: { sk: v, en: v } }));

export const SCHEMAS: Record<string, CollectionSchema> = {
  departments: {
    label: { sk: 'Oddelenia',      en: 'Departments' }, icon: 'building', title: 'short', idFrom: 'short',
    fields: [
      { k: 'name',      t: 'biltext',    label: { sk: 'Plný názov',          en: 'Full name'          } },
      { k: 'short',     t: 'biltext',    label: { sk: 'Krátky názov',        en: 'Short name'         } },
      { k: 'lead',      t: 'text',       label: { sk: 'Vedúci lekár',        en: 'Head physician'     } },
      { k: 'leadRole',  t: 'biltext',    label: { sk: 'Funkcia vedúceho',    en: 'Head role'          } },
      { k: 'deputy',    t: 'text',       label: { sk: 'Zástupca',            en: 'Deputy'             } },
      { k: 'beds',      t: 'number',     label: { sk: 'Počet lôžok',         en: 'Beds'               } },
      { k: 'phone',     t: 'text',       label: { sk: 'Telefón',             en: 'Phone'              } },
      { k: 'email',     t: 'text',       label: { sk: 'E-mail',              en: 'Email'              } },
      { k: 'delivery',  t: 'text',       label: { sk: 'Pôrodná sála (tel.)', en: 'Delivery room (tel.)' } },
      { k: 'featured',  t: 'bool',       label: { sk: 'Zobraziť na úvode',   en: 'Feature on home'    } },
      { k: 'summary',   t: 'biltextarea',label: { sk: 'Stručný popis',       en: 'Summary'            } },
      { k: 'desc',      t: 'biltextarea',label: { sk: 'Podrobný popis',      en: 'Description'        } },
      { k: 'facilities',t: 'billist',    label: { sk: 'Vybavenie (1/riadok)',en: 'Facilities (1/line)' } },
      { k: 'visiting',  t: 'biltext',    label: { sk: 'Návštevné hodiny',    en: 'Visiting hours'     } },
    ],
  },
  clinics: {
    label: { sk: 'Ambulancie', en: 'Clinics' }, icon: 'calendar', title: 'name', idFrom: 'name',
    fields: [
      { k: 'name',          t: 'biltext',    label: { sk: 'Názov ambulancie',            en: 'Clinic name'         } },
      { k: 'specialty',     t: 'biltext',    label: { sk: 'Odbornosť',                  en: 'Specialty'           } },
      { k: 'doctor',        t: 'text',       label: { sk: 'Lekár(i)',                   en: 'Physician(s)'        } },
      { k: 'nurse',         t: 'text',       label: { sk: 'Sestra',                     en: 'Nurse'               } },
      { k: 'location',      t: 'biltext',    label: { sk: 'Umiestnenie',                en: 'Location'            } },
      { k: 'phone',         t: 'text',       label: { sk: 'Telefón',                    en: 'Phone'               } },
      { k: 'status',        t: 'select',     label: { sk: 'Stav',                       en: 'Status'              }, opts: STATUS_OPTS },
      { k: 'bookable',      t: 'bool',       label: { sk: 'Online objednávanie',        en: 'Online booking'      } },
      { k: 'referral',      t: 'bool',       label: { sk: 'Vyžaduje výmenný lístok',   en: 'Referral required'   } },
      { k: 'acceptingNew',  t: 'bool',       label: { sk: 'Prijíma nových pacientov',  en: 'Accepting new patients'} },
      { k: 'bookingDays',   t: 'text',       label: { sk: 'Dni objednania (Po=1…Ne=0)', en: 'Booking days (Mon=1…Sun=0)' } },
      { k: 'bookingWindow', t: 'text',       label: { sk: 'Časové okno (13:00–14:00)', en: 'Booking window (13:00–14:00)' } },
      { k: 'schedule',      t: 'billist',    label: { sk: 'Ordinačné hodiny (1/riadok)',en: 'Operating hours (1/line)'   } },
      { k: 'bookingRule',   t: 'biltextarea',label: { sk: 'Pravidlo objednávania',      en: 'Booking rule'        } },
      { k: 'fee',           t: 'biltext',    label: { sk: 'Poplatok (voliteľné)',        en: 'Fee (optional)'      } },
    ],
  },
  physicians: {
    label: { sk: 'Lekári', en: 'Physicians' }, icon: 'user', title: 'name', idFrom: 'name', titlePlain: true,
    fields: [
      { k: 'name',      t: 'text',       label: { sk: 'Meno (vrátane titulov)', en: 'Name (with titles)'   } },
      { k: 'role',      t: 'biltext',    label: { sk: 'Pozícia / Odbornosť',  en: 'Role / Specialty'     } },
      { k: 'bio',       t: 'biltextarea',label: { sk: 'Profil',               en: 'Bio'                   } },
      { k: 'accepting', t: 'bool',       label: { sk: 'Prijíma nových',       en: 'Accepting new patients'} },
      { k: 'dept',      t: 'ref',        label: { sk: 'Oddelenie',            en: 'Department'            }, ref: 'departments' },
      { k: 'clinic',    t: 'ref',        label: { sk: 'Ambulancia',           en: 'Clinic'                }, ref: 'clinics'     },
      { k: 'facility',  t: 'ref',        label: { sk: 'Pracovisko',           en: 'Facility'              }, ref: 'facilities'  },
      { k: 'langs',     t: 'tags',       label: { sk: 'Jazyky (čiarka)',      en: 'Languages (csv)'       } },
    ],
  },
  services: {
    label: { sk: 'Služby', en: 'Services' }, icon: 'activity', title: 'name', idFrom: 'name',
    fields: [
      { k: 'name',     t: 'biltext',    label: { sk: 'Názov',            en: 'Name'               } },
      { k: 'desc',     t: 'biltextarea',label: { sk: 'Popis',            en: 'Description'        } },
      { k: 'icon',     t: 'select',     label: { sk: 'Ikona',            en: 'Icon'               }, opts: ICON_OPTS },
      { k: 'dept',     t: 'ref',        label: { sk: 'Oddelenie',        en: 'Department'         }, ref: 'departments' },
      { k: 'clinic',   t: 'ref',        label: { sk: 'Ambulancia',       en: 'Clinic'             }, ref: 'clinics'     },
      { k: 'facility', t: 'ref',        label: { sk: 'Pracovisko',       en: 'Facility'           }, ref: 'facilities'  },
    ],
  },
  facilities: {
    label: { sk: 'Diagnostika', en: 'Facilities' }, icon: 'flask', title: 'name', idFrom: 'name',
    fields: [
      { k: 'name',     t: 'biltext',    label: { sk: 'Názov pracoviska', en: 'Facility name' } },
      { k: 'lead',     t: 'text',       label: { sk: 'Vedúci',           en: 'Lead'          } },
      { k: 'phone',    t: 'text',       label: { sk: 'Telefón',          en: 'Phone'         } },
      { k: 'kind',     t: 'biltext',    label: { sk: 'Zameranie',        en: 'Kind'          } },
      { k: 'desc',     t: 'biltextarea',label: { sk: 'Popis',            en: 'Description'   } },
      { k: 'features', t: 'billist',    label: { sk: 'Vlastnosti (1/riadok)', en: 'Features (1/line)' } },
    ],
  },
  news: {
    label: { sk: 'Aktuality', en: 'News' }, icon: 'doc', title: 'title', idFrom: 'title',
    fields: [
      { k: 'title', t: 'biltext',    label: { sk: 'Titulok',     en: 'Title' } },
      { k: 'body',  t: 'biltextarea',label: { sk: 'Text oznamu', en: 'Body'  } },
      { k: 'tag',   t: 'biltext',    label: { sk: 'Štítok',      en: 'Tag'   } },
      { k: 'type',  t: 'select',     label: { sk: 'Typ',         en: 'Type'  }, opts: NEWS_TYPE_OPTS },
      { k: 'date',  t: 'date',       label: { sk: 'Dátum',       en: 'Date'  } },
    ],
  },
  disclosures: {
    label: { sk: 'Zverejňovanie', en: 'Disclosures' }, icon: 'download', title: 'partner', idEditable: true,
    fields: [
      { k: 'id',      t: 'text', label: { sk: 'Číslo dokumentu',  en: 'Document ID'       } },
      { k: 'type',    t: 'biltext', label: { sk: 'Typ (Zmluva/Faktúra)', en: 'Type'        } },
      { k: 'partner', t: 'text', label: { sk: 'Partner / Predmet', en: 'Partner / Subject' } },
      { k: 'value',   t: 'text', label: { sk: 'Hodnota',           en: 'Value'             } },
      { k: 'date',    t: 'date', label: { sk: 'Dátum',             en: 'Date'              } },
    ],
  },
};

export const SINGLETONS: Record<string, SingletonSchema> = {
  hospital: {
    label: { sk: 'Údaje o nemocnici', en: 'Hospital info' }, icon: 'shield',
    fields: [
      { k: 'name',      t: 'text',   label: { sk: 'Názov',     en: 'Name'     } },
      { k: 'tagline',   t: 'biltext',label: { sk: 'Podtitul',  en: 'Tagline'  } },
      { k: 'address',   t: 'text',   label: { sk: 'Adresa',    en: 'Address'  } },
      { k: 'ico',       t: 'text',   label: { sk: 'IČO',       en: 'Reg. no.' } },
      { k: 'dic',       t: 'text',   label: { sk: 'DIČ',       en: 'Tax ID'   } },
      { k: 'phone',     t: 'text',   label: { sk: 'Centrála',  en: 'Switchboard' } },
      { k: 'reception', t: 'text',   label: { sk: 'Recepcia',  en: 'Reception'   } },
      { k: 'pharmacy',  t: 'text',   label: { sk: 'Lekáreň',   en: 'Pharmacy'    } },
      { k: 'email',     t: 'text',   label: { sk: 'E-mail',    en: 'Email'        } },
      { k: 'region',    t: 'biltext',label: { sk: 'Región',    en: 'Region'      } },
    ],
  },
  pages: {
    label: { sk: 'Obsah stránok', en: 'Page content' }, icon: 'edit',
    groups: [
      {
        title: { sk: 'Úvodný banner (Hero)', en: 'Hero banner' }, path: 'hero',
        fields: [
          { k: 'badge',    t: 'biltext',    label: { sk: 'Štítok',    en: 'Badge'    } },
          { k: 'title',    t: 'biltext',    label: { sk: 'Nadpis',    en: 'Title'    } },
          { k: 'subtitle', t: 'biltextarea',label: { sk: 'Podnadpis', en: 'Subtitle' } },
        ],
      },
      {
        title: { sk: 'O nemocnici', en: 'About' }, path: 'about',
        fields: [
          { k: 'title', t: 'biltext',    label: { sk: 'Nadpis', en: 'Title' } },
          { k: 'body',  t: 'biltextarea',label: { sk: 'Text',   en: 'Body'  } },
        ],
      },
      {
        title: { sk: 'Pohotovosť (APS)', en: 'Emergency (APS)' }, path: 'aps',
        fields: [
          { k: 'title', t: 'biltext',    label: { sk: 'Nadpis', en: 'Title' } },
          { k: 'note',  t: 'biltextarea',label: { sk: 'Text',   en: 'Note'  } },
        ],
      },
    ],
  },
};

export const COLLECTION_KEYS = Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[];
export const SINGLETON_KEYS = Object.keys(SINGLETONS) as (keyof typeof SINGLETONS)[];
