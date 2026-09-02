import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, MapPin, Clock, ShieldCheck, Activity, Award, 
  ChevronRight, Menu, X, Droplet, Scissors, HeartPulse, Syringe,
  Calendar as CalendarIcon, FileText, Pill, User, CheckCircle2, 
  AlertCircle, Shield, CreditCard, LogOut, ArrowLeft,
  Settings, Lock, Edit2, Plus, Trash2, Image as ImageIcon, Save,
  Camera, QrCode, History, ClipboardList
} from 'lucide-react';

const ICONS = { HeartPulse, Droplet, Scissors, Activity, Syringe };

// --- MOCK DATA & CONFIGURATION ---
const CLINICS = {
  REMARI: { id: 'remari', name: 'REMARI, s.r.o.', address: 'Sládkovičova 4066, Snina', badge: { en: 'Private Clinic', sk: 'Súkromná klinika' }, color: 'bg-blue-100 text-blue-800' },
  NEMOCNICA: { id: 'nemocnica', name: 'Nemocnica Snina', address: 'Sládkovičova 300/3, Snina', badge: { en: 'Hospital Clinic', sk: 'Nemocničná klinika' }, color: 'bg-emerald-100 text-emerald-800' }
};

const MOCK_HISTORY = [
  { id: 'h1', date: '12. Mar 2024', service: { en: 'Tier 2 Procedure', sk: 'Zákrok Úrovne 2' }, clinic: CLINICS.REMARI },
  { id: 'h2', date: '28. Feb 2024', service: { en: 'Initial Diagnosis', sk: 'Vstupné vyšetrenie' }, clinic: CLINICS.NEMOCNICA }
];

const MOCK_MEDICATIONS = [
  { id: 'm1', name: 'Detralex', dosage: '500mg', frequency: { en: '2x daily', sk: '2x denne' } },
  { id: 'm2', name: 'Novaminsulfon', dosage: '500mg', frequency: { en: 'As needed for pain', sk: 'Podľa potreby pri bolesti' } },
];

const DEFAULT_CONTENT = {
  nav: {
    services: { sk: 'Služby', en: 'Services' },
    locations: { sk: 'Kontakt a Ordinačné hodiny', en: 'Locations & Hours' }
  },
  hero: {
    badge: { sk: 'Prijímame nových pacientov cez digitálny portál', en: 'Accepting New Patients via Digital Portal' },
    title1: { sk: 'Moderná a špecializovaná', en: 'Modern & Specialized' },
    titleHighlight: { sk: 'chirurgická starostlivosť', en: 'Surgical Care' },
    title2: { sk: 'v Snine.', en: 'in Snina.' },
    subtitle: { sk: 'Poskytujeme odbornú všeobecnú chirurgiu, pokročilé cievne ošetrenia a najmodernejšiu regeneratívnu medicínu. Vyhnite sa čakaniu na telefóne a spravujte svoju starostlivosť priamo cez náš bezpečný pacientsky portál.', en: 'Providing expert general surgery, advanced vascular treatments, and cutting-edge regenerative medicine. Skip the phone queue and manage your care directly through our secure patient portal.' }
  },
  websiteServices: [
    { id: 'ws1', title: {sk: 'Cievne Intervencie', en: 'Vascular Interventions'}, desc: {sk: 'RFA kŕčových žíl a estetická sklerotizácia metličkových žíl s nulovým časom stráveným v nemocnici.', en: 'RFA for varicose veins and aesthetic sclerotization of spider veins with zero hospital stay.'}, icon: 'HeartPulse', image: '' },
    { id: 'ws2', title: {sk: 'Regeneratívna Medicína', en: 'Regenerative Medicine'}, desc: {sk: 'Aplikácia vlastnej krvnej plazmy (PRP terapia) priamo do zapálených tkanív pri bolestiach kĺbov.', en: 'Autologous blood plasma (PRP therapy) directly into inflamed tissues for joint pain.'}, icon: 'Droplet', image: '' },
    { id: 'ws3', title: {sk: 'Drobná Traumatológia', en: 'Minor Traumatology'}, desc: {sk: 'Odborné ošetrenie rán, drenáž abscesov a pokročilá plastická chirurgia zarastajúcich nechtov.', en: 'Expert wound care, abscess drainage, and advanced plastic surgery for ingrown toenails.'}, icon: 'Scissors', image: '' }
  ],
  portalServices: [
    { id: 'initial', name: { en: 'Initial Diagnosis', sk: 'Vstupné vyšetrenie' }, duration: 45 },
    { id: 'followup', name: { en: 'Surgical Follow-up', sk: 'Pooperačná kontrola' }, duration: 20 },
    { id: 'tier1', name: { en: 'Tier 1 Procedure', sk: 'Zákrok Úrovne 1' }, duration: 15 },
    { id: 'tier2', name: { en: 'Tier 2 Procedure', sk: 'Zákrok Úrovne 2' }, duration: 30 },
    { id: 'tier3', name: { en: 'Tier 3 Procedure', sk: 'Zákrok Úrovne 3' }, duration: 60 }
  ]
};

const SYMPTOM_MAP = [
  { id: 's1', label: { en: 'New Medical Issue / Full Diagnosis', sk: 'Nový zdravotný problém / Kompletná diagnostika' }, serviceId: 'initial', isNewPatientAllowed: true },
  { id: 's2', label: { en: 'Post-Operative Check / Follow-up', sk: 'Pooperačná kontrola / Kontrolné vyšetrenie' }, serviceId: 'followup', isNewPatientAllowed: false },
  { id: 's3', label: { en: 'Suture Removal or Simple Dressing Change', sk: 'Výber stehov alebo jednoduchý preväz' }, serviceId: 'tier1', isNewPatientAllowed: false },
  { id: 's4', label: { en: 'Skin Growth, Mole, or Wart Removal', sk: 'Odstránenie kožného útvaru, znamienka, bradavice' }, serviceId: 'tier2', isNewPatientAllowed: true },
  { id: 's5', label: { en: 'Complex Procedure (Varicose Veins, PRP, Large Excision)', sk: 'Komplexný zákrok (Kŕčové žily, PRP, Väčšia excízia)' }, serviceId: 'tier3', isNewPatientAllowed: false }
];

