import React, { useState } from 'react';
import { 
  HeartPulse, Phone, AlertCircle, Calendar, Video, FileText, 
  Globe, Menu, X, ChevronRight, Activity, Shield, Users, 
  Stethoscope, Download, Lock, Search, User, Key, Pill, Microscope, LogOut, FileDigit, Clock
} from 'lucide-react';

// --- Multilingual Localization Dictionary ---
// Simulates the payload that would be returned/cached from the Google Cloud Translation API (Advanced v3)
const i18n = {
  sk: {
    hospitalName: "Nemocnica Snina, s.r.o.",
    emergency: "Pohotovosť",
    callAmbulance: "Volať 112",
    nav: { home: "Domov", depts: "Oddelenia a Ambulancie", telehealth: "Telemedicína", portal: "Pacientsky Portál", contracts: "Zverejňovanie informácií" },
    heroTitle: "Moderná zdravotná starostlivosť pre náš región",
    heroSub: "Poskytujeme špičkovú, dostupnú a súcitnú starostlivosť na schengenskej hranici.",
    findDoc: "Nájsť lekára",
    bookAppt: "Objednať termín",
    deptTitle: "Lôžkové oddelenia",
    clinicTitle: "Špecializované ambulancie (SVALZ)",
    beds: "lôžok",
    director: "Primár",
    telehealthTitle: "Zabezpečená virtuálna klinika (Google Meet)",
    intakeForm: "Digitálny vstupný formulár (FHIR integrácia)",
    joinWaitroom: "Vstúpiť do virtuálnej čakárne",
    contractsTitle: "Zverejňovanie informácií (Zmluvy a Faktúry)",
    accessibility: "Vyhlásenie o prístupnosti (WCAG 2.1 AA)",
    portalUI: {
      loginTitle: "Zabezpečený vstup (eZdravie)",
      loginSub: "Prihláste sa pomocou Vášho Rodného čísla a PIN kódu.",
      idLabel: "Rodné číslo",
      pinLabel: "PIN Kód",
      loginBtn: "Autorizovať a vstúpiť",
      welcome: "Vitajte",
      overview: "Prehľad",
      records: "Zdravotné záznamy (FHIR)",
      meds: "e-Recepty",
      labs: "Laboratórne výsledky",
      logout: "Odhlásiť sa"
    }
  },
  en: {
    hospitalName: "Nemocnica Snina",
    emergency: "Emergency",
    callAmbulance: "Call 112",
    nav: { home: "Home", depts: "Departments & Clinics", telehealth: "Telehealth", portal: "Patient Portal", contracts: "Public Disclosures" },
    heroTitle: "Modern Healthcare for Our Region",
    heroSub: "Providing excellent, accessible, and compassionate care at the Schengen border.",
    findDoc: "Find a Doctor",
    bookAppt: "Book Appointment",
    deptTitle: "Inpatient Departments",
    clinicTitle: "Specialized Clinics & Diagnostics",
    beds: "beds",
    director: "Director",
    telehealthTitle: "Secure Virtual Clinic (Google Meet Integration)",
    intakeForm: "Digital Intake Form (FHIR Pipeline)",
    joinWaitroom: "Join Virtual Waiting Room",
    contractsTitle: "Mandatory Disclosures (Contracts & Invoices)",
    accessibility: "Accessibility Statement (WCAG 2.1 AA)",
    portalUI: {
      loginTitle: "Secure Portal Login",
      loginSub: "Authenticate using your National ID and secure PIN.",
      idLabel: "National ID",
      pinLabel: "Security PIN",
      loginBtn: "Authenticate & Enter",
      welcome: "Welcome",
      overview: "Overview",
      records: "Health Records (FHIR)",
      meds: "e-Prescriptions",
      labs: "Lab Results",
      logout: "Sign Out"
    }
  },
  uk: {
    hospitalName: "Лікарня Снина",
    emergency: "Екстрена",
    callAmbulance: "Дзвонити 112",
    nav: { home: "Головна", depts: "Відділення", telehealth: "Телемедицина", portal: "Портал пацієнта", contracts: "Контракти" },
    heroTitle: "Сучасна медична допомога",
    heroSub: "Надання високоякісної медичної допомоги на кордоні Шенгенської зони.",
    findDoc: "Знайти лікаря",
    bookAppt: "Записатися на прийом",
    deptTitle: "Стаціонарні відділення",
    clinicTitle: "Спеціалізовані клініки",
    beds: "ліжок",
    director: "Директор",
    telehealthTitle: "Безпечна віртуальна клініка",
    intakeForm: "Цифрова форма прийому",
    joinWaitroom: "Приєднатися до черги",
    contractsTitle: "Розкриття інформації",
    accessibility: "Заява про доступність",
    portalUI: { loginTitle: "Безпечний вхід", loginSub: "Увійдіть за допомогою національного ID", idLabel: "ID", pinLabel: "PIN", loginBtn: "Увійти", welcome: "Вітаємо", overview: "Огляд", records: "Медичні записи", meds: "Електронні рецепти", labs: "Лабораторні результати", logout: "Вийти" }
  },
  pl: {
    hospitalName: "Szpital Snina",
    emergency: "Nagły Wypadek",
    callAmbulance: "Zadzwoń 112",
    nav: { home: "Główna", depts: "Oddziały", telehealth: "Telemedycyna", portal: "Portal Pacjenta", contracts: "Umowy" },
    heroTitle: "Nowoczesna Opieka Zdrowotna",
    heroSub: "Zapewniamy doskonałą opiekę na granicy strefy Schengen.",
    findDoc: "Znajdź Lekarza",
    bookAppt: "Umów Wizytę",
    deptTitle: "Oddziały Szpitalne",
    clinicTitle: "Poradnie Specjalistyczne",
    beds: "łóżek",
    director: "Dyrektor",
    telehealthTitle: "Wirtualna Klinika",
    intakeForm: "Cyfrowy Formularz",
    joinWaitroom: "Dołącz do Poczekalni",
    contractsTitle: "Ujawnianie Informacji",
    accessibility: "Deklaracja Dostępności",
    portalUI: { loginTitle: "Bezpieczne Logowanie", loginSub: "Zaloguj się używając numeru PESEL", idLabel: "PESEL", pinLabel: "PIN", loginBtn: "Zaloguj", welcome: "Witaj", overview: "Przegląd", records: "Dokumentacja Medyczna", meds: "e-Recepty", labs: "Wyniki Badań", logout: "Wyloguj" }
  },
  hu: {
    hospitalName: "Snina Kórház",
    emergency: "Sürgősségi",
    callAmbulance: "Hívja a 112-t",
    nav: { home: "Főoldal", depts: "Osztályok", telehealth: "Telemedicina", portal: "Betegportál", contracts: "Szerződések" },
    heroTitle: "Modern Egészségügy",
    heroSub: "Kiváló ellátást biztosítunk a schengeni határon.",
    findDoc: "Orvos Keresése",
    bookAppt: "Időpontfoglalás",
    deptTitle: "Fekvőbeteg Osztályok",
    clinicTitle: "Szakrendelők",
    beds: "ágy",
    director: "Igazgató",
    telehealthTitle: "Virtuális Klinika",
    intakeForm: "Digitális Űrlap",
    joinWaitroom: "Belépés a Váróterembe",
    contractsTitle: "Nyilvános Közzétételek",
    accessibility: "Akadálymentesítési Nyilatkozat",
    portalUI: { loginTitle: "Biztonságos Bejelentkezés", loginSub: "Jelentkezzen be személyi igazolványával", idLabel: "Azonosító", pinLabel: "PIN", loginBtn: "Belépés", welcome: "Üdvözöljük", overview: "Áttekintés", records: "Egészségügyi Nyilvántartások", meds: "e-Receptek", labs: "Laboreredmények", logout: "Kijelentkezés" }
  },
  cs: {
    hospitalName: "Nemocnice Snina",
    emergency: "Pohotovost",
    callAmbulance: "Volat 112",
    nav: { home: "Domů", depts: "Oddělení", telehealth: "Telemedicína", portal: "Pacientský Portál", contracts: "Smlouvy" },
    heroTitle: "Moderní Zdravotní Péče",
    heroSub: "Poskytujeme vynikající péči na schengenské hranici.",
    findDoc: "Najít Lékaře",
    bookAppt: "Objednat Termín",
    deptTitle: "Lůžková Oddělení",
    clinicTitle: "Specializované Ambulance",
    beds: "lůžek",
    director: "Primář",
    telehealthTitle: "Virtuální Klinika",
    intakeForm: "Digitální Formulář",
    joinWaitroom: "Vstoupit do Čekárny",
    contractsTitle: "Zveřejňování Informací",
    accessibility: "Prohlášení o Přístupnosti",
    portalUI: { loginTitle: "Zabezpečený Vstup", loginSub: "Přihlaste se pomocí Rodného čísla", idLabel: "Rodné číslo", pinLabel: "PIN", loginBtn: "Přihlásit", welcome: "Vítejte", overview: "Přehled", records: "Zdravotní Záznamy", meds: "e-Recepty", labs: "Laboratorní Výsledky", logout: "Odhlásit se" }
  }
};

