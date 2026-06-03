import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { isLocale, locales, type Locale } from "@/lib/locales";

type LocalePageProps = {
  params: {
    locale: string;
  };
};

type PrivacyListItem = {
  label?: string;
  text: string;
};

type PrivacySection = {
  heading: string;
  paragraphs?: string[];
  list?: PrivacyListItem[];
  afterList?: string[];
};

type PrivacyContent = {
  intro: string[];
  sections: PrivacySection[];
};

const metadataByLocale: Partial<Record<Locale, { title: string; description: string }>> = {
  en: {
    title: "Privacy Policy | Bike Me",
    description: "Privacy Policy for Bike Me."
  },
  da: {
    title: "Privatlivspolitik | Bike ME",
    description: "Privatlivspolitik for Bike ME."
  },
  de: {
    title: "Datenschutzerklärung | Bike Me",
    description: "Datenschutzerklärung für Bike Me."
  },
  es: {
    title: "Política de privacidad | Bike Me",
    description: "Política de privacidad de Bike Me."
  },
  it: {
    title: "Informativa sulla privacy | Bike Me",
    description: "Informativa sulla privacy di Bike Me."
  },
  fr: {
    title: "Politique de confidentialité | Bike Me",
    description: "Politique de confidentialité de Bike Me."
  },
  nl: {
    title: "Privacybeleid | Bike Me",
    description: "Privacybeleid van Bike Me."
  }
};

const uiByLocale: Partial<Record<Locale, { pageTitle: string; lastUpdated: string; backToHome: string }>> = {
  en: {
    pageTitle: "Privacy Policy for Bike ME",
    lastUpdated: "Last updated: February 28, 2026",
    backToHome: "Back to home"
  },
  da: {
    pageTitle: "Privatlivspolitik for Bike ME",
    lastUpdated: "Senest opdateret: 28. februar 2026",
    backToHome: "Tilbage til forsiden"
  },
  de: {
    pageTitle: "Datenschutzerklärung für Bike ME",
    lastUpdated: "Zuletzt aktualisiert: 28. Februar 2026",
    backToHome: "Zur Startseite"
  },
  es: {
    pageTitle: "Política de privacidad de Bike ME",
    lastUpdated: "Última actualización: 28 de febrero de 2026",
    backToHome: "Volver al inicio"
  },
  it: {
    pageTitle: "Informativa sulla privacy di Bike ME",
    lastUpdated: "Ultimo aggiornamento: 28 febbraio 2026",
    backToHome: "Torna alla home"
  },
  fr: {
    pageTitle: "Politique de confidentialité de Bike ME",
    lastUpdated: "Dernière mise à jour : 28 février 2026",
    backToHome: "Retour à l'accueil"
  },
  nl: {
    pageTitle: "Privacybeleid voor Bike ME",
    lastUpdated: "Laatst bijgewerkt: 28 februari 2026",
    backToHome: "Terug naar home"
  }
};