const MOCK_SLOTS = [
  { id: 'sl1', time: '08:00', date: { en: 'Tomorrow', sk: 'Zajtra' }, clinic: CLINICS.REMARI, isPremium: false },
  { id: 'sl2', time: '09:30', date: { en: 'Tomorrow', sk: 'Zajtra' }, clinic: CLINICS.REMARI, isPremium: false },
  { id: 'sl3', time: '13:00', date: { en: 'Tomorrow', sk: 'Zajtra' }, clinic: CLINICS.NEMOCNICA, isPremium: false },
  { id: 'sl4', time: '14:30', date: { en: 'Thu, Mar 20', sk: 'Štv, 20. Mar' }, clinic: CLINICS.NEMOCNICA, isPremium: false },
  { id: 'sl5', time: '18:30', date: { en: 'Fri, Mar 21', sk: 'Pia, 21. Mar' }, clinic: CLINICS.REMARI, isPremium: true },
];

export default function App() {
  const [appState, setAppState] = useState('website'); // website, login, onboarding, dashboard, triage, booking, async, success, admin_login, admin
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [user, setUser] = useState(null);
  const [bookingState, setBookingState] = useState({ symptom: null, service: null, slot: null });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState('sk'); // Language State

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
    setIsMobileMenuOpen(false);
  }, [appState]);

  const navigateTo = (state) => setAppState(state);

  const handleLogout = () => {
    setUser(null);
    setBookingState({ symptom: null, service: null, slot: null });
    setAppState('website');
  };

  // Smooth scroll for website sections
  const scrollToSection = (id) => {
    if (appState !== 'website') {
      setAppState('website');
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  // ==========================================
  // VIEW: PUBLIC WEBSITE
  // ==========================================
  const WebsiteView = () => (
    <div className="animate-fade-in">
      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-50 opacity-50 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-emerald-50 opacity-50 blur-3xl pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="lg:w-2/3">
            <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 font-semibold text-sm mb-6">
              <ShieldCheck className="w-4 h-4 mr-2" /> 
              {content.hero.badge[lang]}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              {content.hero.title1[lang]} <span className="text-blue-600">{content.hero.titleHighlight[lang]}</span> {content.hero.title2[lang]}
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
              {content.hero.subtitle[lang]}
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button onClick={() => navigateTo('login')} className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex justify-center items-center">
                <User className="mr-2 w-5 h-5" /> {lang === 'en' ? 'Enter Portal (Login)' : 'Vstúpiť do Portálu (Login)'}
              </button>
              <button onClick={() => scrollToSection('services')} className="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 hover:border-slate-300 transition flex justify-center items-center">
                {content.nav.services[lang]}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST METRICS */}
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-700">
            <div className="px-4 py-4 md:py-0">
              <Award className="w-10 h-10 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">{lang === 'en' ? 'Board Certified' : 'Atestovaný Špecialista'}</h3>
              <p className="text-slate-400 text-sm">
                {lang === 'en' ? 'Specialist in Surgery (Chirurgia)' : 'Špecialista v odbore chirurgia (Chirurgia)'}<br/>
                {lang === 'en' ? 'Registered with SLK & ÚDZS' : 'Registrovaný v SLK a ÚDZS'}
              </p>
            </div>
            <div className="px-4 py-4 md:py-0">
              <Activity className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">{lang === 'en' ? 'Digital Integration' : 'Digitálna Integrácia'}</h3>
              <p className="text-slate-400 text-sm">
                {lang === 'en' ? 'Book algorithm-optimized appointments and request e-Recepts online.' : 'Rezervujte si termíny optimalizované algoritmami a žiadajte e-Recepty online.'}
              </p>
            </div>
            <div className="px-4 py-4 md:py-0">
              <HeartPulse className="w-10 h-10 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">{lang === 'en' ? 'Patient-Centric' : 'Zamerané na pacienta'}</h3>
              <p className="text-slate-400 text-sm">
                {lang === 'en' ? 'Consistently rated 5-stars for clear communication and excellent outcomes.' : 'Pravidelne hodnotené 5 hviezdičkami za jasnú komunikáciu a vynikajúce výsledky.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section id="services" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold tracking-widest text-blue-600 uppercase mb-3">{lang === 'en' ? 'Clinical Services' : 'Klinické Služby'}</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">{content.nav.services[lang]}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.websiteServices.map((service, idx) => (
              <div key={idx} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                {service.image ? (
                  <img src={service.image} alt={service.title[lang]} className="w-14 h-14 object-cover rounded-xl mb-6 border border-slate-200" />
                ) : (
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                    {React.createElement(ICONS[service.icon] || Activity, { className: "w-7 h-7" })}
                  </div>
                )}
                <h4 className="text-xl font-bold mb-2">{service.title[lang]}</h4>
                <p className="text-slate-600 text-sm">{service.desc[lang]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LOCATIONS */}
      <section id="locations" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold tracking-widest text-blue-600 uppercase mb-3">{lang === 'en' ? 'Where to find us' : 'Kde nás nájdete'}</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">{lang === 'en' ? 'Locations & Operating Hours' : 'Lokality a Ordinačné hodiny'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">{lang === 'en' ? 'Primary Node' : 'Primárna Ambulancia'}</span>
              <h4 className="text-2xl font-bold mt-4 mb-2">REMARI, s.r.o.</h4>
              <p className="flex items-start text-slate-600 mb-4"><MapPin className="w-5 h-5 mr-2 mt-0.5 text-slate-400" /> Sládkovičova 4066, Snina ({lang === 'en' ? 'Barrier-free' : 'Bezbariérový prístup'})</p>
              <ul className="space-y-2 text-sm text-slate-600 border-t border-slate-200 pt-4">
                <li className="flex justify-between"><span>{lang === 'en' ? 'Mon, Tue, Thu, Fri' : 'Pon, Uto, Štv, Pia'}</span> <strong>07:00 - 13:00</strong></li>
                <li className="flex justify-between"><span>{lang === 'en' ? 'Wednesday' : 'Streda'}</span> <strong>08:00 - 15:30</strong></li>
                <li className="text-amber-600 text-xs mt-2 italic">
                  * {lang === 'en' ? 'Bi-weekly Tuesdays are reserved for operations.' : 'Každý druhý utorok je vyhradený pre operácie.'}
                </li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">{lang === 'en' ? 'Secondary Node' : 'Sekundárna Ambulancia'}</span>
              <h4 className="text-2xl font-bold mt-4 mb-2">Nemocnica Snina</h4>
              <p className="flex items-start text-slate-600 mb-4"><MapPin className="w-5 h-5 mr-2 mt-0.5 text-slate-400" /> Sládkovičova 300/3, Snina</p>
              <ul className="space-y-2 text-sm text-slate-600 border-t border-slate-200 pt-4">
                <li className="flex justify-between"><span>{lang === 'en' ? 'Mon, Wed, Fri' : 'Pon, Str, Pia'}</span> <strong>08:00 - 15:00</strong></li>
                <li className="flex justify-between"><span>{lang === 'en' ? 'Tue, Thu' : 'Uto, Štv'}</span> <strong>07:00 - 15:00</strong></li>
                <li className="text-blue-600 text-xs mt-2 italic">
                  {lang === 'en' ? 'Bookings synced globally to prevent overlaps.' : 'Termíny sú globálne synchronizované, aby sa predišlo prekrývaniu.'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // ==========================================
  // VIEW: PORTAL LOGIN (2FA)
  // ==========================================
  const PortalLoginView = () => {
    const [rc, setRc] = useState('');
    const [phone, setPhone] = useState('');
    const [insurance, setInsurance] = useState('vszp');
    const [isNew, setIsNew] = useState(false);
    const [step, setStep] = useState(1);
    const [code, setCode] = useState(''); // Ensures input stays controlled in step 2

    const handleSendCode = (e) => { e.preventDefault(); if (rc.length > 5 && phone.length > 8) setStep(2); };
    const handleLogin = (e) => {
      e.preventDefault();
      setUser({ name: isNew ? (lang === 'en' ? 'New Patient' : 'Nový Pacient') : 'Ján Novák', rc, phone, insurance, isNewPatient: isNew });
      if (isNew) {
        navigateTo('onboarding');
      } else {
        navigateTo('dashboard');
      }
    };

    return (
      <div className="py-20 min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-slate-900 p-6 text-center">
            <Shield className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white">{lang === 'en' ? 'Secure Patient Portal' : 'Zabezpečený Pacientsky Portál'}</h2>
            <p className="text-slate-400 text-sm">{lang === 'en' ? 'GDPR Compliant Authentication' : 'Overenie v súlade s GDPR'}</p>
          </div>
          <div className="p-6">
            {step === 1 ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Rodné číslo (National ID)' : 'Rodné číslo'}</label>
                  <input required type="text" placeholder="YYMMDD/XXXX" value={rc} onChange={(e) => setRc(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Mobile Phone Number' : 'Mobilné telefónne číslo'}</label>
                  <input required type="tel" placeholder="+421 9XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Health Insurance Provider' : 'Zdravotná poisťovňa'}</label>
                  <select value={insurance} onChange={(e) => setInsurance(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="vszp">VšZP (25)</option>
                    <option value="dovera">Dôvera (24)</option>
                    <option value="union">Union (27)</option>
                    <option value="samoplatca">{lang === 'en' ? 'Self-Pay / Uninsured' : 'Samoplatca / Bez poistenia'}</option>
                  </select>
                </div>
                <div className="flex items-center mt-2">
                  <input type="checkbox" id="newPatient" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="newPatient" className="ml-2 text-sm text-slate-600">{lang === 'en' ? 'I am a new patient to this clinic' : 'Som nový pacient v tejto ambulancii'}</label>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition">
                  {lang === 'en' ? 'Send Secure SMS Code' : 'Odoslať bezpečnostný SMS kód'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start text-sm mb-4">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <p>{lang === 'en' ? `A verification code has been sent to ${phone}.` : `Overovací kód bol zaslaný na číslo ${phone}.`}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'SMS Verification Code' : 'SMS Overovací kód'}</label>
                  <input required type="text" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg text-center tracking-widest text-lg font-mono focus:ring-2 focus:ring-blue-500" />
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white font-semibold py-3 rounded-lg hover:bg-slate-800 transition">
                  {lang === 'en' ? 'Verify & Secure Login' : 'Overiť a Bezpečne sa prihlásiť'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW: PORTAL ONBOARDING (New Patient Workflow)
  // ==========================================
  const PortalOnboardingView = () => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [history, setHistory] = useState('');
    
    const handleCompleteRegistration = (e) => {
      e.preventDefault();
      // Update the user's name with their real input
      setUser({ ...user, name: `${firstName} ${lastName}` });
      navigateTo('dashboard');
    };

    return (
      <div className="py-10 max-w-3xl mx-auto px-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center mb-6">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'New Patient Registration' : 'Registrácia nového pacienta'}</h2>
              <p className="text-slate-500">{lang === 'en' ? 'Please complete your digital intake profile.' : 'Prosím, vyplňte svoj digitálny vstupný profil.'}</p>
            </div>
          </div>

          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex items-start mb-8 border border-blue-100">
            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <p>
              {lang === 'en' 
                ? "As required by the clinic's temporal guidelines, new patients must submit their intake information and any prior medical records before booking an Initial Diagnosis."
                : "V súlade s časovými usmerneniami kliniky musia noví pacienti pred rezerváciou vstupného vyšetrenia poskytnúť svoje vstupné informácie a predchádzajúce zdravotné záznamy."}
            </p>
          </div>

          <form onSubmit={handleCompleteRegistration} className="space-y-6">
            {/* Auto-imported data section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'National ID (Auto-imported)' : 'Rodné číslo (Importované)'}</label>
                <input disabled type="text" value={user?.rc || ''} className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Phone Number (Auto-imported)' : 'Telefónne číslo (Importované)'}</label>
                <input disabled type="tel" value={user?.phone || ''} className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'First Name' : 'Krstné meno'}</label>
                <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Last Name' : 'Priezvisko'}</label>
                <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Email Address' : 'E-mailová adresa'}</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Brief Medical History / Chief Complaint' : 'Stručná anamnéza / Hlavný zdravotný problém'}</label>
              <textarea rows="3" value={history} onChange={(e) => setHistory(e.target.value)} placeholder={lang === 'en' ? 'Describe your primary symptoms...' : 'Popíšte svoje hlavné príznaky...'} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition cursor-pointer">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">{lang === 'en' ? 'Upload Prior Medical Records (PDF, JPG)' : 'Nahrať predchádzajúce lekárske správy (PDF, JPG)'}</p>
              <p className="text-xs text-slate-500 mt-1">{lang === 'en' ? 'Optional but highly recommended for surgical consults.' : 'Voliteľné, ale vysoko odporúčané pre chirurgické konzultácie.'}</p>
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white font-semibold py-4 rounded-lg hover:bg-slate-800 transition shadow-md">
              {lang === 'en' ? 'Complete Registration & Go to Dashboard' : 'Dokončiť registráciu a prejsť na nástenku'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW: PORTAL DASHBOARD
  // ==========================================
  const PortalDashboardView = () => (
    <div className="max-w-4xl mx-auto p-4 py-10 space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Welcome' : 'Vitajte'}, {user.name}</h2>
          <p className="text-slate-500 flex items-center mt-1">
            <User className="w-4 h-4 mr-1"/> {lang === 'en' ? 'Insurance:' : 'Poisťovňa:'} {user.insurance.toUpperCase()} {user.isNewPatient && (lang === 'en' ? '(New Patient)' : '(Nový Pacient)')}
          </p>
        </div>
      </div>

      {user.isNewPatient && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start">
          <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            {lang === 'en' 
              ? <>As a newly registered patient, your first booking is strictly allocated as an <strong>Initial Diagnosis (45 mins)</strong> to allow the physician adequate time to build your clinical chart.</>
              : <>Ako novozaregistrovaný pacient máte prvý termín striktne vyhradený ako <strong>Vstupné vyšetrenie (45 minút)</strong>, aby mal lekár dostatok času na vytvorenie vašej zdravotnej karty.</>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div onClick={() => navigateTo('triage')} className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white cursor-pointer hover:shadow-lg transition transform hover:-translate-y-1">
          <CalendarIcon className="w-10 h-10 mb-4 text-blue-200" />
          <h3 className="text-xl font-bold mb-2">{lang === 'en' ? 'Book Clinical Appointment' : 'Rezervovať termín vyšetrenia'}</h3>
          <p className="text-blue-100 text-sm mb-4">
            {lang === 'en' ? 'Schedule a physical visit, procedure, or initial diagnosis via our intelligent triage system.' : 'Naplánujte si fyzickú návštevu, zákrok alebo vstupné vyšetrenie pomocou nášho inteligentného triediaceho systému.'}
          </p>
          <div className="flex items-center text-sm font-semibold text-blue-200">{lang === 'en' ? 'Start Triage Flow' : 'Spustiť rezerváciu'} <ChevronRight className="w-4 h-4 ml-1" /></div>
        </div>

        <div onClick={() => navigateTo('async')} className="bg-white border border-slate-200 rounded-2xl p-6 cursor-pointer hover:shadow-lg transition transform hover:-translate-y-1">
          <div className="flex space-x-3 mb-4 text-emerald-600">
            <Pill className="w-10 h-10" />
            <FileText className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Digital Requests' : 'Digitálne žiadosti'}</h3>
          <p className="text-slate-500 text-sm mb-4">
            {lang === 'en' ? 'Request e-Recept medication refills or administrative documents without a clinic visit.' : 'Požiadajte o predpis liekov (e-Recept) alebo administratívne dokumenty bez návštevy ambulancie.'}
          </p>
          <div className="flex items-center text-sm font-semibold text-emerald-600">{lang === 'en' ? 'Request Documents' : 'Žiadať dokumenty'} <ChevronRight className="w-4 h-4 ml-1" /></div>
        </div>
      </div>

      {/* NEW SECTION: History and Medications (Hidden for New Patients) */}
      {!user.isNewPatient && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          
          {/* Appointment History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              <History className="w-5 h-5 mr-2 text-blue-600" />
              {lang === 'en' ? 'Appointment History' : 'História vyšetrení'}
            </h3>
            <div className="space-y-4">
              {MOCK_HISTORY.map((item) => (
                <div key={item.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                  <p className="font-semibold text-slate-800 text-sm">{item.service[lang]}</p>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1"/> {item.date}</span>
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1"/> {item.clinic.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prescribed Medications */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-emerald-600" />
              {lang === 'en' ? 'Active Medications' : 'Aktívne lieky'}
            </h3>
            <div className="space-y-4">
              {MOCK_MEDICATIONS.map((med) => (
                <div key={med.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{med.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5"><span className="font-medium">{lang === 'en' ? 'Dosage:' : 'Dávkovanie:'}</span> {med.dosage} • {med.frequency[lang]}</p>
                  </div>
                  <button 
                    onClick={() => navigateTo('async')} 
                    className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition"
                  >
                    {lang === 'en' ? 'Refill' : 'Predpísať'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW: PORTAL TRIAGE (Symptom selection)
  // ==========================================
  const PortalTriageView = () => {
    const availableSymptoms = user.isNewPatient ? SYMPTOM_MAP.filter(s => s.isNewPatientAllowed) : SYMPTOM_MAP;
    const handleSelectSymptom = (symp) => {
      const activeService = content.portalServices.find(s => s.id === symp.serviceId);
      setBookingState({ symptom: symp, service: activeService, slot: null });
      navigateTo('booking');
    };

    return (
      <div className="max-w-2xl mx-auto p-4 py-10 space-y-6 animate-fade-in">
        <button onClick={() => navigateTo('dashboard')} className="text-blue-600 flex items-center text-sm font-medium hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> {lang === 'en' ? 'Back to Dashboard' : 'Späť na nástenku'}
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Primary reason for your visit?' : 'Aký je hlavný dôvod vašej návštevy?'}</h2>
          <p className="text-slate-500 mb-6">{lang === 'en' ? 'Our routing system will automatically allocate the correct clinical duration based on your selection.' : 'Náš systém smerovania automaticky pridelí správnu dĺžku vyšetrenia na základe vášho výberu.'}</p>
        </div>
        <div className="space-y-3">
          {availableSymptoms.map(symp => (
            <div key={symp.id} onClick={() => handleSelectSymptom(symp)} className="bg-white border border-slate-200 p-5 rounded-xl cursor-pointer hover:border-blue-500 hover:shadow-md transition flex items-center justify-between group">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-slate-400 group-hover:text-blue-500 mr-4" />
                <span className="font-medium text-slate-800 group-hover:text-blue-700">{symp.label[lang]}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW: PORTAL BOOKING
  // ==========================================
  const PortalBookingView = () => {
    const { service } = bookingState;
    const handleConfirmBooking = (slot) => {
      setBookingState({ ...bookingState, slot });
      navigateTo('success');
    };

    return (
      <div className="max-w-4xl mx-auto p-4 py-10 space-y-6 animate-fade-in">
        <button onClick={() => navigateTo('triage')} className="text-blue-600 flex items-center text-sm font-medium hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> {lang === 'en' ? 'Change Clinical Need' : 'Zmeniť dôvod návštevy'}
        </button>

        <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between shadow-lg">
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wider mb-1">{lang === 'en' ? 'Algorithmic Allocation' : 'Algoritmická Alokácia'}</p>
            <h3 className="text-2xl font-bold">{service?.name[lang]}</h3>
          </div>
          <div className="mt-4 md:mt-0 flex items-center bg-slate-800 px-4 py-2 rounded-lg">
            <Clock className="w-5 h-5 text-blue-400 mr-2" />
            <span className="font-semibold">{service?.duration} {lang === 'en' ? 'Min Block' : 'Minútový blok'}</span>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex items-start border border-blue-100">
           <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
           <p>
             {lang === 'en' 
               ? "Showing synchronized availability across both clinics. MUDr. Regec's calendar utilizes a global mutex lock to prevent double-booking. Standard 10-minute queue buffers are automatically injected."
               : "Zobrazenie synchronizovanej dostupnosti na oboch klinikách. Kalendár MUDr. Regeca využíva globálny mutex zámok, aby sa predišlo dvojitým rezerváciám. Štandardné 10-minútové rezervy sú automaticky aplikované."}
            </p>
        </div>

        <h4 className="font-bold text-lg text-slate-800 mt-8 mb-4">{lang === 'en' ? 'Available Appointments' : 'Dostupné termíny'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MOCK_SLOTS.map(slot => (
            <div key={slot.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h5 className="font-bold text-lg text-slate-900">{slot.date[lang]} o {slot.time}</h5>
                  <span className={`inline-block mt-2 px-2.5 py-1 rounded-md text-xs font-semibold ${slot.clinic.color}`}>{slot.clinic.badge[lang]}</span>
                </div>
                {slot.isPremium && (
                  <span className="flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    <CreditCard className="w-3 h-3 mr-1" /> +€6 {lang === 'en' ? 'Surcharge' : 'Príplatok'}
                  </span>
                )}
              </div>
              <div className="flex items-start text-sm text-slate-600 mb-6">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 text-slate-400 flex-shrink-0" />
                <span><strong>{slot.clinic.name}</strong><br/>{slot.clinic.address}</span>
              </div>
              <button onClick={() => handleConfirmBooking(slot)} className="w-full bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white font-medium py-2.5 rounded-lg transition">
                {lang === 'en' ? 'Secure this Time Slot' : 'Zarezervovať tento termín'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW: PORTAL ASYNC SERVICES
  // ==========================================
  const PortalAsyncView = () => {
    const [tab, setTab] = useState('erecept');
    const [submitted, setSubmitted] = useState(false);
    
    // Add explicitly controlled states to prevent undefined warnings
    const [medication, setMedication] = useState('');
    const [docType, setDocType] = useState('Health Capability / Sports Certificate (5 - 30 EUR)');
    const [medFile, setMedFile] = useState(null);
    const fileInputRef = React.useRef(null);

    if (submitted) return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center mt-10 animate-fade-in">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Request Submitted' : 'Žiadosť odoslaná'}</h2>
        <p className="text-slate-600 mb-6">
          {lang === 'en' ? "Added to the physician's asynchronous task queue. You will be notified via SMS when processed." : "Pridaná do fronty asynchrónnych úloh lekára. O spracovaní budete informovaní prostredníctvom SMS."}
        </p>
        <button onClick={() => {setSubmitted(false); navigateTo('dashboard')}} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium">
          {lang === 'en' ? 'Return to Dashboard' : 'Späť na nástenku'}
        </button>
      </div>
    );

    return (
      <div className="max-w-2xl mx-auto p-4 py-10 space-y-6 animate-fade-in">
        <button onClick={() => navigateTo('dashboard')} className="text-blue-600 flex items-center text-sm font-medium hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> {lang === 'en' ? 'Back to Dashboard' : 'Späť na nástenku'}
        </button>
        <h2 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Digital Requests' : 'Digitálne žiadosti'}</h2>
        
        <div className="flex border-b border-slate-200">
          <button onClick={() => setTab('erecept')} className={`px-4 py-3 font-medium text-sm border-b-2 transition ${tab === 'erecept' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {lang === 'en' ? 'e-Recept (Medication)' : 'Predpis liekov (e-Recept)'}
          </button>
          <button onClick={() => setTab('admin')} className={`px-4 py-3 font-medium text-sm border-b-2 transition ${tab === 'admin' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {lang === 'en' ? 'Administrative Docs' : 'Administratívne dokumenty'}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {tab === 'erecept' ? (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start text-sm mb-4">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <p>{lang === 'en' ? 'Prescriptions will be sent directly to your ID card via the National e-Health Cloud (0.00 EUR).' : 'Recepty budú odoslané priamo na váš občiansky preukaz cez Národný e-Zdravie cloud (0,00 EUR).'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Medication Name & Dosage' : 'Názov lieku a Dávkovanie'}</label>
                <input required={!medFile} type="text" value={medication} onChange={(e) => setMedication(e.target.value)} placeholder="e.g. Detralex 500mg" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{lang === 'en' ? 'Quick Add (Optional)' : 'Rýchle pridanie (Voliteľné)'}</label>
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center p-3 border border-slate-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-slate-700 text-sm font-medium">
                    <Camera className="w-5 h-5 mr-2 text-blue-500" />
                    {lang === 'en' ? 'Upload Photo' : 'Nahrať fotku'}
                  </button>
                  <button type="button" onClick={() => { 
                    setMedication('Detralex 500mg (Scanned via QR)');
                    alert(lang === 'en' ? 'Camera activated for QR scan. Mock scanned: Detralex 500mg' : 'Kamera aktivovaná pre skenovanie QR. Naskenované: Detralex 500mg'); 
                  }} className="flex items-center justify-center p-3 border border-slate-300 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 transition text-slate-700 text-sm font-medium">
                    <QrCode className="w-5 h-5 mr-2 text-emerald-500" />
                    {lang === 'en' ? 'Scan QR' : 'Skenovať QR'}
                  </button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if(e.target.files[0]) setMedFile(e.target.files[0].name); }} />
                {medFile && <p className="text-xs text-emerald-600 mt-2 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> {medFile} {lang === 'en' ? 'attached' : 'priložené'}</p>}
              </div>
              <button type="submit" className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 w-full md:w-auto">
                {lang === 'en' ? 'Request e-Recept' : 'Žiadať e-Recept'}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'en' ? 'Document Type' : 'Typ dokumentu'}</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>{lang === 'en' ? 'Health Capability / Sports Certificate (5 - 30 EUR)' : 'Potvrdenie o zdravotnej spôsobilosti / Šport (5 - 30 EUR)'}</option>
                  <option>{lang === 'en' ? 'Commercial Insurance Claim Form (5 - 6 EUR)' : 'Tlačivo pre komerčnú poisťovňu (5 - 6 EUR)'}</option>
                  <option>{lang === 'en' ? 'Exemption from Physical Education (1 EUR)' : 'Oslobodenie od telesnej výchovy (1 EUR)'}</option>
                  <option>{lang === 'en' ? 'Extract from Medical Records (6 - 20 EUR)' : 'Výpis zo zdravotnej dokumentácie (6 - 20 EUR)'}</option>
                </select>
              </div>
               <div className="bg-amber-50 text-amber-800 p-3 rounded-lg flex items-start text-sm mb-4 border border-amber-200">
                <CreditCard className="w-5 h-5 mr-2 flex-shrink-0" />
                <p>{lang === 'en' ? 'Documents require payment via secure gateway upon physician approval.' : 'Dokumenty vyžadujú platbu cez zabezpečenú bránu po schválení lekárom.'}</p>
              </div>
              <button type="submit" className="bg-slate-900 text-white font-semibold py-3 px-6 rounded-lg hover:bg-slate-800 w-full md:w-auto">
                {lang === 'en' ? 'Submit Request' : 'Odoslať žiadosť'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW: PORTAL SUCCESS
  // ==========================================
  const PortalSuccessView = () => (
    <div className="py-20 flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center border-t-8 border-emerald-500">
        <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
        <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Booking Confirmed' : 'Rezervácia Potvrdená'}</h2>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-6 text-left space-y-3">
          <p className="flex justify-between border-b pb-2"><span className="text-slate-500">{lang === 'en' ? 'Service:' : 'Služba:'}</span> <span className="font-semibold text-slate-900">{bookingState.service?.name[lang]}</span></p>
          <p className="flex justify-between border-b pb-2"><span className="text-slate-500">{lang === 'en' ? 'When:' : 'Kedy:'}</span> <span className="font-semibold text-slate-900">{bookingState.slot?.date[lang]} {lang === 'en' ? 'at' : 'o'} {bookingState.slot?.time}</span></p>
          <p className="flex justify-between"><span className="text-slate-500">{lang === 'en' ? 'Location:' : 'Lokalita:'}</span> <span className="font-semibold text-slate-900 text-right">{bookingState.slot?.clinic.name}</span></p>
        </div>
        <p className="text-sm text-slate-600 mb-8 bg-blue-50 p-3 rounded-lg">
          {lang === 'en' ? 'An automated SMS reminder will be sent 72 hours prior containing specific pre-operative instructions.' : 'Automatická SMS pripomienka s konkrétnymi predoperačnými pokynmi vám bude zaslaná 72 hodín vopred.'}
        </p>
        <button onClick={() => { setBookingState({symptom:null, service:null, slot:null}); navigateTo('dashboard'); }} className="w-full bg-slate-900 text-white font-semibold py-3 rounded-lg hover:bg-slate-800 transition">
          {lang === 'en' ? 'Return to Dashboard' : 'Späť na nástenku'}
        </button>
      </div>
    </div>
  );

  // ==========================================
  // VIEW: ADMIN
  // ==========================================
  const AdminLoginView = () => {
    const [pwd, setPwd] = useState('');
    return (
      <div className="py-20 flex items-center justify-center p-4 animate-fade-in">
        <form onSubmit={(e) => { e.preventDefault(); if(pwd === 'admin') navigateTo('admin'); }} className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <Lock className="w-12 h-12 text-slate-800 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-center mb-6">Admin Panel Login</h2>
          <input type="password" placeholder="Enter password (hint: admin)" value={pwd} onChange={(e)=>setPwd(e.target.value)} className="w-full p-3 border rounded-lg mb-4" />
          <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold">Login to Backend</button>
        </form>
      </div>
    );
  };

  const AdminDashboardView = () => {
    const [tab, setTab] = useState('nav');
    
    const handleNavChange = (key, l, val) => setContent(c => ({...c, nav: {...c.nav, [key]: {...c.nav[key], [l]: val}}}));
    const handleHeroChange = (key, l, val) => setContent(c => ({...c, hero: {...c.hero, [key]: {...c.hero[key], [l]: val}}}));
    
    const updateWebsiteService = (index, field, l, val) => {
      setContent(c => {
        const newArr = [...c.websiteServices];
        if (field === 'icon' || field === 'image') {
          newArr[index] = { ...newArr[index], [field]: val };
        } else {
          newArr[index] = { ...newArr[index], [field]: { ...newArr[index][field], [l]: val } };
        }
        return { ...c, websiteServices: newArr };
      });
    };
    const addWebsiteService = () => setContent(c => ({...c, websiteServices: [...c.websiteServices, {id: Date.now(), title:{sk:'Nová služba', en:'New Service'}, desc:{sk:'', en:''}, icon:'Activity', image:''}]}));
    const delWebsiteService = (idx) => setContent(c => ({...c, websiteServices: c.websiteServices.filter((_, i) => i !== idx)}));

    const updatePortalService = (index, field, l, val) => {
      setContent(c => {
        const newArr = [...c.portalServices];
        if (field === 'duration') {
          newArr[index] = { ...newArr[index], duration: Number(val) };
        } else {
          newArr[index] = { ...newArr[index], name: { ...newArr[index].name, [l]: val } };
        }
        return { ...c, portalServices: newArr };
      });
    };

    return (
      <div className="max-w-6xl mx-auto p-4 py-10 animate-fade-in flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-2">
          <h2 className="text-xl font-bold mb-4 flex items-center"><Settings className="mr-2"/> Admin Backend</h2>
          <button onClick={()=>setTab('nav')} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${tab==='nav' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50 border'}`}>Navigation Menus</button>
          <button onClick={()=>setTab('hero')} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${tab==='hero' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50 border'}`}>Hero Text Content</button>
          <button onClick={()=>setTab('websiteservices')} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${tab==='websiteservices' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50 border'}`}>Website Services</button>
          <button onClick={()=>setTab('portalservices')} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${tab==='portalservices' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50 border'}`}>Portal Durations</button>
          <div className="pt-4 mt-4 border-t border-slate-300">
            <button onClick={()=>navigateTo('website')} className="w-full text-center text-slate-500 hover:text-slate-800 text-sm">Exit Admin</button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {tab === 'nav' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold border-b pb-2">Edit Navigation Menu Items</h3>
              {Object.keys(content.nav).map(key => (
                <div key={key} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">{key} (SK)</label>
                    <input type="text" value={content.nav[key].sk || ''} onChange={(e)=>handleNavChange(key, 'sk', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">{key} (EN)</label>
                    <input type="text" value={content.nav[key].en || ''} onChange={(e)=>handleNavChange(key, 'en', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'hero' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold border-b pb-2">Edit Hero Section</h3>
              {Object.keys(content.hero).map(key => (
                <div key={key} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">{key} (SK)</label>
                    {key === 'subtitle' ? 
                      <textarea value={content.hero[key].sk || ''} onChange={(e)=>handleHeroChange(key, 'sk', e.target.value)} className="w-full p-2 border rounded mt-1" rows="3"/> :
                      <input type="text" value={content.hero[key].sk || ''} onChange={(e)=>handleHeroChange(key, 'sk', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                    }
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">{key} (EN)</label>
                    {key === 'subtitle' ? 
                      <textarea value={content.hero[key].en || ''} onChange={(e)=>handleHeroChange(key, 'en', e.target.value)} className="w-full p-2 border rounded mt-1" rows="3"/> :
                      <input type="text" value={content.hero[key].en || ''} onChange={(e)=>handleHeroChange(key, 'en', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'websiteservices' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold">Edit Public Website Services</h3>
                <button onClick={addWebsiteService} className="flex items-center text-sm bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-800"><Plus className="w-4 h-4 mr-1"/> Add Service</button>
              </div>
              {content.websiteServices.map((srv, idx) => (
                <div key={srv.id} className="p-4 border rounded-xl bg-slate-50 relative">
                  <button onClick={()=>delWebsiteService(idx)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 bg-red-50 p-1 rounded-full"><Trash2 className="w-5 h-5"/></button>
                  <div className="grid grid-cols-2 gap-4 mb-4 pr-10">
                    <div>
                      <label className="block text-xs text-slate-500 uppercase">Title (SK)</label>
                      <input type="text" value={srv.title.sk || ''} onChange={(e)=>updateWebsiteService(idx, 'title', 'sk', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 uppercase">Title (EN)</label>
                      <input type="text" value={srv.title.en || ''} onChange={(e)=>updateWebsiteService(idx, 'title', 'en', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-500 uppercase">Description (SK)</label>
                      <textarea value={srv.desc.sk || ''} onChange={(e)=>updateWebsiteService(idx, 'desc', 'sk', e.target.value)} className="w-full p-2 border rounded mt-1" rows="2"/>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 uppercase">Description (EN)</label>
                      <textarea value={srv.desc.en || ''} onChange={(e)=>updateWebsiteService(idx, 'desc', 'en', e.target.value)} className="w-full p-2 border rounded mt-1" rows="2"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Photo / Image URL</label>
                    <input type="text" placeholder="https://example.com/image.jpg (leave blank to use default icon)" value={srv.image || ''} onChange={(e)=>updateWebsiteService(idx, 'image', null, e.target.value)} className="w-full p-2 border rounded mt-1"/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'portalservices' && (
            <div className="space-y-6">
               <div className="border-b pb-2">
                <h3 className="text-lg font-bold">Edit Portal Appointment Configurations</h3>
                <p className="text-sm text-slate-500">Adjust the clinical time allocations mapped to the intelligent triage algorithm.</p>
              </div>
              {content.portalServices.map((srv, idx) => (
                <div key={srv.id} className="grid grid-cols-3 gap-4 items-center border-b pb-4">
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">System Key / Name (SK)</label>
                    <input type="text" value={srv.name.sk || ''} onChange={(e)=>updatePortalService(idx, 'name', 'sk', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Name (EN)</label>
                    <input type="text" value={srv.name.en || ''} onChange={(e)=>updatePortalService(idx, 'name', 'en', e.target.value)} className="w-full p-2 border rounded mt-1"/>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Booking Duration (Minutes)</label>
                    <input type="number" value={srv.duration || 0} onChange={(e)=>updatePortalService(idx, 'duration', null, e.target.value)} className="w-full p-2 border rounded mt-1 font-bold text-blue-600"/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // SHARED NAVIGATION & LAYOUT
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-200 flex flex-col">
      {/* NAVBAR */}
      <nav className="sticky top-0 w-full bg-white/95 backdrop-blur-md shadow-sm z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo -> Always goes to website home */}
            <div className="flex items-center cursor-pointer" onClick={() => navigateTo('website')}>
              <div className="bg-blue-600 p-2 rounded-lg mr-3 shadow-sm shadow-blue-200">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight text-slate-900">MUDr. Marián Regec</h1>
                <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Chirurgická Ambulancia</p>
              </div>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              {appState === 'website' && !user && (
                <>
                  <button onClick={() => scrollToSection('services')} className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition">
                    {content.nav.services[lang]}
                  </button>
                  <button onClick={() => scrollToSection('locations')} className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition">
                    {content.nav.locations[lang]}
                  </button>
                </>
              )}
              
              {user ? (
                <div className="flex items-center space-x-4">
                  <button onClick={() => navigateTo('dashboard')} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition flex items-center">
                    <User className="w-4 h-4 mr-1"/> {lang === 'en' ? 'My Portal' : 'Môj Portál'}
                  </button>
                  <button onClick={handleLogout} className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition flex items-center">
                    <LogOut className="w-4 h-4 mr-1"/> {lang === 'en' ? 'Logout' : 'Odhlásiť sa'}
                  </button>
                </div>
              ) : (
                <button onClick={() => navigateTo('login')} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition shadow-md flex items-center">
                  <User className="w-4 h-4 mr-2" /> {lang === 'en' ? 'Portal Login' : 'Vstup do Portálu'}
                </button>
              )}

              {/* Language Toggle */}
              <button 
                onClick={() => setLang(lang === 'sk' ? 'en' : 'sk')} 
                className="ml-4 pl-6 border-l border-slate-300 font-bold text-slate-500 hover:text-blue-600 transition flex items-center"
              >
                {lang === 'sk' ? 'EN' : 'SK'}
              </button>
            </div>

            {/* Mobile Nav Toggle */}
            <div className="md:hidden flex items-center space-x-4">
              <button onClick={() => setLang(lang === 'sk' ? 'en' : 'sk')} className="font-bold text-slate-500 hover:text-blue-600">
                {lang === 'sk' ? 'EN' : 'SK'}
              </button>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 hover:text-slate-900">
                {isMobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-xl absolute w-full pb-4 animate-fade-in">
            <div className="px-4 pt-2 space-y-2">
              {appState === 'website' && !user && (
                <>
                  <button onClick={() => scrollToSection('services')} className="block w-full text-left px-3 py-3 rounded-md text-base font-medium text-slate-700">{content.nav.services[lang]}</button>
                  <button onClick={() => scrollToSection('locations')} className="block w-full text-left px-3 py-3 rounded-md text-base font-medium text-slate-700">{content.nav.locations[lang]}</button>
                </>
              )}
              <div className="pt-4 border-t border-slate-100">
                {user ? (
                  <>
                    <button onClick={() => navigateTo('dashboard')} className="w-full bg-blue-50 text-blue-700 px-5 py-3 rounded-lg text-base font-bold mb-2 flex justify-center items-center"><User className="w-5 h-5 mr-2"/> {lang === 'en' ? 'My Portal' : 'Môj Portál'}</button>
                    <button onClick={handleLogout} className="w-full bg-slate-100 text-slate-700 px-5 py-3 rounded-lg text-base font-medium flex justify-center items-center"><LogOut className="w-5 h-5 mr-2"/> {lang === 'en' ? 'Logout' : 'Odhlásiť sa'}</button>
                  </>
                ) : (
                  <button onClick={() => navigateTo('login')} className="w-full bg-slate-900 text-white px-5 py-3 rounded-lg text-base font-medium flex justify-center items-center">
                    <User className="w-5 h-5 mr-2" /> {lang === 'en' ? 'Portal Login' : 'Vstup do Portálu'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* MAIN CONTENT ROUTER */}
      <main className="flex-grow">
        {appState === 'website' && <WebsiteView />}
        {appState === 'login' && <PortalLoginView />}
        {appState === 'onboarding' && <PortalOnboardingView />}
        {appState === 'dashboard' && <PortalDashboardView />}
        {appState === 'triage' && <PortalTriageView />}
        {appState === 'booking' && <PortalBookingView />}
        {appState === 'async' && <PortalAsyncView />}
        {appState === 'success' && <PortalSuccessView />}
        {appState === 'admin_login' && <AdminLoginView />}
        {appState === 'admin' && <AdminDashboardView />}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-sm">
          <div className="mb-4 md:mb-0 flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            <span><span className="cursor-pointer hover:text-white transition duration-200" onClick={() => navigateTo('admin_login')}>&copy;</span> 2024 REMARI, s.r.o. | IČO: 36488836</span>
          </div>
          <div className="flex space-x-6">
            <span className="hover:text-white cursor-pointer transition">{lang === 'en' ? 'Privacy Policy (GDPR)' : 'Ochrana osobných údajov (GDPR)'}</span>
            <span className="hover:text-white cursor-pointer transition">{lang === 'en' ? 'Terms of Service' : 'Podmienky používania'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}