// --- Clinical Database Schema Simulation ---
const inpatientDepartments = [
  { id: 'int', name: 'Internal Medicine (Interné oddelenie)', beds: 57, director: 'MUDr. Jana Borščová', desc: 'Includes 3-bed ICU (JIS) for acute cardiopulmonary conditions.', icon: <Activity className="w-6 h-6 text-blue-600" /> },
  { id: 'surg', name: 'Surgery and Traumatology (Chirurgicko-traumatologické)', beds: 47, director: 'MUDr. Andrej Kulan (Hospital Director)', desc: 'Comprehensive surgical care and trauma response.', icon: <Stethoscope className="w-6 h-6 text-blue-600" /> },
  { id: 'gyn', name: 'Gynecology and Obstetrics (Gynekologicko-pôrodnícke)', beds: 30, director: 'MUDr. František Pavlovčin', desc: 'Maternal health, delivery, and specialized gynecological care.', icon: <HeartPulse className="w-6 h-6 text-pink-500" /> },
  { id: 'ped', name: 'Pediatrics (Detské oddelenie)', beds: 15, director: 'MUDr. Miroslava Seňková, MBA', desc: 'Expert pediatric care for infants to adolescents.', icon: <Users className="w-6 h-6 text-green-500" /> },
  { id: 'neo', name: 'Neonatal (Novorodenecké oddelenie)', beds: 10, director: 'Attending Staff', desc: 'Specialized care for newborns.', icon: <HeartPulse className="w-6 h-6 text-purple-500" /> },
  { id: 'icu', name: 'Anesthesiology and Intensive Care (OAIM)', beds: 4, director: 'MUDr. Norbert Orinín', desc: 'Critical life support and perioperative care.', icon: <Activity className="w-6 h-6 text-red-500" /> },
];