const privacyContentByLocale: Record<Locale, PrivacyContent> = {
  en: {
    intro: [
      'This privacy policy describes how Bike ME ("we", "us" or "our") processes personal data in connection with your use of the Bike ME app and related services (collectively, the "Service").',
      "We protect your privacy and process personal data in accordance with applicable data protection law, including the General Data Protection Regulation (GDPR)."
    ],
    sections: [
      {
        heading: "Controller",
        paragraphs: [
          "The controller for the processing of your personal data is:",
          "Bike ME (developer: Morten Muusmann)\nE-mail: kontakt@bikeme.one"
        ]
      },
      {
        heading: "What information we collect",
        paragraphs: [
          "When you use Bike ME, we may process the following categories of personal data:"
        ],
        list: [
          {
            label: "Account data",
            text: "name and email address in connection with account creation and use (login is handled through our authentication solution)."
          },
          {
            label: "Profile and app data",
            text: 'information you fill in yourself in your profile (for example level, bike type, home region, "about me" and optional profile picture).'
          },
          {
            label: "Ride data (content you create)",
            text: "the ride title, description, discipline, time, duration, distance (if relevant), meeting point/start location and other information you choose to add. Information about participation (for example who has signed up for a ride)."
          },
          {
            label: "Route data (optional)",
            text: "if you import a GPX file, we store route data together with the ride so the route can be shown on the map."
          },
          {
            label: "Location data",
            text: "your location when you actively give the app permission. Location is used for map features (for example showing fixed meeting points and nearby rides) as well as live tracking and recording your route, speed and distance when you actively choose to start and record a bike ride in the app. You can turn location off at any time in your device settings."
          },
          {
            label: "Push notifications",
            text: "if you allow push notifications, we store a push token (device ID for notifications) so we can send important ride messages, for example changes or when the host can no longer make it. You can turn push off in the app settings/profile or in your phone settings."
          },
          {
            label: "Technical data",
            text: "device type, operating system, app version and log/error reports (to the extent necessary). This is used for operations, troubleshooting and improving the Service."
          },
          {
            label: "Communication and support",
            text: "inquiries you send us by email, and relevant information you share in connection with support."
          }
        ]
      },
      {
        heading: "Purposes and legal basis",
        paragraphs: ["We process your personal data for the following purposes:"],
        list: [
          { text: "a) Creating and operating your account and profile — GDPR Art. 6(1)(b)." },
          { text: "b) Creating, displaying and administering rides — GDPR Art. 6(1)(b)." },
          { text: "c) Location-based features — GDPR Art. 6(1)(b) and/or (f)." },
          {
            text: "d) Push notifications about important ride changes — GDPR Art. 6(1)(b) and/or (f). (Notification permission is controlled by the device.)"
          },
          { text: "e) Operations, security and improvement — GDPR Art. 6(1)(f)." },
          { text: "f) Communication and support — GDPR Art. 6(1)(b) and/or (f)." }
        ]
      },
      {
        heading: "Recipients and use of processors",
        paragraphs: [
          "We do not share your personal data with other companies for their own marketing.",
          "We use selected processors to operate the Service, for example:"
        ],
        list: [
          { text: "hosting and database provider" },
          { text: "push notification provider" },
          { text: "error/logging tools (if used)" }
        ],
        afterList: [
          "Processors may only process information on our behalf and according to our instructions."
        ]
      },
      {
        heading: "Transfers to third countries",
        paragraphs: [
          "Some processors may be located outside the EU/EEA. In those cases, we ensure a valid transfer basis, for example the European Commission's Standard Contractual Clauses (SCC)."
        ]
      },
      {
        heading: "Retention period",
        paragraphs: [
          "We store personal data for as long as necessary for the purposes for which it was collected, or for as long as we are legally required to do so.",
          "You can delete your account and related data at any time directly in the app under Profile -> Settings, or by contacting us at kontakt@bikeme.one.",
          "If you delete your account, we will delete or anonymize your personal data within 30 days unless we are legally required to store it longer."
        ]
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You have the right to: access, rectification, deletion, restriction, objection, data portability.",
          "Contact: kontakt@bikeme.one\nYou can complain to the Danish Data Protection Agency."
        ]
      },
      {
        heading: "Children's use of the Service",
        paragraphs: [
          "Bike ME is intended for users over 18. If we become aware that we have collected personal data about a child, we will delete the information as quickly as possible."
        ]
      },
      {
        heading: "Changes to this privacy policy",
        paragraphs: [
          "We may update this privacy policy from time to time. The latest version will always be available in the app and/or on our website. For material changes, we will give clear notice whenever possible."
        ]
      }
    ]
  },
  da: {
    intro: [
      'Denne privatlivspolitik beskriver, hvordan Bike ME ("vi", "os" eller "vores") behandler personoplysninger i forbindelse med din brug af Bike ME-appen og tilhørende tjenester (samlet kaldet "Tjenesten").',
      "Vi beskytter dit privatliv og behandler personoplysninger i overensstemmelse med gældende databeskyttelseslovgivning, herunder databeskyttelsesforordningen (GDPR)."
    ],
    sections: [
      {
        heading: "Dataansvarlig",
        paragraphs: [
          "Dataansvarlig for behandlingen af dine personoplysninger er:",
          "Bike ME (udvikler: Morten Muusmann)\nE-mail: kontakt@bikeme.one"
        ]
      },
      {
        heading: "Hvilke oplysninger vi indsamler",
        paragraphs: [
          "Når du bruger Bike ME, kan vi behandle følgende kategorier af personoplysninger:"
        ],
        list: [
          {
            label: "Kontodata",
            text: "navn og e-mailadresse i forbindelse med oprettelse og brug af konto (login håndteres via vores autentificeringsløsning)."
          },
          {
            label: "Profil- og appdata",
            text: 'oplysninger du selv udfylder i din profil (fx niveau, cykeltype, hjemmeregion, "lidt om mig" og evt. profilbillede).'
          },
          {
            label: "Turdata (indhold du opretter)",
            text: "turens titel, beskrivelse, disciplin, tidspunkt, varighed, distance (hvis relevant), mødested/startsted og andre oplysninger, du vælger at tilføje. Oplysninger om deltagelse (fx hvem der har tilmeldt sig en tur)."
          },
          {
            label: "Rutedata (valgfrit)",
            text: "hvis du importerer en GPX-fil, gemmer vi rutedata sammen med turen, så ruten kan vises på kortet."
          },
          {
            label: "Lokationsdata",
            text: "din lokation, når du aktivt giver appen tilladelse. Lokation bruges til kortfunktioner (fx visning af faste mødesteder og ture i nærheden) samt til live-tracking og registrering af din rute, fart og distance, når du aktivt vælger at starte og registrere en cykeltur i appen. Du kan til enhver tid slå lokation fra i dine enhedsindstillinger."
          },
          {
            label: "Push-notifikationer",
            text: "hvis du giver tilladelse til push, gemmer vi en push-token (enheds-id til notifikationer) for at kunne sende vigtige beskeder om ture, fx ændringer eller når værten ikke kan alligevel. Du kan slå push fra i appens indstillinger/profil eller i telefonens indstillinger."
          },
          {
            label: "Tekniske data",
            text: "enhedstype, operativsystem, app-version samt logdata/fejlrapporter (i nødvendigt omfang). Dette bruges til drift, fejlfinding og forbedring af Tjenesten."
          },
          {
            label: "Kommunikation og support",
            text: "henvendelser du sender til os via e-mail, samt relevante oplysninger, du deler i forbindelse med support."
          }
        ]
      },
      {
        heading: "Formål og behandlingsgrundlag",
        paragraphs: ["Vi behandler dine personoplysninger til følgende formål:"],
        list: [
          {
            text: "a) Oprettelse og drift af din konto og profil — GDPR art. 6, stk. 1, litra b."
          },
          { text: "b) Oprettelse, visning og administration af ture — GDPR art. 6, stk. 1, litra b." },
          {
            text: "c) Lokationsbaserede funktioner — GDPR art. 6, stk. 1, litra b og/eller f."
          },
          {
            text: "d) Push-notifikationer om vigtige turændringer — GDPR art. 6, stk. 1, litra b og/eller f. (Notifikationstilladelse styres af enheden.)"
          },
          { text: "e) Drift, sikkerhed og forbedring — GDPR art. 6, stk. 1, litra f." },
          { text: "f) Kommunikation og support — GDPR art. 6, stk. 1, litra b og/eller f." }
        ]
      },
      {
        heading: "Modtagere og brug af databehandlere",
        paragraphs: [
          "Vi deler ikke dine personoplysninger med andre virksomheder til deres egen markedsføring.",
          "Vi benytter udvalgte databehandlere til drift af Tjenesten, fx:"
        ],
        list: [
          { text: "hosting- og databaseleverandør" },
          { text: "leverandør af push-notifikationer" },
          { text: "fejl-/logningsværktøjer (hvis anvendt)" }
        ],
        afterList: [
          "Databehandlere må kun behandle oplysninger på vores vegne og efter instruks."
        ]
      },
      {
        heading: "Overførsel til tredjelande",
        paragraphs: [
          "Nogle databehandlere kan være placeret uden for EU/EØS. I sådanne tilfælde sikrer vi et gyldigt overførselsgrundlag, fx EU-Kommissionens standardkontraktbestemmelser (SCC)."
        ]
      },
      {
        heading: "Opbevaringsperiode",
        paragraphs: [
          "Vi opbevarer personoplysninger, så længe det er nødvendigt for de formål, de er indsamlet til, eller så længe vi er retligt forpligtet hertil.",
          "Du kan til enhver tid slette din konto og dine tilhørende data direkte i appen under Profil -> Indstillinger, eller ved at kontakte os på kontakt@bikeme.one.",
          "Hvis du sletter din konto, vil vi slette eller anonymisere dine persondata inden for 30 dage, medmindre vi er retligt forpligtet til at gemme dem længere."
        ]
      },
      {
        heading: "Dine rettigheder",
        paragraphs: [
          "Du har ret til: indsigt, berigtigelse, sletning, begrænsning, indsigelse, dataportabilitet.",
          "Kontakt: kontakt@bikeme.one\nDu kan klage til Datatilsynet."
        ]
      },
      {
        heading: "Børns brug af Tjenesten",
        paragraphs: [
          "Bike ME er målrettet brugere over 18 år. Hvis vi bliver opmærksomme på, at vi har indsamlet personoplysninger om et barn, vil vi slette oplysningerne hurtigst muligt."
        ]
      },
      {
        heading: "Ændringer i denne privatlivspolitik",
        paragraphs: [
          "Vi kan opdatere denne privatlivspolitik fra tid til anden. Den seneste version vil altid være tilgængelig i appen og/eller på vores website. Ved væsentlige ændringer vil vi, så vidt muligt, give tydelig besked."
        ]
      }
    ]
  },
  de: {
    intro: [
      'Diese Datenschutzerklärung beschreibt, wie Bike ME ("wir", "uns" oder "unser") personenbezogene Daten im Zusammenhang mit deiner Nutzung der Bike ME-App und zugehöriger Dienste (zusammen der "Dienst") verarbeitet.',
      "Wir schützen deine Privatsphäre und verarbeiten personenbezogene Daten im Einklang mit geltendem Datenschutzrecht, einschließlich der Datenschutz-Grundverordnung (DSGVO)."
    ],
    sections: [
      {
        heading: "Verantwortlicher",
        paragraphs: [
          "Verantwortlich für die Verarbeitung deiner personenbezogenen Daten ist:",
          "Bike ME (Entwickler: Morten Muusmann)\nE-Mail: kontakt@bikeme.one"
        ]
      },
      {
        heading: "Welche Informationen wir erheben",
        paragraphs: [
          "Wenn du Bike ME nutzt, können wir folgende Kategorien personenbezogener Daten verarbeiten:"
        ],
        list: [
          {
            label: "Kontodaten",
            text: "Name und E-Mail-Adresse im Zusammenhang mit der Erstellung und Nutzung eines Kontos (der Login erfolgt über unsere Authentifizierungslösung)."
          },
          {
            label: "Profil- und App-Daten",
            text: 'Informationen, die du selbst in deinem Profil einträgst (z. B. Niveau, Fahrradtyp, Heimatregion, "Über mich" und ggf. Profilbild).'
          },
          {
            label: "Fahrtdaten (von dir erstellte Inhalte)",
            text: "Titel, Beschreibung, Disziplin, Zeitpunkt, Dauer, Distanz (falls relevant), Treffpunkt/Startort und andere Informationen, die du hinzufügst. Informationen zur Teilnahme (z. B. wer sich für eine Fahrt angemeldet hat)."
          },
          {
            label: "Routendaten (optional)",
            text: "wenn du eine GPX-Datei importierst, speichern wir Routendaten zusammen mit der Fahrt, damit die Route auf der Karte angezeigt werden kann."
          },
          {
            label: "Standortdaten",
            text: "dein Standort, wenn du der App aktiv die Berechtigung erteilst. Der Standort wird für Kartenfunktionen verwendet (z. B. zur Anzeige fester Treffpunkte und von Fahrten in der Nähe) sowie für Live-Tracking und die Aufzeichnung deiner Route, Geschwindigkeit und Distanz, wenn du aktiv wählst, eine Radfahrt in der App zu starten und aufzuzeichnen. Du kannst den Standort jederzeit in den Geräteeinstellungen deaktivieren."
          },
          {
            label: "Push-Benachrichtigungen",
            text: "wenn du Push erlaubst, speichern wir einen Push-Token (Geräte-ID für Benachrichtigungen), um wichtige Nachrichten zu Fahrten senden zu können, z. B. Änderungen oder wenn ein Host nicht mehr teilnehmen kann. Du kannst Push in den App-Einstellungen/im Profil oder in den Einstellungen deines Telefons deaktivieren."
          },
          {
            label: "Technische Daten",
            text: "Gerätetyp, Betriebssystem, App-Version sowie Logdaten/Fehlerberichte (soweit erforderlich). Dies dient dem Betrieb, der Fehlerbehebung und der Verbesserung des Dienstes."
          },
          {
            label: "Kommunikation und Support",
            text: "Anfragen, die du uns per E-Mail sendest, sowie relevante Informationen, die du im Zusammenhang mit Support teilst."
          }
        ]
      },
      {
        heading: "Zwecke und Rechtsgrundlagen",
        paragraphs: ["Wir verarbeiten deine personenbezogenen Daten zu folgenden Zwecken:"],
        list: [
          { text: "a) Erstellung und Betrieb deines Kontos und Profils — DSGVO Art. 6 Abs. 1 lit. b." },
          { text: "b) Erstellung, Anzeige und Verwaltung von Fahrten — DSGVO Art. 6 Abs. 1 lit. b." },
          { text: "c) Standortbasierte Funktionen — DSGVO Art. 6 Abs. 1 lit. b und/oder f." },
          {
            text: "d) Push-Benachrichtigungen über wichtige Fahrtänderungen — DSGVO Art. 6 Abs. 1 lit. b und/oder f. (Die Benachrichtigungserlaubnis wird auf dem Gerät gesteuert.)"
          },
          { text: "e) Betrieb, Sicherheit und Verbesserung — DSGVO Art. 6 Abs. 1 lit. f." },
          { text: "f) Kommunikation und Support — DSGVO Art. 6 Abs. 1 lit. b und/oder f." }
        ]
      },
      {
        heading: "Empfänger und Nutzung von Auftragsverarbeitern",
        paragraphs: [
          "Wir geben deine personenbezogenen Daten nicht an andere Unternehmen für deren eigenes Marketing weiter.",
          "Wir nutzen ausgewählte Auftragsverarbeiter für den Betrieb des Dienstes, z. B.:"
        ],
        list: [
          { text: "Hosting- und Datenbankanbieter" },
          { text: "Anbieter von Push-Benachrichtigungen" },
          { text: "Fehler-/Logging-Tools (falls verwendet)" }
        ],
        afterList: [
          "Auftragsverarbeiter dürfen Informationen nur in unserem Auftrag und nach unseren Weisungen verarbeiten."
        ]
      },
      {
        heading: "Übermittlung in Drittländer",
        paragraphs: [
          "Einige Auftragsverarbeiter können außerhalb der EU/des EWR ansässig sein. In solchen Fällen stellen wir eine gültige Übermittlungsgrundlage sicher, z. B. die Standardvertragsklauseln der EU-Kommission (SCC)."
        ]
      },
      {
        heading: "Aufbewahrungsdauer",
        paragraphs: [
          "Wir speichern personenbezogene Daten so lange, wie es für die Zwecke erforderlich ist, für die sie erhoben wurden, oder so lange, wie wir rechtlich dazu verpflichtet sind.",
          "Du kannst dein Konto und die zugehörigen Daten jederzeit direkt in der App unter Profil -> Einstellungen löschen oder uns unter kontakt@bikeme.one kontaktieren.",
          "Wenn du dein Konto löschst, löschen oder anonymisieren wir deine personenbezogenen Daten innerhalb von 30 Tagen, sofern wir nicht rechtlich verpflichtet sind, sie länger aufzubewahren."
        ]
      },
      {
        heading: "Deine Rechte",
        paragraphs: [
          "Du hast das Recht auf: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit.",
          "Kontakt: kontakt@bikeme.one\nDu kannst dich bei der dänischen Datenschutzbehörde beschweren."
        ]
      },
      {
        heading: "Nutzung des Dienstes durch Kinder",
        paragraphs: [
          "Bike ME richtet sich an Nutzer über 18 Jahre. Wenn wir feststellen, dass wir personenbezogene Daten über ein Kind erhoben haben, löschen wir diese Informationen so schnell wie möglich."
        ]
      },
      {
        heading: "Änderungen dieser Datenschutzerklärung",
        paragraphs: [
          "Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren. Die neueste Version ist immer in der App und/oder auf unserer Website verfügbar. Bei wesentlichen Änderungen geben wir, soweit möglich, einen klaren Hinweis."
        ]
      }
    ]
  },
  es: {
    intro: [
      'Esta política de privacidad describe cómo Bike ME ("nosotros" o "nuestro") trata datos personales en relación con tu uso de la app Bike ME y los servicios asociados (en conjunto, el "Servicio").',
      "Protegemos tu privacidad y tratamos datos personales de acuerdo con la legislación aplicable de protección de datos, incluido el Reglamento General de Protección de Datos (RGPD)."
    ],
    sections: [
      {
        heading: "Responsable del tratamiento",
        paragraphs: [
          "El responsable del tratamiento de tus datos personales es:",
          "Bike ME (desarrollador: Morten Muusmann)\nE-mail: kontakt@bikeme.one"
        ]
      },
      {
        heading: "Qué información recopilamos",
        paragraphs: [
          "Cuando usas Bike ME, podemos tratar las siguientes categorías de datos personales:"
        ],
        list: [
          {
            label: "Datos de cuenta",
            text: "nombre y dirección de correo electrónico en relación con la creación y el uso de la cuenta (el inicio de sesión se gestiona mediante nuestra solución de autenticación)."
          },
          {
            label: "Datos de perfil y app",
            text: 'información que tú mismo completas en tu perfil (por ejemplo nivel, tipo de bicicleta, región de origen, "sobre mí" y posible foto de perfil).'
          },
          {
            label: "Datos de salidas (contenido que creas)",
            text: "título, descripción, disciplina, hora, duración, distancia (si procede), punto de encuentro/lugar de inicio y otra información que decidas añadir. Información sobre participación (por ejemplo quién se ha apuntado a una salida)."
          },
          {
            label: "Datos de ruta (opcional)",
            text: "si importas un archivo GPX, guardamos los datos de ruta junto con la salida para que la ruta pueda mostrarse en el mapa."
          },
          {
            label: "Datos de ubicación",
            text: "tu ubicación cuando das permiso activamente a la app. La ubicación se usa para funciones de mapa (por ejemplo mostrar puntos de encuentro fijos y salidas cercanas), así como para el seguimiento en vivo y el registro de tu ruta, velocidad y distancia cuando eliges activamente iniciar y registrar una salida en bicicleta en la app. Puedes desactivar la ubicación en cualquier momento en los ajustes de tu dispositivo."
          },
          {
            label: "Notificaciones push",
            text: "si permites push, guardamos un token push (ID de dispositivo para notificaciones) para poder enviar mensajes importantes sobre salidas, por ejemplo cambios o cuando el anfitrión ya no pueda asistir. Puedes desactivar push en los ajustes/perfil de la app o en los ajustes del teléfono."
          },
          {
            label: "Datos técnicos",
            text: "tipo de dispositivo, sistema operativo, versión de la app y datos de registro/informes de errores (en la medida necesaria). Esto se usa para operar, solucionar problemas y mejorar el Servicio."
          },
          {
            label: "Comunicación y soporte",
            text: "consultas que nos envías por e-mail e información relevante que compartes en relación con soporte."
          }
        ]
      },
      {
        heading: "Finalidades y base legal",
        paragraphs: ["Tratamos tus datos personales para las siguientes finalidades:"],
        list: [
          { text: "a) Crear y operar tu cuenta y perfil — RGPD art. 6(1)(b)." },
          { text: "b) Crear, mostrar y administrar salidas — RGPD art. 6(1)(b)." },
          { text: "c) Funciones basadas en ubicación — RGPD art. 6(1)(b) y/o (f)." },
          {
            text: "d) Notificaciones push sobre cambios importantes en salidas — RGPD art. 6(1)(b) y/o (f). (El permiso de notificaciones se controla desde el dispositivo.)"
          },
          { text: "e) Operación, seguridad y mejora — RGPD art. 6(1)(f)." },
          { text: "f) Comunicación y soporte — RGPD art. 6(1)(b) y/o (f)." }
        ]
      },
      {
        heading: "Destinatarios y uso de encargados del tratamiento",
        paragraphs: [
          "No compartimos tus datos personales con otras empresas para su propio marketing.",
          "Usamos encargados del tratamiento seleccionados para operar el Servicio, por ejemplo:"
        ],
        list: [
          { text: "proveedor de hosting y base de datos" },
          { text: "proveedor de notificaciones push" },
          { text: "herramientas de errores/registros (si se usan)" }
        ],
        afterList: [
          "Los encargados del tratamiento solo pueden tratar información en nuestro nombre y siguiendo nuestras instrucciones."
        ]
      },
      {
        heading: "Transferencias a terceros países",
        paragraphs: [
          "Algunos encargados del tratamiento pueden estar ubicados fuera de la UE/EEE. En esos casos, garantizamos una base válida para la transferencia, por ejemplo las cláusulas contractuales tipo de la Comisión Europea (SCC)."
        ]
      },
      {
        heading: "Periodo de conservación",
        paragraphs: [
          "Conservamos los datos personales durante el tiempo necesario para los fines para los que se recopilaron, o durante el tiempo que estemos legalmente obligados a conservarlos.",
          "Puedes eliminar tu cuenta y los datos relacionados en cualquier momento directamente en la app en Perfil -> Ajustes, o contactándonos en kontakt@bikeme.one.",
          "Si eliminas tu cuenta, eliminaremos o anonimizaremos tus datos personales en un plazo de 30 días, salvo que estemos legalmente obligados a conservarlos durante más tiempo."
        ]
      },
      {
        heading: "Tus derechos",
        paragraphs: [
          "Tienes derecho a: acceso, rectificación, supresión, limitación, oposición, portabilidad de datos.",
          "Contacto: kontakt@bikeme.one\nPuedes presentar una reclamación ante la Agencia Danesa de Protección de Datos."
        ]
      },
      {
        heading: "Uso del Servicio por menores",
        paragraphs: [
          "Bike ME está dirigido a usuarios mayores de 18 años. Si tenemos conocimiento de que hemos recopilado datos personales de un menor, eliminaremos la información lo antes posible."
        ]
      },
      {
        heading: "Cambios en esta política de privacidad",
        paragraphs: [
          "Podemos actualizar esta política de privacidad de vez en cuando. La versión más reciente estará siempre disponible en la app y/o en nuestro sitio web. En caso de cambios importantes, avisaremos de forma clara siempre que sea posible."
        ]
      }
    ]
  },
  it: {
    intro: [
      'Questa informativa sulla privacy descrive come Bike ME ("noi", "ci" o "nostro") tratta i dati personali in relazione al tuo uso dell\'app Bike ME e dei servizi collegati (collettivamente, il "Servizio").',
      "Proteggiamo la tua privacy e trattiamo i dati personali in conformità alla normativa applicabile sulla protezione dei dati, incluso il Regolamento generale sulla protezione dei dati (GDPR)."
    ],
    sections: [
      {
        heading: "Titolare del trattamento",
        paragraphs: [
          "Il titolare del trattamento dei tuoi dati personali è:",
          "Bike ME (sviluppatore: Morten Muusmann)\nE-mail: kontakt@bikeme.one"
        ]
      },
      {
        heading: "Quali informazioni raccogliamo",
        paragraphs: [
          "Quando usi Bike ME, possiamo trattare le seguenti categorie di dati personali:"
        ],
        list: [
          {
            label: "Dati dell'account",
            text: "nome e indirizzo e-mail in relazione alla creazione e all'uso dell'account (il login è gestito tramite la nostra soluzione di autenticazione)."
          },
          {
            label: "Dati di profilo e app",
            text: 'informazioni che inserisci nel tuo profilo (ad esempio livello, tipo di bici, regione di riferimento, "qualcosa su di me" ed eventuale immagine del profilo).'
          },
          {
            label: "Dati delle uscite (contenuti che crei)",
            text: "titolo, descrizione, disciplina, orario, durata, distanza (se rilevante), punto di ritrovo/luogo di partenza e altre informazioni che scegli di aggiungere. Informazioni sulla partecipazione (ad esempio chi si è iscritto a un'uscita)."
          },
          {
            label: "Dati di percorso (opzionali)",
            text: "se importi un file GPX, salviamo i dati del percorso insieme all'uscita, così il percorso può essere mostrato sulla mappa."
          },
          {
            label: "Dati di localizzazione",
            text: "la tua posizione quando concedi attivamente il permesso all'app. La posizione viene usata per le funzioni mappa (ad esempio per mostrare punti di ritrovo fissi e uscite nelle vicinanze), oltre che per il live tracking e la registrazione del tuo percorso, velocità e distanza quando scegli attivamente di avviare e registrare un'uscita in bici nell'app. Puoi disattivare la posizione in qualsiasi momento nelle impostazioni del dispositivo."
          },
          {
            label: "Notifiche push",
            text: "se autorizzi le notifiche push, salviamo un token push (ID dispositivo per le notifiche) per poter inviare messaggi importanti sulle uscite, ad esempio modifiche o quando l'host non può più partecipare. Puoi disattivare le push nelle impostazioni/profilo dell'app o nelle impostazioni del telefono."
          },
          {
            label: "Dati tecnici",
            text: "tipo di dispositivo, sistema operativo, versione dell'app e dati di log/segnalazioni di errore (nella misura necessaria). Questi dati sono usati per gestione, risoluzione dei problemi e miglioramento del Servizio."
          },
          {
            label: "Comunicazione e supporto",
            text: "richieste che ci invii via e-mail e informazioni rilevanti che condividi in relazione al supporto."
          }
        ]
      },
      {
        heading: "Finalità e base giuridica",
        paragraphs: ["Trattiamo i tuoi dati personali per le seguenti finalità:"],
        list: [
          { text: "a) Creazione e gestione del tuo account e profilo — GDPR art. 6(1)(b)." },
          { text: "b) Creazione, visualizzazione e gestione delle uscite — GDPR art. 6(1)(b)." },
          { text: "c) Funzioni basate sulla localizzazione — GDPR art. 6(1)(b) e/o (f)." },
          {
            text: "d) Notifiche push su modifiche importanti alle uscite — GDPR art. 6(1)(b) e/o (f). (Il permesso per le notifiche è gestito dal dispositivo.)"
          },
          { text: "e) Gestione, sicurezza e miglioramento — GDPR art. 6(1)(f)." },
          { text: "f) Comunicazione e supporto — GDPR art. 6(1)(b) e/o (f)." }
        ]
      },
      {
        heading: "Destinatari e uso di responsabili del trattamento",
        paragraphs: [
          "Non condividiamo i tuoi dati personali con altre aziende per il loro marketing.",
          "Usiamo responsabili del trattamento selezionati per gestire il Servizio, ad esempio:"
        ],
        list: [
          { text: "fornitore di hosting e database" },
          { text: "fornitore di notifiche push" },
          { text: "strumenti di errore/logging (se usati)" }
        ],
        afterList: [
          "I responsabili del trattamento possono trattare le informazioni solo per nostro conto e secondo le nostre istruzioni."
        ]
      },
      {
        heading: "Trasferimenti verso paesi terzi",
        paragraphs: [
          "Alcuni responsabili del trattamento possono trovarsi fuori dall'UE/SEE. In questi casi garantiamo una base valida per il trasferimento, ad esempio le clausole contrattuali standard della Commissione europea (SCC)."
        ]
      },
      {
        heading: "Periodo di conservazione",
        paragraphs: [
          "Conserviamo i dati personali per il tempo necessario agli scopi per cui sono stati raccolti, o per il tempo in cui siamo legalmente obbligati a conservarli.",
          "Puoi eliminare il tuo account e i dati associati in qualsiasi momento direttamente nell'app in Profilo -> Impostazioni, oppure contattandoci a kontakt@bikeme.one.",
          "Se elimini il tuo account, elimineremo o anonimizzeremo i tuoi dati personali entro 30 giorni, salvo che siamo legalmente obbligati a conservarli più a lungo."
        ]
      },
      {
        heading: "I tuoi diritti",
        paragraphs: [
          "Hai diritto a: accesso, rettifica, cancellazione, limitazione, opposizione, portabilità dei dati.",
          "Contatto: kontakt@bikeme.one\nPuoi presentare reclamo all'Autorità danese per la protezione dei dati."
        ]
      },
      {
        heading: "Uso del Servizio da parte dei minori",
        paragraphs: [
          "Bike ME è rivolto a utenti con più di 18 anni. Se veniamo a conoscenza di aver raccolto dati personali di un minore, elimineremo le informazioni il prima possibile."
        ]
      },
      {
        heading: "Modifiche a questa informativa sulla privacy",
        paragraphs: [
          "Possiamo aggiornare questa informativa sulla privacy di tanto in tanto. La versione più recente sarà sempre disponibile nell'app e/o sul nostro sito web. In caso di modifiche sostanziali, forniremo un avviso chiaro ove possibile."
        ]
      }
    ]
  },
  fr: {
    intro: [
      'Cette politique de confidentialité décrit comment Bike ME ("nous", "notre" ou "nos") traite les données personnelles dans le cadre de votre utilisation de l\'app Bike ME et des services associés (ensemble, le "Service").',
      "Nous protégeons votre vie privée et traitons les données personnelles conformément à la législation applicable en matière de protection des données, y compris le Règlement général sur la protection des données (RGPD)."
    ],
    sections: [
      {
        heading: "Responsable du traitement",
        paragraphs: [
          "Le responsable du traitement de vos données personnelles est :",
          "Bike ME (développeur : Morten Muusmann)\nE-mail : kontakt@bikeme.one"
        ]
      },
      {
        heading: "Quelles informations nous collectons",
        paragraphs: [
          "Lorsque vous utilisez Bike ME, nous pouvons traiter les catégories suivantes de données personnelles :"
        ],
        list: [
          {
            label: "Données de compte",
            text: "nom et adresse e-mail dans le cadre de la création et de l'utilisation du compte (la connexion est gérée par notre solution d'authentification)."
          },
          {
            label: "Données de profil et d'app",
            text: 'informations que vous renseignez vous-même dans votre profil (par exemple niveau, type de vélo, région de rattachement, "à propos de moi" et éventuelle photo de profil).'
          },
          {
            label: "Données de sortie (contenu que vous créez)",
            text: "titre, description, discipline, heure, durée, distance (le cas échéant), lieu de rendez-vous/point de départ et autres informations que vous choisissez d'ajouter. Informations de participation (par exemple qui s'est inscrit à une sortie)."
          },
          {
            label: "Données d'itinéraire (optionnel)",
            text: "si vous importez un fichier GPX, nous enregistrons les données d'itinéraire avec la sortie afin que l'itinéraire puisse être affiché sur la carte."
          },
          {
            label: "Données de localisation",
            text: "votre localisation lorsque vous donnez activement l'autorisation à l'app. La localisation est utilisée pour les fonctions de carte (par exemple l'affichage de points de rendez-vous fixes et de sorties proches), ainsi que pour le suivi en direct et l'enregistrement de votre itinéraire, vitesse et distance lorsque vous choisissez activement de démarrer et d'enregistrer une sortie à vélo dans l'app. Vous pouvez désactiver la localisation à tout moment dans les paramètres de votre appareil."
          },
          {
            label: "Notifications push",
            text: "si vous autorisez les notifications push, nous enregistrons un token push (ID d'appareil pour les notifications) afin d'envoyer des messages importants sur les sorties, par exemple des changements ou lorsque l'hôte ne peut plus participer. Vous pouvez désactiver les notifications push dans les paramètres/le profil de l'app ou dans les paramètres du téléphone."
          },
          {
            label: "Données techniques",
            text: "type d'appareil, système d'exploitation, version de l'app ainsi que données de journal/rapports d'erreur (dans la mesure nécessaire). Ces données servent à l'exploitation, au dépannage et à l'amélioration du Service."
          },
          {
            label: "Communication et support",
            text: "demandes que vous nous envoyez par e-mail, ainsi que les informations pertinentes que vous partagez dans le cadre du support."
          }
        ]
      },
      {
        heading: "Finalités et base juridique",
        paragraphs: ["Nous traitons vos données personnelles aux fins suivantes :"],
        list: [
          { text: "a) Création et gestion de votre compte et profil — RGPD art. 6(1)(b)." },
          { text: "b) Création, affichage et administration des sorties — RGPD art. 6(1)(b)." },
          { text: "c) Fonctions basées sur la localisation — RGPD art. 6(1)(b) et/ou (f)." },
          {
            text: "d) Notifications push concernant les changements importants de sortie — RGPD art. 6(1)(b) et/ou (f). (L'autorisation de notification est contrôlée par l'appareil.)"
          },
          { text: "e) Exploitation, sécurité et amélioration — RGPD art. 6(1)(f)." },
          { text: "f) Communication et support — RGPD art. 6(1)(b) et/ou (f)." }
        ]
      },
      {
        heading: "Destinataires et recours à des sous-traitants",
        paragraphs: [
          "Nous ne partageons pas vos données personnelles avec d'autres entreprises pour leur propre marketing.",
          "Nous utilisons des sous-traitants sélectionnés pour exploiter le Service, par exemple :"
        ],
        list: [
          { text: "fournisseur d'hébergement et de base de données" },
          { text: "fournisseur de notifications push" },
          { text: "outils d'erreurs/de journalisation (si utilisés)" }
        ],
        afterList: [
          "Les sous-traitants ne peuvent traiter les informations que pour notre compte et selon nos instructions."
        ]
      },
      {
        heading: "Transferts vers des pays tiers",
        paragraphs: [
          "Certains sous-traitants peuvent être situés en dehors de l'UE/EEE. Dans ce cas, nous garantissons une base de transfert valide, par exemple les clauses contractuelles types de la Commission européenne (SCC)."
        ]
      },
      {
        heading: "Durée de conservation",
        paragraphs: [
          "Nous conservons les données personnelles aussi longtemps que nécessaire aux finalités pour lesquelles elles ont été collectées, ou aussi longtemps que nous y sommes légalement tenus.",
          "Vous pouvez supprimer votre compte et les données associées à tout moment directement dans l'app sous Profil -> Paramètres, ou en nous contactant à kontakt@bikeme.one.",
          "Si vous supprimez votre compte, nous supprimerons ou anonymiserons vos données personnelles dans un délai de 30 jours, sauf si nous sommes légalement tenus de les conserver plus longtemps."
        ]
      },
      {
        heading: "Vos droits",
        paragraphs: [
          "Vous disposez des droits suivants : accès, rectification, suppression, limitation, opposition, portabilité des données.",
          "Contact : kontakt@bikeme.one\nVous pouvez déposer une plainte auprès de l'Agence danoise de protection des données."
        ]
      },
      {
        heading: "Utilisation du Service par les enfants",
        paragraphs: [
          "Bike ME s'adresse aux utilisateurs de plus de 18 ans. Si nous apprenons que nous avons collecté des données personnelles concernant un enfant, nous supprimerons ces informations dès que possible."
        ]
      },
      {
        heading: "Modifications de cette politique de confidentialité",
        paragraphs: [
          "Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. La dernière version sera toujours disponible dans l'app et/ou sur notre site web. En cas de modifications importantes, nous fournirons un avis clair dans la mesure du possible."
        ]
      }
    ]
  },
  nl: {
    intro: [
      'Dit privacybeleid beschrijft hoe Bike ME ("wij", "ons" of "onze") persoonsgegevens verwerkt in verband met je gebruik van de Bike ME-app en bijbehorende diensten (samen de "Dienst").',
      "We beschermen je privacy en verwerken persoonsgegevens in overeenstemming met toepasselijke wetgeving inzake gegevensbescherming, waaronder de Algemene verordening gegevensbescherming (AVG)."
    ],
    sections: [
      {
        heading: "Verwerkingsverantwoordelijke",
        paragraphs: [
          "De verwerkingsverantwoordelijke voor de verwerking van je persoonsgegevens is:",
          "Bike ME (ontwikkelaar: Morten Muusmann)\nE-mail: kontakt@bikeme.one"
        ]
      },
      {
        heading: "Welke informatie we verzamelen",
        paragraphs: [
          "Wanneer je Bike ME gebruikt, kunnen we de volgende categorieën persoonsgegevens verwerken:"
        ],
        list: [
          {
            label: "Accountgegevens",
            text: "naam en e-mailadres in verband met het aanmaken en gebruiken van een account (inloggen wordt afgehandeld via onze authenticatieoplossing)."
          },
          {
            label: "Profiel- en appgegevens",
            text: 'informatie die je zelf invult in je profiel (bijvoorbeeld niveau, fietstype, thuisregio, "over mij" en eventuele profielfoto).'
          },
          {
            label: "Ritgegevens (content die je maakt)",
            text: "titel, beschrijving, discipline, tijdstip, duur, afstand (indien relevant), ontmoetingsplek/startlocatie en andere informatie die je toevoegt. Informatie over deelname (bijvoorbeeld wie zich heeft aangemeld voor een rit)."
          },
          {
            label: "Routegegevens (optioneel)",
            text: "als je een GPX-bestand importeert, slaan we routegegevens samen met de rit op zodat de route op de kaart kan worden weergegeven."
          },
          {
            label: "Locatiegegevens",
            text: "je locatie wanneer je de app actief toestemming geeft. Locatie wordt gebruikt voor kaartfuncties (bijvoorbeeld het tonen van vaste ontmoetingsplekken en ritten in de buurt), evenals voor live tracking en het registreren van je route, snelheid en afstand wanneer je er actief voor kiest om een fietsrit in de app te starten en te registreren. Je kunt locatie op elk moment uitschakelen in de instellingen van je apparaat."
          },
          {
            label: "Pushmeldingen",
            text: "als je push toestaat, bewaren we een pushtoken (apparaat-ID voor meldingen) om belangrijke berichten over ritten te kunnen sturen, bijvoorbeeld wijzigingen of wanneer de host toch niet kan. Je kunt push uitschakelen in de appinstellingen/het profiel of in de instellingen van je telefoon."
          },
          {
            label: "Technische gegevens",
            text: "apparaatsoort, besturingssysteem, appversie en loggegevens/foutrapporten (voor zover nodig). Dit wordt gebruikt voor beheer, probleemoplossing en verbetering van de Dienst."
          },
          {
            label: "Communicatie en support",
            text: "vragen die je ons per e-mail stuurt, en relevante informatie die je deelt in verband met support."
          }
        ]
      },
      {
        heading: "Doeleinden en rechtsgrond",
        paragraphs: ["We verwerken je persoonsgegevens voor de volgende doeleinden:"],
        list: [
          { text: "a) Aanmaken en beheren van je account en profiel — AVG art. 6(1)(b)." },
          { text: "b) Aanmaken, tonen en beheren van ritten — AVG art. 6(1)(b)." },
          { text: "c) Locatiegebaseerde functies — AVG art. 6(1)(b) en/of (f)." },
          {
            text: "d) Pushmeldingen over belangrijke ritwijzigingen — AVG art. 6(1)(b) en/of (f). (Meldingstoestemming wordt beheerd door het apparaat.)"
          },
          { text: "e) Beheer, beveiliging en verbetering — AVG art. 6(1)(f)." },
          { text: "f) Communicatie en support — AVG art. 6(1)(b) en/of (f)." }
        ]
      },
      {
        heading: "Ontvangers en gebruik van verwerkers",
        paragraphs: [
          "We delen je persoonsgegevens niet met andere bedrijven voor hun eigen marketing.",
          "We gebruiken geselecteerde verwerkers voor de werking van de Dienst, bijvoorbeeld:"
        ],
        list: [
          { text: "hosting- en databaseprovider" },
          { text: "provider van pushmeldingen" },
          { text: "fout-/loggingtools (indien gebruikt)" }
        ],
        afterList: [
          "Verwerkers mogen informatie alleen namens ons en volgens onze instructies verwerken."
        ]
      },
      {
        heading: "Doorgifte naar derde landen",
        paragraphs: [
          "Sommige verwerkers kunnen buiten de EU/EER gevestigd zijn. In zulke gevallen zorgen we voor een geldige doorgiftegrondslag, bijvoorbeeld de standaardcontractbepalingen van de Europese Commissie (SCC)."
        ]
      },
      {
        heading: "Bewaartermijn",
        paragraphs: [
          "We bewaren persoonsgegevens zolang dat nodig is voor de doeleinden waarvoor ze zijn verzameld, of zolang we wettelijk verplicht zijn ze te bewaren.",
          "Je kunt je account en bijbehorende gegevens op elk moment rechtstreeks in de app verwijderen onder Profiel -> Instellingen, of door contact met ons op te nemen via kontakt@bikeme.one.",
          "Als je je account verwijdert, verwijderen of anonimiseren we je persoonsgegevens binnen 30 dagen, tenzij we wettelijk verplicht zijn ze langer te bewaren."
        ]
      },
      {
        heading: "Je rechten",
        paragraphs: [
          "Je hebt recht op: inzage, rectificatie, verwijdering, beperking, bezwaar, gegevensoverdraagbaarheid.",
          "Contact: kontakt@bikeme.one\nJe kunt een klacht indienen bij de Deense gegevensbeschermingsautoriteit."
        ]
      },
      {
        heading: "Gebruik van de Dienst door kinderen",
        paragraphs: [
          "Bike ME is bedoeld voor gebruikers ouder dan 18 jaar. Als we ontdekken dat we persoonsgegevens over een kind hebben verzameld, verwijderen we die informatie zo snel mogelijk."
        ]
      },
      {
        heading: "Wijzigingen in dit privacybeleid",
        paragraphs: [
          "We kunnen dit privacybeleid van tijd tot tijd bijwerken. De nieuwste versie is altijd beschikbaar in de app en/of op onze website. Bij wezenlijke wijzigingen geven we, voor zover mogelijk, duidelijk bericht."
        ]
      }
    ]
  }
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({ params }: LocalePageProps): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const fallback = metadataByLocale.en!;
  const meta = metadataByLocale[locale] ?? fallback;

  return {
    title: meta.title,
    description: meta.description
  };
}

