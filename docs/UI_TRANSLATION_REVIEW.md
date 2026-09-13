# UI translation review register — cs / pl / hu / uk

**2026-09-13 (Sprint I18N-ALL):** the 160 keys that each of `cs.json`,
`pl.json`, `hu.json`, `uk.json` lacked (they rendered the Slovak fallback)
were drafted by the build assistant, not by a human translator, so that all
four locales could be exposed in the language switcher with complete
chrome. They are UI strings, not CMS clinical content — the CMS review gate
(`REVIEW_GATED_LOCALES`) does not cover message files — so this register is
the equivalent control. **Before go-live a native speaker must review every
key below; the 150 keys in the first section are patient-facing care wording
(booking, telehealth consent, portal, consultation room, wearables consent)
and need a reviewer with clinical vocabulary.** `LAUNCH_CHECKLIST.md`
carries the gate.

The 93 keys each file already had before this sprint are not listed; their
provenance is not recorded in the repo. Pre-sprint state of a file:
`git show dead3b0:apps/web/src/messages/cs.json`.

## 1. Patient-facing care wording — clinical-vocabulary reviewer (150 keys × 4 locales)

| key | sk (source) |
|---|---|
| `booking.cancelTitle` | Zrušiť objednávku |
| `booking.cancelConfirmPrompt` | Naozaj chcete zrušiť túto objednávku? Táto akcia je nevratná. |
| `booking.cancelConfirm` | Áno, zrušiť objednávku |
| `booking.cancelling` | Ruším objednávku… |
| `booking.cancelledTitle` | Objednávka bola zrušená |
| `booking.cancelledBody` | Vaša objednávka bola úspešne zrušená. Termín je opäť voľný. |
| `booking.alreadyCancelledTitle` | Objednávka je už zrušená |
| `booking.alreadyCancelledBody` | Táto objednávka bola predtým zrušená. |
| `booking.cancelErrorTitle` | Nastala chyba |
| `booking.cancelNotFound` | Objednávku sa nepodarilo nájsť. Odkaz mohol vypršať. |
| `booking.cancelError` | Zrušenie sa nepodarilo. Skúste to znovu alebo nás kontaktujte telefonicky. |
| `booking.telehealthChip` | Videokonzultácia |
| `booking.telehealthConsentLabel` | Súhlasím so zavedením záznamu z videokonzultácie do mojej zdravotnej dokumentácie v súlade s §18 zákona č. 576/2004 Z. z. |
| `booking.telehealthConsentLink` | Podmienky ochrany súkromia pre telehealth |
| `booking.deviceCheckReady` | Kamera a mikrofón sú dostupné |
| `booking.deviceCheckDenied` | Prosíme, povoľte prístup ku kamere pre videokonzultáciu |
| `booking.deviceCheckChecking` | Kontrola zariadenia… |
| `booking.minorBlockTitle` | Telehealth nie je dostupný pre osoby mladšie ako 16 rokov |
| `booking.minorBlockBody` | Videokonzultácie pre pacientov pod 16 rokov nie sú dostupné online. Kontaktujte ambulanciu priamo. |
| `booking.minorGuardianLabel` | Potvrzujem, že zákonný zástupca bude prítomný počas videokonzultácie (pre 16–17-ročných pacientov). |
| `booking.telehealthVideoSlot` | Video |
| `booking.joinConsultation` | Pripojiť sa ku konzultácii |
| `booking.joinActiveIn` | Odkaz bude aktívny 10 minút pred termínom |
| `booking.telehealthModeTitle` | Objednanie videokonzultácie |
| `booking.telehealthNotEnabled` | Táto ambulancia nepodporuje videokonzultácie. |
| `telehealth.navLabel` | Telehealth |
| `telehealth.howItWorksTitle` | Ako funguje videokonzultácia |
| `telehealth.step1Title` | Objednajte sa online |
| `telehealth.step1Body` | Vyberte si ambulanciu, dátum a čas. Vyplňte zdravotný dotazník. |
| `telehealth.step2Title` | Skontrolujte zariadenie |
| `telehealth.step2Body` | Pred konzultáciou overte, že kamera a mikrofón fungujú správne. |
| `telehealth.step3Title` | Pripojte sa k videohovoru |
| `telehealth.step3Body` | Kliknite na odkaz 10 minút pred termínom. Lekár vás vpustí. |
| `telehealth.step4Title` | Záver a recept |
| `telehealth.step4Body` | Po konzultácii dostanete zhrnutie. Recept je zaslaný cez eZdravie. |
| `telehealth.requirementsTitle` | Technické požiadavky |
| `telehealth.req1` | Moderný prehliadač (Chrome, Firefox, Edge, Safari) |
| `telehealth.req2` | Kamera a mikrofón |
| `telehealth.req3` | Stabilné internetové pripojenie |
| `telehealth.req4` | Súkromné miesto |
| `telehealth.legalNoteTitle` | Právna informácia |
| `telehealth.legalNote` | Videokonzultácia je plnohodnotná lekárska konzultácia. Všetky záznamy sú súčasťou Vašej zdravotnej dokumentácie v zmysle zákona č. 576/2004 Z. z. Videohovory nie sú nahrávané (§ 20 GDPR). |
| `telehealth.ctaTitle` | Začnite svoju prvú videokonzultáciu |
| `telehealth.ctaBody` | Objednajte sa online za pár minút. |
| `telehealth.ctaPrimary` | Objednať videokonzultáciu |
| `telehealth.ctaSecondary` | Zobraziť dostupné ambulancie |
| `telehealth.eligibleClinicsTitle` | Ambulancie s videokonzultáciou |
| `telehealth.bookCta` | Objednať |
| `telehealth.privacyTitle` | Ochrana súkromia pri telehealth |
| `telehealth.heroJoinCta` | Pripojiť sa ku konzultácii |
| `telehealth.heroBookCta` | Objednať videokonzultáciu |
| `portal.teleconsultTitle` | Telekonzultácie |
| `portal.teleconsultUpcoming` | Nadchádzajúce |
| `portal.teleconsultPast` | Minulé |
| `portal.joinBtn` | Pripojiť sa |
| `portal.joinCountdown` | Aktívne o {mins}m |
| `portal.cancelLink` | Zrušiť |
| `portal.viewSummary` | Zobraziť zhrnutie |
| `portal.downloadSummaryPdf` | Stiahnuť PDF zhrnutia |
| `portal.teleconsultEmptyUpcoming` | Žiadne nadchádzajúce videokonzultácie. |
| `portal.teleconsultEmptyCta` | Objednať videokonzultáciu |
| `portal.teleconsultDuration` | Trvanie |
| `portal.teleconsultNoShow` | Neprišiel/a |
| `portal.summaryTitle` | Zhrnutie konzultácie |
| `portal.summaryPdfNote` | Stiahnutie PDF vyžaduje overenie kódom z SMS. |
| `room.loadingLabel` | Načítavanie konzultačnej miestnosti |
| `room.checkingDevice` | Kontrola zariadenia… |
| `room.joiningRoom` | Pripájanie k miestnosti… |
| `room.statusWaiting` | Čakám na lekára |
| `room.statusActive` | Konzultácia prebieha |
| `room.statusPostcall` | Konzultácia ukončená |
| `room.waitingTitle` | Čakajte, prosím |
| `room.waitingBody` | Lekár vás čoskoro vpustí do konzultačnej miestnosti. |
| `room.postcallTitle` | Konzultácia ukončená |
| `room.postcallBody` | Ďakujeme za využitie Telehealth. Zhrnutie konzultácie nájdete nižšie. |
| `room.clinicalNoteLabel` | Poznámka z konzultácie |
| `room.viewInPortal` | Zobraziť v portáli |
| `room.bookFollowUp` | Objednať kontrolu |
| `room.elapsed` | Trvanie hovoru |
| `room.micOn` | Mikrofón zapnutý |
| `room.micOff` | Mikrofón vypnutý |
| `room.cameraOn` | Kamera zapnutá |
| `room.cameraOff` | Kamera vypnutá |
| `room.shareScreen` | Zdieľanie obrazovky |
| `room.screenShareOn` | Zdieľanie obrazovky zapnuté |
| `room.screenShareOff` | Zdieľanie obrazovky vypnuté |
| `room.endCall` | Ukončiť hovor |
| `room.endCallTitle` | Ukončiť konzultáciu? |
| `room.endCallBody` | Toto ukončí videohovor s lekárom. |
| `room.endCallConfirm` | Ukončiť |
| `room.endCallCancel` | Zrušiť |
| `room.controlsLabel` | Ovládanie hovoru |
| `room.physicianVideo` | Video lekára |
| `room.selfVideo` | Vaše video |
| `room.physician.intakePanelTitle` | Vstupný dotazník |
| `room.physician.reasonLabel` | Dôvod konzultácie |
| `room.physician.medicationsLabel` | Aktuálne lieky |
| `room.physician.symptomsLabel` | Príznaky |
| `room.physician.vitalsLabel` | Poznámka k vitálnym funkciám |
| `room.physician.noIntake` | Pacient nevyplnil vstupný dotazník. |
| `room.physician.admitBtn` | Vpustiť pacienta |
| `room.physician.admitWaiting` | Čakám na pacienta… |
| `room.physician.postcallTitle` | Zhrnutie konzultácie |
| `room.physician.clinicalNotePlaceholder` | Klinická poznámka z konzultácie… |
| `room.physician.followUpLabel` | Odporúčanie sledovania |
| `room.physician.prescriptionIssuedLabel` | Predpis vystavený |
| `room.physician.saveHisBtn` | Uložiť do zdravotnej dokumentácie (HIS) |
| `room.physician.hisSaving` | Ukladám… |
| `room.physician.hisSaved` | Uložené v HIS |
| `room.physician.hisFailed` | Chyba pri ukladaní — skúste znovu. |
| `room.physician.mfaTitle` | Overenie identity |
| `room.physician.mfaBody` | Pre vstup do konzultačnej miestnosti zadajte TOTP kód z autentifikačnej aplikácie. |
| `room.physician.mfaLabel` | TOTP kód |
| `room.physician.mfaVerify` | Overiť a vstúpiť |
| `room.physician.mfaInvalid` | Neplatný kód. Skúste znovu. |
| `room.physician.patientVideo` | Video pacienta |
| `room.physician.statusWaitingPatient` | Čakám na pacienta |
| `room.error.cancelledTitle` | Konzultácia bola zrušená |
| `room.error.cancelledBody` | Vaša konzultácia bola zrušená. Kontaktujte ambulanciu alebo si objednajte nový termín. |
| `room.error.no_showTitle` | Čas konzultácie vypršal |
| `room.error.no_showBody` | Konzultácia bola označená ako nesplnená. Kontaktujte ambulanciu. |
| `room.error.endedTitle` | Konzultácia sa skončila |
| `room.error.endedBody` | Táto konzultácia sa skončila. |
| `room.error.device_deniedTitle` | Kamera alebo mikrofón nie sú dostupné |
| `room.error.device_deniedBody` | Prosíme, povoľte prístup ku kamere a mikrofónu v nastaveniach prehliadača a skúste to znova. |
| `room.error.networkTitle` | Chyba pripojenia |
| `room.error.networkBody` | Nepodarilo sa pripojiť k videokonzultácii. Skontrolujte internetové pripojenie. |
| `room.error.genericTitle` | Chyba konzultácie |
| `room.error.genericBody` | Nastala neočakávaná chyba. Kontaktujte ambulanciu. |
| `room.error.bookAgain` | Objednať nový termín |
| `wearables.title` | Nositeľné zariadenia |
| `wearables.optional` | Voliteľné |
| `wearables.connectDevice` | Pripojiť zariadenie |
| `wearables.shareWithPhysician` | Zdieľať s lekárom |
| `wearables.recentReadings` | Posledné merania |
| `wearables.syncNow` | Synchronizovať |
| `wearables.inHis` | V zdravotnom zázname |
| `wearables.medicalTab` | Medicínske |
| `wearables.fitnessTab` | Fitness & Wellness |
| `wearables.privacyNotice` | Správa súhlasov |
| `wearables.partnershipRequired` | Vyžaduje sa dohoda |
| `wearables.consent.title` | Správa súhlasov GDPR |
| `wearables.consent.storeReadings` | Ukladanie meraní |
| `wearables.consent.shareWithPhysician` | Zdieľanie s lekárom |
| `wearables.consent.hisExport` | Export do FHIR záznamu |
| `wearables.consent.withdrawAll` | Odvolať všetky súhlasy |
| `wearables.consent.disconnect` | Odpojiť zariadenie |
| `wearables.consent.auditTrail` | Auditný záznam súhlasov |
| `wearables.consent.granted` | Udelené |
| `wearables.consent.withdrawn` | Odvolané |

## 2. Navigation and footer chrome — bilingual reviewer (10 keys × 4 locales)

| key | sk (source) |
|---|---|
| `nav.telehealth` | Telehealth |
| `nav.education` | Edukácia pacientov |
| `nav.patients` | Pre pacientov |
| `nav.about` | O nemocnici |
| `navGroups.care.education` | Články a rady pre pacientov |
| `navGroups.visit.patients` | Ceny, čakacie lehoty, sťažnosti |
| `navGroups.hospital.about` | História, vedenie a hospodárenie |
| `navGroups.hospital.careers` | Voľné pracovné miesta |
| `footer.education` | Edukácia pacientov |
| `footer.careers` | Kariéra |

## Sign-off

| locale | reviewer | date | commit |
|---|---|---|---|
| cs | — | — | — |
| pl | — | — | — |
| hu | — | — | — |
| uk | — | — | — |