const specializedClinics = [
  { id: 'rad', name: 'Radiodiagnostics', director: 'MUDr. Michal Lajtar', tag: 'Imaging' },
  { id: 'rehab', name: 'Physiatry & Rehabilitation', director: 'MUDr. Natália Kyjovská', tag: 'Therapy' },
  { id: 'bio', name: 'Clinical Biochem & Hematology', director: 'MUDr. Viera Coraničová', tag: 'Laboratory' },
  { id: 'uro', name: 'Urological Clinic', director: 'MUDr. Patrik Nebesník', tag: 'New Clinic' },
  { id: 'ang', name: 'Angiological Clinic', director: 'MUDr. Juraj Miko', tag: 'New Clinic' },
  { id: 'dia', name: 'Diabetology Clinic', director: 'MUDr. Lenka Lajtarová', tag: 'New Clinic' },
];

const publicContracts = [
  { id: 'INV-2023-01', type: 'Faktúra', partner: 'MedTech Medical Supplies, a.s.', amount: '€12,450.00', date: '2023-10-15' },
  { id: 'CON-2023-44', type: 'Zmluva', partner: 'Google Cloud EMEA (GCP BAA)', amount: 'N/A', date: '2023-09-01' },
  { id: 'INV-2023-02', type: 'Faktúra', partner: 'Slovak Energy Corp.', amount: '€8,200.00', date: '2023-10-10' },
  { id: 'CON-2023-45', type: 'Zmluva', partner: 'Siemens Healthineers (MRI Maint.)', amount: '€45,000.00/yr', date: '2023-08-20' },
];