function renderWithLineBreaks(text: string) {
  return text.split("\n").map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

export default function PrivacyPage({ params }: LocalePageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const fallback = uiByLocale.en!;
  const ui = uiByLocale[locale] ?? fallback;
  const privacy = privacyContentByLocale[locale] ?? privacyContentByLocale.en;

  return (
    <div className="pb-12">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060b16]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#060b16]/70">
        <div className="section-shell flex h-20 items-center justify-between gap-4">
          <Link href={`/${locale}`} aria-label="Bike Me" className="flex items-center">
            <Image
              src="/brand/bike-me-logo-white.png"
              alt="Bike Me logo"
              width={1024}
              height={1024}
              className="h-11 w-auto md:h-14"
              priority
            />
          </Link>

          <Link
            href={`/${locale}`}
            className="rounded-full border border-white/20 bg-white/[0.03] px-5 py-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:border-white/40 hover:text-white"
          >
            {ui.backToHome}
          </Link>
        </div>
      </header>

      <main className="section-shell pt-10 md:pt-14">
        <article className="glass-panel rounded-3xl border px-6 py-8 text-[var(--ink-soft)] shadow-[0_30px_70px_-44px_rgba(0,0,0,0.9)] md:px-10 md:py-10">
          <h1 className="font-display text-3xl font-semibold leading-tight text-[var(--ink)] md:text-4xl">
            {ui.pageTitle}
          </h1>
          <p className="mt-3 text-sm text-[rgb(155,170,206)]">{ui.lastUpdated}</p>

          <div className="mt-8 space-y-7 leading-relaxed">
            <section className="space-y-4">
              {privacy.intro.map((paragraph) => (
                <p key={paragraph}>{renderWithLineBreaks(paragraph)}</p>
              ))}
            </section>

            {privacy.sections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{renderWithLineBreaks(paragraph)}</p>
                ))}
                {section.list ? (
                  <ul className="list-disc space-y-2 pl-6 marker:text-[rgb(147,171,255)]">
                    {section.list.map((item) => (
                      <li key={item.label ?? item.text}>
                        {item.label ? (
                          <>
                            <strong className="text-[var(--ink)]">{item.label}:</strong>{" "}
                          </>
                        ) : null}
                        {item.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.afterList?.map((paragraph) => (
                  <p key={paragraph}>{renderWithLineBreaks(paragraph)}</p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