// --- Patient FHIR Data Simulation ---
const mockPatientData = {
  patient: { name: "Jozef Mak", id: "850315/1234", dob: "1985-03-15", bloodType: "A+", status: "Active" },
  conditions: [
    { id: "C1", date: "2023-10-12", code: "I10", diagnosis: "Essential (primary) hypertension", status: "Active", doctor: "MUDr. Jana Borščová" },
    { id: "C2", date: "2021-04-05", code: "E11", diagnosis: "Type 2 diabetes mellitus", status: "Active", doctor: "MUDr. Lenka Lajtarová" }
  ],
  medications: [
    { id: "M1", date: "2023-10-12", name: "Nebivolol 5mg", dosage: "1x daily (Morning)", refills: 2, status: "Active" },
    { id: "M2", date: "2023-09-20", name: "Metformin 850mg", dosage: "2x daily (With meals)", refills: 1, status: "Active" }
  ],
  labs: [
    { id: "L1", date: "2023-09-28", test: "Lipid Panel", result: "Cholesterol 5.8 mmol/l", flag: "High", department: "Clinical Biochem" },
    { id: "L2", date: "2023-09-28", test: "HbA1c", result: "48 mmol/mol (6.5%)", flag: "Normal", department: "Clinical Biochem" }
  ]
};

export default function App() {
  const [lang, setLang] = useState('sk'); // Default to Slovak
  const [activeTab, setActiveTab] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Portal State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [portalView, setPortalView] = useState('overview');
  
  const t = i18n[lang] || i18n['en']; // Fallback

  const handleNav = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo(0,0);
  };

  // --------------------------------------------------------
  // SUB-COMPONENTS (Pages)
  // --------------------------------------------------------

  const HomeTab = () => (
    <div className="animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="relative bg-blue-900 text-white">
        <div className="absolute inset-0 bg-blue-900 opacity-90 pattern-grid-lg"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 flex flex-col md:flex-row items-center">
          <div className="md:w-2/3">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-800 border border-blue-700 text-sm mb-6">
              <Shield className="w-4 h-4 mr-2" /> Plán obnovy a odolnosti SR (11I02-21-P53)
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
              {t.heroTitle}
            </h1>
            <p className="text-xl text-blue-200 mb-8 max-w-2xl">
              {t.heroSub}
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => handleNav('depts')}
                className="bg-white text-blue-900 px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-gray-100 transition flex items-center">
                <Search className="w-5 h-5 mr-2" /> {t.findDoc}
              </button>
              <button 
                onClick={() => handleNav('telehealth')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold border border-blue-500 shadow-lg hover:bg-blue-500 transition flex items-center">
                <Calendar className="w-5 h-5 mr-2" /> {t.bookAppt}
              </button>
            </div>
          </div>
          {/* Quick Emergency Card */}
          <div className="md:w-1/3 mt-12 md:mt-0 md:pl-10 w-full">
            <div className="bg-white rounded-xl shadow-2xl p-6 text-gray-900 border-t-8 border-red-600">
              <div className="flex items-center mb-4 text-red-600">
                <AlertCircle className="w-8 h-8 mr-3" />
                <h3 className="text-2xl font-bold">{t.emergency}</h3>
              </div>
              <p className="text-gray-600 mb-6 border-b pb-4">In case of life-threatening emergencies, seek immediate assistance.</p>
              <div className="space-y-4">
                <button className="w-full bg-red-600 text-white px-4 py-4 rounded-lg font-bold text-xl hover:bg-red-700 transition flex justify-center items-center">
                  <Phone className="w-6 h-6 mr-2" /> {t.callAmbulance}
                </button>
                <div className="text-center text-sm text-gray-500">
                  Central Reception is open 24/7.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div onClick={() => handleNav('depts')} className="bg-gray-50 rounded-xl p-8 cursor-pointer hover:shadow-md transition border border-gray-100 group">
            <Activity className="w-10 h-10 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold mb-2 text-gray-900">{t.nav.depts}</h3>
            <p className="text-gray-600">Explore our specialized clinics, inpatient wards, and diagnostic facilities.</p>
          </div>
          <div onClick={() => handleNav('telehealth')} className="bg-gray-50 rounded-xl p-8 cursor-pointer hover:shadow-md transition border border-gray-100 group">
            <Video className="w-10 h-10 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold mb-2 text-gray-900">{t.nav.telehealth}</h3>
            <p className="text-gray-600">Access our secure, AI-translated Google Meet virtual clinics.</p>
          </div>
          <div onClick={() => handleNav('portal')} className="bg-gray-50 rounded-xl p-8 cursor-pointer hover:shadow-md transition border border-gray-100 group">
            <Lock className="w-10 h-10 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold mb-2 text-gray-900">{t.nav.portal}</h3>
            <p className="text-gray-600">View diagnostic results, FHIR health records, and secure billing.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const DepartmentsTab = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in">
      <div className="mb-12">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{t.deptTitle}</h2>
        <div className="w-20 h-1 bg-blue-600 rounded"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {inpatientDepartments.map(dept => (
          <div key={dept.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-blue-50 rounded-lg mr-4">
                {dept.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">{dept.name}</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4 min-h-[40px]">{dept.desc}</p>
            <div className="pt-4 border-t border-gray-100 flex flex-col space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">{t.director}:</span>
                <span className="font-semibold text-gray-900">{dept.director}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Capacity:</span>
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">{dept.beds} {t.beds}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-12">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{t.clinicTitle}</h2>
        <div className="w-20 h-1 bg-blue-600 rounded"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {specializedClinics.map(clinic => (
          <div key={clinic.id} className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col justify-between hover:border-blue-300 transition cursor-pointer">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-900">{clinic.name}</h4>
                {clinic.tag === 'New Clinic' && (
                  <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-1 rounded-full uppercase tracking-wider">New</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{clinic.director}</p>
            </div>
            <div className="mt-4 flex items-center text-blue-600 text-sm font-semibold">
              View Details <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const TelehealthTab = () => (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in">
      <div className="text-center mb-10">
        <Video className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-3xl font-extrabold text-gray-900">{t.telehealthTitle}</h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">Seamless, translated virtual consultations directly integrating with Google Workspace and Cloud Healthcare APIs.</p>
      </div>

      <div className="bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden">
        {/* Mock Virtual Waiting Room UI */}
        <div className="bg-blue-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="w-6 h-6 mr-3 text-blue-300" />
            <span className="font-semibold text-lg">Secure Session (HIPAA/GDPR Compliant)</span>
          </div>
          <span className="px-3 py-1 bg-blue-800 text-xs rounded-full border border-blue-700">End-to-End Encrypted</span>
        </div>
        
        <div className="p-8">
          <h3 className="text-xl font-bold mb-6 border-b pb-2">{t.intakeForm}</h3>
          <p className="text-sm text-gray-500 mb-6">
            Data submitted here is securely intercepted via Google Apps Script, converted to FHIR R4 resources, and routed to the secure Cloud Healthcare API datastore.
          </p>
          
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Jozef Mak" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">National ID / Rodné číslo</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="YYMMDD/XXXX" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Symptoms / Dôvod vyšetrenia</label>
              <textarea rows="3" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Please describe your symptoms..."></textarea>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start">
              <input type="checkbox" className="mt-1 mr-3 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" id="consent"/>
              <label htmlFor="consent" className="text-sm text-gray-700">
                I explicitly consent to the processing of my sensitive medical data in accordance with GDPR Article 9. I understand this data will be stored securely in the EU-central region via Google Cloud.
              </label>
            </div>

            <button className="w-full bg-green-600 text-white font-bold text-lg py-4 rounded-lg hover:bg-green-700 transition flex items-center justify-center shadow-lg">
              <Video className="w-6 h-6 mr-2" /> {t.joinWaitroom}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const ContractsTab = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{t.contractsTitle}</h2>
        <p className="text-gray-600">Povinné zverejňovanie informácií v zmysle Zákona o slobodnom prístupe k informáciám.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
            <input type="text" placeholder="Search contracts..." className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-80" />
          </div>
          <button className="text-blue-600 text-sm font-semibold hover:underline">Filter by Year</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {publicContracts.map((doc, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${doc.type === 'Zmluva' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.partner}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.amount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 flex items-center justify-end w-full">
                      <Download className="w-4 h-4 mr-1" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const PatientPortalTab = () => {
    const p = t.portalUI;

    if (!isLoggedIn) {
      return (
        <div className="max-w-md mx-auto px-4 py-24 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
            <div className="bg-blue-900 px-6 py-8 text-center text-white">
              <Shield className="w-12 h-12 mx-auto mb-4 text-blue-300" />
              <h2 className="text-2xl font-bold">{p.loginTitle}</h2>
              <p className="text-blue-200 text-sm mt-2">{p.loginSub}</p>
            </div>
            <form 
              className="p-8 space-y-6"
              onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); }}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{p.idLabel}</label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                  <input type="text" required className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="850315/1234" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{p.pinLabel}</label>
                <div className="relative">
                  <Key className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                  <input type="password" required className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="••••••" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold text-lg py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center shadow-lg">
                <Lock className="w-5 h-5 mr-2" /> {p.loginBtn}
              </button>
            </form>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-xs text-center text-gray-500">
              Authenticated via Google Cloud Identity platform. Data encrypted at rest (CMEK).
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
        {/* Portal Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="bg-blue-100 p-4 rounded-full mr-4">
              <User className="w-8 h-8 text-blue-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{p.welcome}, {mockPatientData.patient.name}</h2>
              <div className="flex items-center text-sm text-gray-500 mt-1 space-x-4">
                <span>ID: {mockPatientData.patient.id}</span>
                <span>Blood: <strong className="text-red-500">{mockPatientData.patient.bloodType}</strong></span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsLoggedIn(false)} className="flex items-center text-gray-500 hover:text-red-600 font-semibold transition px-4 py-2 border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50">
            <LogOut className="w-4 h-4 mr-2" /> {p.logout}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-24">
              <nav className="flex flex-col">
                <button onClick={() => setPortalView('overview')} className={`flex items-center px-6 py-4 font-semibold text-left transition ${portalView === 'overview' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}>
                  <Activity className="w-5 h-5 mr-3" /> {p.overview}
                </button>
                <button onClick={() => setPortalView('records')} className={`flex items-center px-6 py-4 font-semibold text-left transition ${portalView === 'records' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}>
                  <FileDigit className="w-5 h-5 mr-3" /> {p.records}
                </button>
                <button onClick={() => setPortalView('meds')} className={`flex items-center px-6 py-4 font-semibold text-left transition ${portalView === 'meds' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}>
                  <Pill className="w-5 h-5 mr-3" /> {p.meds}
                </button>
                <button onClick={() => setPortalView('labs')} className={`flex items-center px-6 py-4 font-semibold text-left transition ${portalView === 'labs' ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'}`}>
                  <Microscope className="w-5 h-5 mr-3" /> {p.labs}
                </button>
              </nav>
            </div>
          </div>

          {/* Main Dashboard Content */}
          <div className="lg:w-3/4">
            
            {portalView === 'overview' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-green-500">
                    <h3 className="font-bold text-gray-900 flex items-center mb-4"><Calendar className="w-5 h-5 mr-2 text-green-500"/> Upcoming Appointment</h3>
                    <p className="font-semibold text-lg">Diabetology Clinic</p>
                    <p className="text-gray-600">Nov 15, 2023 at 09:30 AM</p>
                    <p className="text-sm text-gray-500 mt-2">Dr. Lenka Lajtarová</p>
                    <button className="mt-4 text-sm text-blue-600 font-semibold hover:underline">Reschedule</button>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-blue-500">
                    <h3 className="font-bold text-gray-900 flex items-center mb-4"><FileText className="w-5 h-5 mr-2 text-blue-500"/> Recent Activity</h3>
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between items-center"><span className="text-gray-600">Lipid Panel Results</span> <span className="text-blue-600 font-semibold cursor-pointer">View</span></li>
                      <li className="flex justify-between items-center"><span className="text-gray-600">Prescription Refill: Nebivolol</span> <span className="text-gray-400">Processed</span></li>
                      <li className="flex justify-between items-center"><span className="text-gray-600">Telehealth Consultation</span> <span className="text-gray-400">Completed</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {portalView === 'records' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900">Active Conditions (FHIR Resource: Condition)</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {mockPatientData.conditions.map(c => (
                    <div key={c.id} className="p-6 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{c.diagnosis}</h4>
                          <p className="text-sm text-gray-500 mt-1">ICD-10 Code: {c.code} | Diagnosed: {c.date}</p>
                          <p className="text-sm text-gray-600 mt-2">Managing Physician: {c.doctor}</p>
                        </div>
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {portalView === 'meds' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900">Active e-Prescriptions (FHIR Resource: MedicationRequest)</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {mockPatientData.medications.map(m => (
                    <div key={m.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50 transition">
                      <div className="mb-4 sm:mb-0">
                        <h4 className="text-lg font-bold text-blue-900">{m.name}</h4>
                        <p className="text-sm text-gray-700 font-medium mt-1">{m.dosage}</p>
                        <p className="text-xs text-gray-500 mt-1">Prescribed: {m.date}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">Refills: {m.refills}</span>
                        <button className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition border border-blue-200">Request Refill</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {portalView === 'labs' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900">Diagnostic Reports (FHIR Resource: Observation)</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {mockPatientData.labs.map(l => (
                    <div key={l.id} className="p-6 hover:bg-gray-50 transition flex justify-between items-center">
                      <div>
                        <h4 className="text-md font-bold text-gray-900">{l.test}</h4>
                        <p className="text-sm text-gray-500 mt-1">{l.date} • {l.department}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${l.flag === 'High' ? 'text-red-600' : 'text-gray-900'}`}>{l.result}</p>
                        <p className={`text-xs font-semibold uppercase tracking-wider ${l.flag === 'High' ? 'text-red-500' : 'text-green-500'}`}>{l.flag}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-200">
      
      {/* Top utility bar */}
      <div className="bg-blue-950 text-gray-300 text-xs py-2 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex space-x-4 items-center">
          <span className="hidden sm:inline-flex items-center"><Phone className="w-3 h-3 mr-1"/> Central: +421 57 766 01 11</span>
          <span className="inline-flex items-center text-red-400 font-bold"><AlertCircle className="w-3 h-3 mr-1"/> Pohotovosť / Emergency: 112</span>
        </div>
        
        {/* Language Switcher simulating Hreflang & Translation API routing */}
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4" />
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            className="bg-blue-900 border-none text-white focus:ring-0 cursor-pointer outline-none font-medium text-xs rounded px-2 py-1"
            aria-label="Select Language"
          >
            <option value="sk">Slovenčina (SK)</option>
            <option value="en">English (EN)</option>
            <option value="uk">Українська (UK)</option>
            <option value="pl">Polski (PL)</option>
            <option value="hu">Magyar (HU)</option>
            <option value="cs">Čeština (CS)</option>
          </select>
        </div>
      </div>

      {/* Main Navigation Header */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center cursor-pointer" onClick={() => handleNav('home')}>
              <div className="bg-blue-600 p-2 rounded-lg mr-3">
                <HeartPulse className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-blue-900 tracking-tight leading-none">{t.hospitalName}</h1>
                <span className="text-xs text-gray-500 font-medium tracking-wide uppercase">Poliklinika a Lôžková časť</span>
              </div>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-1 lg:space-x-4">
              {['home', 'depts', 'telehealth', 'portal', 'contracts'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => handleNav(tab)}
                  className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors duration-200 ${
                    activeTab === tab 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                  }`}
                >
                  {t.nav[tab]}
                </button>
              ))}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none p-2"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg absolute w-full left-0 z-40">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {['home', 'depts', 'telehealth', 'portal', 'contracts'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleNav(tab)}
                  className={`block w-full text-left px-3 py-4 rounded-md text-base font-bold ${
                    activeTab === tab ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t.nav[tab]}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="min-h-[calc(100vh-350px)]">
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'depts' && <DepartmentsTab />}
        {activeTab === 'telehealth' && <TelehealthTab />}
        {activeTab === 'contracts' && <ContractsTab />}
        {activeTab === 'portal' && <PatientPortalTab />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 border-t-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-4">
              <HeartPulse className="h-6 w-6 text-blue-500 mr-2" />
              <h2 className="text-xl font-bold text-white">{t.hospitalName}</h2>
            </div>
            <p className="text-sm text-gray-400 max-w-md mb-6">
              Poskytovanie ústavnej a ambulantnej zdravotnej starostlivosti pre spádovú oblasť Snina a okolie.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>📍 Sládkovičova 300/3, 069 01 Snina, Slovakia</p>
              <p>IČO: 36 476 138 | DIČ: 2020025684</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Legal & Compliance</h3>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => handleNav('contracts')} className="hover:text-white transition">Zverejňovanie zmlúv</button></li>
              <li><a href="#" className="hover:text-white transition">Ochrana osobných údajov (GDPR)</a></li>
              <li><a href="#" className="hover:text-white transition flex items-center"><Shield className="w-3 h-3 mr-1"/> {t.accessibility}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Architecture Data</h3>
            <ul className="space-y-2 text-xs text-gray-500 font-mono">
              <li>• GCP Cloud CDN Edge Caching</li>
              <li>• Hreflang SEO Implementation</li>
              <li>• FHIR R4 API Ready</li>
              <li>• Google Cloud Translation v3</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-800 text-xs text-center text-gray-500">
          &copy; {new Date().getFullYear()} Nemocnica Snina, s.r.o. All rights reserved. Platform architecture deployed via Google Cloud.
        </div>
      </footer>

    </div>
  );
}