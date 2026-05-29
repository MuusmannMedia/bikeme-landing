import { defaultLocale, type Locale } from "@/lib/locales";

type FeatureItem = {
  title: string;
  description: string;
};

type StepItem = {
  title: string;
  description: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type ScreenshotItem = {
  image: string;
  title: string;
  description: string;
};

type PricingPlan = {
  name: string;
  label: string;
  description: string;
  items: string[];
};

export type Dictionary = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    features: string;
    howItWorks: string;
    screenshots: string;
    pricing: string;
    faq: string;
    joinTestFlight: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    payoffTitle: string;
    payoffText: string;
    primaryCta: string;
    secondaryCta: string;
    previewLabel: string;
  };
  brand: {
    intro: string;
    bullets: string[];
  };
  features: {
    eyebrow: string;
    title: string;
    items: FeatureItem[];
  };
  howItWorks: {
    eyebrow: string;
    title: string;
    steps: StepItem[];
  };
  screenshots: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: ScreenshotItem[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    plans: PricingPlan[];
    cta: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: FaqItem[];
  };
  footer: {
    tagline: string;
    privacy: string;
    terms: string;
    contact: string;
  };
};

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    meta: {
      title: "Bike Me | Beta on TestFlight",
      description:
        "Bike Me is open for iPhone beta testers via TestFlight. Beta testers get 12 months of free Bike Me Pro at official launch."
    },
    nav: {
      features: "Features",
      howItWorks: "How it works",
      screenshots: "Screenshots",
      pricing: "Free vs Pro",
      faq: "FAQ",
      joinTestFlight: "Get via TestFlight"
    },
    hero: {
      headline: "Bike Me is open for beta testers",
      subheadline:
        "Find riders, create rides, invite cycling friends, and track your rides. Help us test Bike Me via TestFlight.",
      payoffTitle: "12 months of free Pro for beta testers",
      payoffText:
        "As a thank you, all beta testers get 12 months of free Bike Me Pro when the app officially launches. Requires iPhone and Apple's TestFlight app.",
      primaryCta: "Get via TestFlight",
      secondaryCta: "See how it works",
      previewLabel: "App preview"
    },
    brand: {
      intro: "Bike ME is built around spontaneous RIDE NOW rides",
      bullets: [
        "Create a RIDE NOW ride in seconds",
        "Find nearby riders on the map",
        "Agree on meeting point and time",
        "Import a GPX route (optional)",
        "Get push alerts for important changes"
      ]
    },
    features: {
      eyebrow: "Features",
      title: "Cycling plans without the chaos",
      items: [
        {
          title: "See rides near you",
          description: "Discover nearby rides instantly on a clean map-first view."
        },
        {
          title: "Ride Now or plan ahead",
          description: "Start in minutes with Ride Now or schedule future rides in advance."
        },
        {
          title: "Invite the right riders",
          description: "Choose exactly who to invite and keep your group dialed in."
        },
        {
          title: "Import GPX routes",
          description: "Import a GPX file so the route can appear on the map."
        },
        {
          title: "Smart participant notifications",
          description: "If a host cannot make it, participants are informed right away."
        }
      ]
    },
    howItWorks: {
      eyebrow: "How it works",
      title: "From map to meetup in three steps",
      steps: [
        {
          title: "Open the map and spot rides",
          description: "See active and planned rides around you in seconds."
        },
        {
          title: "Create Ride Now or plan a ride",
          description: "Host something immediate or set a date for later."
        },
        {
          title: "Invite riders and roll out",
          description: "Confirm who is joining and head out together."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshots",
      title: "Built to stay clear before, during, and after every ride",
      subtitle: "From free RIDE NOW tools to deeper Pro insights when you want more.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Map overview",
          description: "Find riders near you and see who's ready for a ride right now."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Create a RIDE NOW ride",
          description: "Set a route, time, and meeting point in seconds."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "The community",
          description: "Find riders at your level and invite them along."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Ready to start",
          description: "Gather the group and start live tracking directly from the map."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Ride details (Pro)",
          description: "Dive into your data. See watts, training zones, and climbs after the ride."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Track your progress (Pro)",
          description: "Follow your fitness over time with detailed charts and 12-month history."
        }
      ]
    },
    pricing: {
      eyebrow: "Free vs Pro",
      title: "Become a beta tester - get 12 months of Pro",
      subtitle:
        "Start free with the core social ride tools. As a beta tester, you get 12 months of Bike ME Pro when the app officially launches.",
      plans: [
        {
          name: "Bike ME",
          label: "Free",
          description: "Map, RIDE NOW, find riders, basic route data, and simple history.",
          items: [
            "Map-based ride discovery",
            "RIDE NOW and planned rides",
            "Find nearby riders",
            "Basic route data",
            "Simple ride history"
          ]
        },
        {
          name: "Bike ME Pro",
          label: "Pro",
          description:
            "See your development. Full watt estimation, training zones (heart rate/watts), advanced 12M history, and progress graphs.",
          items: [
            "Full watt estimation",
            "Training zones for heart rate and watts",
            "Advanced 12-month history",
            "Progress and development graphs",
            "Deeper ride insights"
          ]
        }
      ],
      cta: "Get via TestFlight"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions",
      items: [
        {
          question: "Is Bike Me free?",
          answer:
            "Yes. The key social features are free: find riders, create rides, invite others, and track your rides. Bike ME Pro gives access to deeper history, status, watt estimation, training zones, and progress graphs. As a beta tester, you get 12 months of free Pro when the app officially launches."
        },
        {
          question: "Can I test Bike Me now?",
          answer:
            "Yes. Bike Me is currently open for iOS beta testers via TestFlight. All beta testers get 12 months of free Bike Me Pro when the app officially launches."
        },
        {
          question: "How does Ride Now work?",
          answer: "Ride Now lets you create a ride that starts soon so nearby cyclists can join quickly."
        },
        {
          question: "Can I import a route?",
          answer:
            "Yes. You can import a GPX file if you want a planned route to appear on the map."
        },
        {
          question: "How do notifications work?",
          answer: "Participants receive push notifications for important updates, including when a host can no longer make it."
        }
      ]
    },
    footer: {
      tagline: "Bike Me",
      privacy: "Privacy",
      terms: "Terms",
      contact: "Contact"
    }
  },
  da: {
    meta: {
      title: "Bike Me | Beta via TestFlight",
      description:
        "Bike Me er åben for iPhone beta-testere via TestFlight. Beta-testere får 12 måneders gratis Bike Me Pro ved officiel lancering."
    },
    nav: {
      features: "Funktioner",
      howItWorks: "Sådan virker det",
      screenshots: "Skærmbilleder",
      pricing: "Gratis vs Pro",
      faq: "FAQ",
      joinTestFlight: "Hent via TestFlight"
    },
    hero: {
      headline: "Bike Me er åben for beta-testere",
      subheadline:
        "Find ryttere, opret ture, inviter cykelvenner og track dine cykelture. Hjælp os med at teste Bike Me via TestFlight.",
      payoffTitle: "12 måneders gratis Pro til beta-testere",
      payoffText:
        "Som tak får alle beta-testere 12 måneders gratis Bike Me Pro, når appen lanceres officielt. Kræver iPhone og Apples TestFlight-app.",
      primaryCta: "Hent via TestFlight",
      secondaryCta: "Se hvordan det virker",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike ME er skabt til spontane KØR NU-ture",
      bullets: [
        "Opret en KØR NU-tur på få sekunder",
        "Find deltagere tæt på dig på kortet",
        "Aftal mødested og tidspunkt",
        "Importér en GPX-rute (valgfrit)",
        "Få push-besked ved vigtige ændringer"
      ]
    },
    features: {
      eyebrow: "Funktioner",
      title: "Planlæg fællesture uden kaos",
      items: [
        {
          title: "Se ture tæt på dig",
          description: "Find rides i nærheden med det samme i en kortbaseret visning."
        },
        {
          title: "Ride Now eller planlæg frem",
          description: "Start om få minutter eller planlæg ture i god tid."
        },
        {
          title: "Invitér de rigtige ryttere",
          description: "Vælg præcis hvem du vil køre med."
        },
        {
          title: "Importér GPX-ruter",
          description: "Importér en GPX-fil, så ruten kan vises på kortet."
        },
        {
          title: "Smarte notifikationer",
          description: "Deltagere får besked med det samme, hvis en vært ikke kan alligevel."
        }
      ]
    },
    howItWorks: {
      eyebrow: "Sådan virker det",
      title: "Fra kort til afgang i tre trin",
      steps: [
        {
          title: "Åbn kortet og find ture",
          description: "Se aktive og planlagte ture omkring dig på få sekunder."
        },
        {
          title: "Opret Ride Now eller planlæg en tur",
          description: "Start nu eller vælg en dato senere."
        },
        {
          title: "Invitér ryttere og kør",
          description: "Se hvem der er med, og rul ud sammen."
        }
      ]
    },
    screenshots: {
      eyebrow: "Skærmbilleder",
      title: "Designet til at være enkelt før, under og efter turen",
      subtitle: "Fra gratis KØR NU-værktøjer til dybere Pro-indsigter, når du vil mere.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Kortoversigt",
          description: "Find ryttere tæt på dig og se, hvem der er klar til en tur lige nu."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Opret KØR NU tur",
          description: "Sæt en rute, et tidspunkt og et mødested på få sekunder."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Fællesskabet",
          description: "Find ryttere på dit niveau og invitér dem med på turen."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Klar til start",
          description: "Saml gruppen og start live-tracking direkte fra kortet."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Turdetaljer (Pro)",
          description: "Dyk ned i dine data. Se watt, træningszoner og stigninger efter turen."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Se din udvikling (Pro)",
          description: "Følg din form over tid med dybdegående grafer og 12-måneders historik."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Bliv beta-tester - få 12 måneder Pro",
      subtitle:
        "Start gratis med de vigtigste sociale turfunktioner. Som beta-tester får du 12 måneders Bike ME Pro, når appen lanceres officielt.",
      plans: [
        {
          name: "Bike ME",
          label: "Gratis",
          description: "Kort, KØR NU, find ryttere, basis rutedata og simpel historik.",
          items: [
            "Kortbaseret tur-overblik",
            "KØR NU og planlagte ture",
            "Find ryttere tæt på dig",
            "Basis rutedata",
            "Simpel historik"
          ]
        },
        {
          name: "Bike ME Pro",
          label: "Pro",
          description:
            "Se din udvikling. Fuld watt-estimering, træningszoner (puls/watt), avanceret 12M historik og udviklingsgrafer.",
          items: [
            "Fuld watt-estimering",
            "Træningszoner for puls og watt",
            "Avanceret 12M historik",
            "Udviklingsgrafer",
            "Dybdegående tur-statistik"
          ]
        }
      ],
      cta: "Hent via TestFlight"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Ofte stillede spørgsmål",
      items: [
        {
          question: "Er Bike Me gratis?",
          answer:
            "Ja. De vigtigste sociale funktioner er gratis: find ryttere, opret ture, inviter andre og track dine ture. Bike ME Pro giver adgang til dybere historik, status, watt-estimering, træningszoner og udviklingsgrafer. Som beta-tester får du 12 måneders gratis Pro, når appen lanceres officielt."
        },
        {
          question: "Kan jeg teste Bike Me nu?",
          answer:
            "Ja. Bike Me er lige nu åben for iOS beta-testere via TestFlight. Alle beta-testere får 12 måneders gratis Bike Me Pro, når appen lanceres officielt."
        },
        {
          question: "Hvordan virker Ride Now?",
          answer: "Ride Now lader dig oprette en tur, der starter snart, så ryttere i nærheden hurtigt kan deltage."
        },
        {
          question: "Kan jeg importere en rute?",
          answer:
            "Ja. Du kan importere en GPX-fil, hvis du vil have en planlagt rute vist på kortet."
        },
        {
          question: "Hvordan virker notifikationer?",
          answer: "Deltagere modtager pushnotifikationer ved vigtige ændringer, inklusiv hvis værten melder afbud."
        }
      ]
    },
    footer: {
      tagline: "Bike Me",
      privacy: "Privatliv",
      terms: "Vilkår",
      contact: "Kontakt"
    }
  },
  de: {
    meta: {
      title: "Bike Me | Beta über TestFlight",
      description:
        "Bike Me ist für iPhone-Betatester über TestFlight geöffnet. Betatester erhalten 12 Monate Bike Me Pro kostenlos zum offiziellen Launch."
    },
    nav: {
      features: "Funktionen",
      howItWorks: "So funktioniert's",
      screenshots: "Screenshots",
      pricing: "Kostenlos vs Pro",
      faq: "FAQ",
      joinTestFlight: "Über TestFlight laden"
    },
    hero: {
      headline: "Bike Me ist offen für Betatester",
      subheadline:
        "Finde Fahrer, erstelle Fahrten, lade Radfreunde ein und tracke deine Touren. Hilf uns, Bike Me über TestFlight zu testen.",
      payoffTitle: "12 Monate Pro kostenlos für Betatester",
      payoffText:
        "Als Dankeschön erhalten alle Betatester 12 Monate Bike Me Pro kostenlos, wenn die App offiziell startet. Erfordert ein iPhone und Apples TestFlight-App.",
      primaryCta: "Über TestFlight laden",
      secondaryCta: "So funktioniert's",
      previewLabel: "App-Vorschau"
    },
    brand: {
      intro: "Bike ME ist auf spontane RIDE NOW-Fahrten ausgelegt",
      bullets: [
        "Erstelle in Sekunden eine RIDE NOW-Fahrt",
        "Finde Teilnehmende in deiner Nähe auf der Karte",
        "Lege Treffpunkt und Zeitpunkt fest",
        "Importiere eine GPX-Route (optional)",
        "Erhalte Push-Benachrichtigungen bei wichtigen Änderungen"
      ]
    },
    features: {
      eyebrow: "Funktionen",
      title: "Gruppenfahrten ohne Abstimmungschaos",
      items: [
        {
          title: "Fahrten in deiner Nähe",
          description: "Finde sofort passende Fahrten in einer klaren Kartenansicht."
        },
        {
          title: "Ride Now oder vorausplanen",
          description: "Starte in wenigen Minuten oder plane Touren im Voraus."
        },
        {
          title: "Gezielt Fahrer einladen",
          description: "Lade genau die Leute ein, mit denen du fahren willst."
        },
        {
          title: "GPX-Routen importieren",
          description: "Importiere eine GPX-Datei, damit die Route auf der Karte angezeigt werden kann."
        },
        {
          title: "Intelligente Benachrichtigungen",
          description: "Wenn ein Host ausfällt, werden alle Teilnehmer sofort informiert."
        }
      ]
    },
    howItWorks: {
      eyebrow: "So funktioniert's",
      title: "In drei Schritten von der Karte zur Ausfahrt",
      steps: [
        {
          title: "Karte öffnen und Fahrten sehen",
          description: "Aktive und geplante Fahrten in deiner Umgebung auf einen Blick."
        },
        {
          title: "Ride Now erstellen oder planen",
          description: "Spontan starten oder Termin für später festlegen."
        },
        {
          title: "Fahrer einladen und losfahren",
          description: "Teilnehmer bestätigen und gemeinsam starten."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshots",
      title: "Klarer Ablauf vor, während und nach jeder Ausfahrt",
      subtitle: "Von kostenlosen RIDE NOW-Tools bis zu tieferen Pro-Einblicken, wenn du mehr willst.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Kartenübersicht",
          description: "Finde Fahrer in deiner Nähe und sieh, wer jetzt für eine Tour bereit ist."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "RIDE NOW-Fahrt erstellen",
          description: "Lege Route, Zeit und Treffpunkt in Sekunden fest."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Die Community",
          description: "Finde Fahrer auf deinem Niveau und lade sie zur Tour ein."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Bereit zum Start",
          description: "Sammle die Gruppe und starte Live-Tracking direkt von der Karte."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Fahrtdetails (Pro)",
          description:
            "Tauche in deine Daten ein. Sieh Watt, Trainingszonen und Anstiege nach der Fahrt."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Deine Entwicklung sehen (Pro)",
          description:
            "Verfolge deine Form über die Zeit mit detaillierten Diagrammen und 12-Monats-Historie."
        }
      ]
    },
    pricing: {
      eyebrow: "Kostenlos vs Pro",
      title: "Werde Betatester - erhalte 12 Monate Pro",
      subtitle:
        "Starte kostenlos mit den wichtigsten sozialen Fahrfunktionen. Als Betatester erhältst du 12 Monate Bike ME Pro, wenn die App offiziell startet.",
      plans: [
        {
          name: "Bike ME",
          label: "Kostenlos",
          description: "Karte, RIDE NOW, Fahrer finden, Basis-Routendaten und einfache Historie.",
          items: [
            "Fahrten auf der Karte entdecken",
            "RIDE NOW und geplante Fahrten",
            "Fahrer in deiner Nähe finden",
            "Basis-Routendaten",
            "Einfache Fahrtenhistorie"
          ]
        },
        {
          name: "Bike ME Pro",
          label: "Pro",
          description:
            "Sieh deine Entwicklung. Volle Watt-Schätzung, Trainingszonen (Puls/Watt), erweiterte 12M-Historie und Fortschrittsgrafen.",
          items: [
            "Volle Watt-Schätzung",
            "Trainingszonen für Puls und Watt",
            "Erweiterte 12-Monats-Historie",
            "Fortschritts- und Entwicklungsgrafen",
            "Tiefere Fahrteinblicke"
          ]
        }
      ],
      cta: "Über TestFlight laden"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      items: [
        {
          question: "Ist Bike Me kostenlos?",
          answer:
            "Ja. Die wichtigsten sozialen Funktionen sind kostenlos: Fahrer finden, Fahrten erstellen, andere einladen und deine Touren tracken. Bike ME Pro bietet Zugriff auf tiefere Historie, Status, Watt-Schätzung, Trainingszonen und Fortschrittsgrafen. Als Betatester erhältst du 12 Monate Pro kostenlos, wenn die App offiziell startet."
        },
        {
          question: "Kann ich Bike Me jetzt testen?",
          answer:
            "Ja. Bike Me ist derzeit für iOS-Betatester über TestFlight geöffnet. Alle Betatester erhalten 12 Monate Bike Me Pro kostenlos, wenn die App offiziell startet."
        },
        {
          question: "Wie funktioniert Ride Now?",
          answer: "Mit Ride Now erstellst du eine Fahrt, die bald startet, damit Fahrer in der Nähe schnell beitreten können."
        },
        {
          question: "Kann ich eine Route importieren?",
          answer:
            "Ja. Du kannst eine GPX-Datei importieren, wenn eine geplante Route auf der Karte angezeigt werden soll."
        },
        {
          question: "Wie funktionieren Benachrichtigungen?",
          answer: "Teilnehmer erhalten Push-Benachrichtigungen bei wichtigen Updates, auch wenn ein Host nicht teilnehmen kann."
        }
      ]
    },
    footer: {
      tagline: "Bike Me",
      privacy: "Datenschutz",
      terms: "Nutzungsbedingungen",
      contact: "Kontakt"
    }
  },
  es: {
    meta: {
      title: "Bike Me | Beta en TestFlight",
      description:
        "Bike Me está abierta para beta testers de iPhone vía TestFlight. Los beta testers reciben 12 meses gratis de Bike Me Pro en el lanzamiento oficial."
    },
    nav: {
      features: "Funciones",
      howItWorks: "Cómo funciona",
      screenshots: "Capturas",
      pricing: "Gratis vs Pro",
      faq: "FAQ",
      joinTestFlight: "Obtener vía TestFlight"
    },
    hero: {
      headline: "Bike Me está abierta para beta testers",
      subheadline:
        "Encuentra ciclistas, crea salidas, invita a tus compañeros y registra tus rutas. Ayúdanos a probar Bike Me vía TestFlight.",
      payoffTitle: "12 meses de Pro gratis para beta testers",
      payoffText:
        "Como agradecimiento, todos los beta testers reciben 12 meses gratis de Bike Me Pro cuando la app se lance oficialmente. Requiere iPhone y la app TestFlight de Apple.",
      primaryCta: "Obtener vía TestFlight",
      secondaryCta: "Ver cómo funciona",
      previewLabel: "Vista de la app"
    },
    brand: {
      intro: "Bike ME está pensado para salidas espontáneas RIDE NOW",
      bullets: [
        "Crea una salida RIDE NOW en segundos",
        "Encuentra participantes cerca de ti en el mapa",
        "Acordad punto de encuentro y hora",
        "Importa una ruta GPX (opcional)",
        "Recibe notificaciones push sobre cambios importantes"
      ]
    },
    features: {
      eyebrow: "Funciones",
      title: "Salidas en grupo sin complicaciones",
      items: [
        {
          title: "Ver salidas cerca de ti",
          description: "Descubre rutas y quedadas cercanas al instante con vista de mapa."
        },
        {
          title: "Ride Now o planificar",
          description: "Empieza en minutos o programa una salida para más tarde."
        },
        {
          title: "Invita a quien quieras",
          description: "Elige exactamente con quién quieres rodar."
        },
        {
          title: "Importa rutas GPX",
          description: "Importa un archivo GPX para que la ruta se muestre en el mapa."
        },
        {
          title: "Notificaciones inteligentes",
          description: "Si la persona anfitriona no puede ir, los participantes lo saben al momento."
        }
      ]
    },
    howItWorks: {
      eyebrow: "Cómo funciona",
      title: "Del mapa a la salida en tres pasos",
      steps: [
        {
          title: "Abre el mapa y encuentra salidas",
          description: "Ve salidas activas y planificadas cerca de ti en segundos."
        },
        {
          title: "Crea Ride Now o planifica",
          description: "Lanza una salida inmediata o fija fecha para después."
        },
        {
          title: "Invita y salid a rodar",
          description: "Confirma quién se une y arrancad juntos."
        }
      ]
    },
    screenshots: {
      eyebrow: "Capturas",
      title: "Diseñada para ser clara antes, durante y después de cada salida",
      subtitle: "De herramientas RIDE NOW gratis a información Pro más profunda cuando quieras más.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Vista del mapa",
          description: "Encuentra ciclistas cerca de ti y mira quién está listo para salir ahora."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Crear salida RIDE NOW",
          description: "Define ruta, hora y punto de encuentro en segundos."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "La comunidad",
          description: "Encuentra ciclistas de tu nivel e invítalos a la salida."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Listos para salir",
          description: "Reúne al grupo e inicia el seguimiento en vivo directamente desde el mapa."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Detalles de la salida (Pro)",
          description:
            "Profundiza en tus datos. Consulta vatios, zonas de entrenamiento y subidas después de la salida."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Ve tu evolución (Pro)",
          description:
            "Sigue tu forma a lo largo del tiempo con gráficos detallados e historial de 12 meses."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Hazte beta tester - recibe 12 meses de Pro",
      subtitle:
        "Empieza gratis con las funciones sociales esenciales. Como beta tester, recibes 12 meses de Bike ME Pro cuando la app se lance oficialmente.",
      plans: [
        {
          name: "Bike ME",
          label: "Gratis",
          description: "Mapa, RIDE NOW, encontrar ciclistas, datos básicos de ruta e historial simple.",
          items: [
            "Descubre salidas en el mapa",
            "RIDE NOW y salidas planificadas",
            "Encuentra ciclistas cerca",
            "Datos básicos de ruta",
            "Historial simple"
          ]
        },
        {
          name: "Bike ME Pro",
          label: "Pro",
          description:
            "Ve tu evolución. Estimación completa de vatios, zonas de entrenamiento (pulso/vatios), historial avanzado de 12M y gráficas de progreso.",
          items: [
            "Estimación completa de vatios",
            "Zonas de pulso y vatios",
            "Historial avanzado de 12 meses",
            "Gráficas de progreso",
            "Insights más profundos"
          ]
        }
      ],
      cta: "Obtener vía TestFlight"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Preguntas frecuentes",
      items: [
        {
          question: "¿Bike Me es gratis?",
          answer:
            "Sí. Las funciones sociales clave son gratis: encuentra ciclistas, crea salidas, invita a otros y registra tus rutas. Bike ME Pro da acceso a más historial, estado, estimación de vatios, zonas de entrenamiento y gráficas de progreso. Como beta tester, recibes 12 meses gratis de Pro cuando la app se lance oficialmente."
        },
        {
          question: "¿Puedo probar Bike Me ahora?",
          answer:
            "Sí. Bike Me está abierta ahora para beta testers de iOS vía TestFlight. Todos los beta testers reciben 12 meses gratis de Bike Me Pro cuando la app se lance oficialmente."
        },
        {
          question: "¿Cómo funciona Ride Now?",
          answer: "Ride Now te permite crear una salida que empieza pronto para que ciclistas cercanos se unan rápido."
        },
        {
          question: "¿Puedo importar una ruta?",
          answer:
            "Sí. Puedes importar un archivo GPX si quieres ver una ruta planificada en el mapa."
        },
        {
          question: "¿Cómo funcionan las notificaciones?",
          answer: "Los participantes reciben notificaciones push con cambios importantes, incluso si la persona anfitriona no puede asistir."
        }
      ]
    },
    footer: {
      tagline: "Bike Me",
      privacy: "Privacidad",
      terms: "Términos",
      contact: "Contacto"
    }
  },
  it: {
    meta: {
      title: "Bike Me | Beta su TestFlight",
      description:
        "Bike Me è aperta ai beta tester iPhone tramite TestFlight. I beta tester ricevono 12 mesi gratuiti di Bike Me Pro al lancio ufficiale."
    },
    nav: {
      features: "Funzionalità",
      howItWorks: "Come funziona",
      screenshots: "Screenshot",
      pricing: "Gratis vs Pro",
      faq: "FAQ",
      joinTestFlight: "Scarica via TestFlight"
    },
    hero: {
      headline: "Bike Me è aperta ai beta tester",
      subheadline:
        "Trova ciclisti, crea uscite, invita amici e traccia le tue pedalate. Aiutaci a testare Bike Me tramite TestFlight.",
      payoffTitle: "12 mesi di Pro gratis per i beta tester",
      payoffText:
        "Come ringraziamento, tutti i beta tester ricevono 12 mesi gratuiti di Bike Me Pro quando l'app verrà lanciata ufficialmente. Richiede iPhone e l'app TestFlight di Apple.",
      primaryCta: "Scarica via TestFlight",
      secondaryCta: "Scopri come funziona",
      previewLabel: "Anteprima app"
    },
    brand: {
      intro: "Bike ME nasce per le uscite spontanee RIDE NOW",
      bullets: [
        "Crea un'uscita RIDE NOW in pochi secondi",
        "Trova partecipanti vicino a te sulla mappa",
        "Concorda punto di ritrovo e orario",
        "Importa un percorso GPX (opzionale)",
        "Ricevi notifiche push per i cambiamenti importanti"
      ]
    },
    features: {
      eyebrow: "Funzionalità",
      title: "Uscite di gruppo senza confusione",
      items: [
        {
          title: "Vedi uscite vicino a te",
          description: "Scopri subito le uscite in zona con una vista mappa chiara."
        },
        {
          title: "Ride Now o pianifica",
          description: "Parti in pochi minuti oppure programma un'uscita in anticipo."
        },
        {
          title: "Invita i ciclisti giusti",
          description: "Scegli esattamente chi vuoi con te nel gruppo."
        },
        {
          title: "Importa percorsi GPX",
          description: "Importa un file GPX per mostrare il percorso sulla mappa."
        },
        {
          title: "Notifiche intelligenti",
          description: "Se l'host non può più venire, i partecipanti vengono avvisati subito."
        }
      ]
    },
    howItWorks: {
      eyebrow: "Come funziona",
      title: "Dalla mappa alla partenza in tre passi",
      steps: [
        {
          title: "Apri la mappa e trova uscite",
          description: "Vedi in pochi secondi le uscite attive e quelle pianificate vicino a te."
        },
        {
          title: "Crea Ride Now o pianifica",
          description: "Organizza qualcosa di immediato o imposta una data futura."
        },
        {
          title: "Invita e parti",
          description: "Conferma chi partecipa e uscite insieme."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshot",
      title: "Progettata per restare chiara prima, durante e dopo l'uscita",
      subtitle: "Dagli strumenti RIDE NOW gratis agli insight Pro più profondi quando vuoi di più.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Panoramica mappa",
          description: "Trova ciclisti vicino a te e vedi chi è pronto per uscire ora."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Crea uscita RIDE NOW",
          description: "Imposta percorso, orario e punto di ritrovo in pochi secondi."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "La community",
          description: "Trova ciclisti del tuo livello e invitali all'uscita."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Pronti a partire",
          description: "Riunisci il gruppo e avvia il live tracking direttamente dalla mappa."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Dettagli uscita (Pro)",
          description:
            "Entra nei tuoi dati. Vedi watt, zone di allenamento e salite dopo l'uscita."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Guarda i tuoi progressi (Pro)",
          description:
            "Segui la tua forma nel tempo con grafici dettagliati e storico di 12 mesi."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Diventa beta tester - ricevi 12 mesi di Pro",
      subtitle:
        "Inizia gratis con le funzioni social essenziali. Come beta tester ricevi 12 mesi di Bike ME Pro quando l'app verrà lanciata ufficialmente.",
      plans: [
        {
          name: "Bike ME",
          label: "Gratis",
          description: "Mappa, RIDE NOW, trova ciclisti, dati base del percorso e storico semplice.",
          items: [
            "Scopri uscite sulla mappa",
            "RIDE NOW e uscite pianificate",
            "Trova ciclisti vicini",
            "Dati base del percorso",
            "Storico semplice"
          ]
        },
        {
          name: "Bike ME Pro",
          label: "Pro",
          description:
            "Vedi la tua evoluzione. Stima completa dei watt, zone di allenamento (frequenza cardiaca/watt), storico avanzato 12M e grafici di progresso.",
          items: [
            "Stima completa dei watt",
            "Zone cardio e watt",
            "Storico avanzato di 12 mesi",
            "Grafici di progresso",
            "Insight più dettagliati"
          ]
        }
      ],
      cta: "Scarica via TestFlight"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Domande frequenti",
      items: [
        {
          question: "Bike Me è gratuita?",
          answer:
            "Sì. Le funzioni social principali sono gratuite: trova ciclisti, crea uscite, invita altri e traccia le tue pedalate. Bike ME Pro dà accesso a storico più profondo, stato, stima dei watt, zone di allenamento e grafici di progresso. Come beta tester ricevi 12 mesi gratuiti di Pro quando l'app verrà lanciata ufficialmente."
        },
        {
          question: "Posso testare Bike Me ora?",
          answer:
            "Sì. Bike Me è attualmente aperta ai beta tester iOS tramite TestFlight. Tutti i beta tester ricevono 12 mesi gratuiti di Bike Me Pro quando l'app verrà lanciata ufficialmente."
        },
        {
          question: "Come funziona Ride Now?",
          answer: "Ride Now ti permette di creare un'uscita che parte a breve, così i ciclisti vicini possono unirsi rapidamente."
        },
        {
          question: "Posso importare un percorso?",
          answer:
            "Sì. Puoi importare un file GPX se vuoi visualizzare un percorso pianificato sulla mappa."
        },
        {
          question: "Come funzionano le notifiche?",
          answer: "I partecipanti ricevono notifiche push per aggiornamenti importanti, incluso quando l'host non può più partecipare."
        }
      ]
    },
    footer: {
      tagline: "Bike Me",
      privacy: "Privacy",
      terms: "Termini",
      contact: "Contatti"
    }
  },
  fr: {
    meta: {
      title: "Bike Me | Bêta sur TestFlight",
      description:
        "Bike Me est ouverte aux bêta-testeurs iPhone via TestFlight. Les bêta-testeurs reçoivent 12 mois gratuits de Bike Me Pro au lancement officiel."
    },
    nav: {
      features: "Fonctionnalités",
      howItWorks: "Comment ça marche",
      screenshots: "Captures",
      pricing: "Gratuit vs Pro",
      faq: "FAQ",
      joinTestFlight: "Obtenir via TestFlight"
    },
    hero: {
      headline: "Bike Me est ouverte aux bêta-testeurs",
      subheadline:
        "Trouvez des cyclistes, créez des sorties, invitez vos amis et suivez vos parcours. Aidez-nous à tester Bike Me via TestFlight.",
      payoffTitle: "12 mois de Pro gratuits pour les bêta-testeurs",
      payoffText:
        "En remerciement, tous les bêta-testeurs reçoivent 12 mois gratuits de Bike Me Pro lorsque l'app sera lancée officiellement. Nécessite un iPhone et l'app TestFlight d'Apple.",
      primaryCta: "Obtenir via TestFlight",
      secondaryCta: "Voir le fonctionnement",
      previewLabel: "Aperçu de l'app"
    },
    brand: {
      intro: "Bike ME est conçu pour les sorties spontanées RIDE NOW",
      bullets: [
        "Créez une sortie RIDE NOW en quelques secondes",
        "Trouvez des participants proches de vous sur la carte",
        "Fixez le lieu et l'heure de rendez-vous",
        "Importez un itinéraire GPX (optionnel)",
        "Recevez des notifications push en cas de changement important"
      ]
    },
    features: {
      eyebrow: "Fonctionnalités",
      title: "Les sorties de groupe, sans friction",
      items: [
        {
          title: "Voir les sorties près de vous",
          description: "Repérez instantanément les sorties autour de vous avec une vue carte claire."
        },
        {
          title: "Ride Now ou planification",
          description: "Lancez une sortie rapidement ou planifiez-la à l'avance."
        },
        {
          title: "Invitez les bons cyclistes",
          description: "Choisissez précisément qui vous voulez inviter."
        },
        {
          title: "Importez des itinéraires GPX",
          description: "Importez un fichier GPX pour afficher l'itinéraire sur la carte."
        },
        {
          title: "Notifications intelligentes",
          description: "Si l'hôte ne peut plus venir, les participants sont prévenus immédiatement."
        }
      ]
    },
    howItWorks: {
      eyebrow: "Comment ça marche",
      title: "De la carte au départ en trois étapes",
      steps: [
        {
          title: "Ouvrez la carte et repérez les sorties",
          description: "Visualisez en quelques secondes les sorties en cours et à venir près de vous."
        },
        {
          title: "Créez un Ride Now ou planifiez",
          description: "Organisez une sortie immédiate ou fixez une date plus tard."
        },
        {
          title: "Invitez et partez rouler",
          description: "Confirmez les participants et partez ensemble."
        }
      ]
    },
    screenshots: {
      eyebrow: "Captures",
      title: "Pensée pour rester claire avant, pendant et après chaque sortie",
      subtitle: "Des outils RIDE NOW gratuits aux analyses Pro plus poussées quand vous voulez aller plus loin.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Vue carte",
          description: "Trouvez des cyclistes près de vous et voyez qui est prêt à rouler maintenant."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Créer une sortie RIDE NOW",
          description: "Définissez un itinéraire, une heure et un lieu de rendez-vous en quelques secondes."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "La communauté",
          description: "Trouvez des cyclistes à votre niveau et invitez-les à la sortie."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Prêt à partir",
          description: "Rassemblez le groupe et lancez le suivi en direct depuis la carte."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Détails de sortie (Pro)",
          description:
            "Plongez dans vos données. Consultez watts, zones d'entraînement et ascensions après la sortie."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Suivez votre progression (Pro)",
          description:
            "Suivez votre forme dans le temps avec des graphiques détaillés et un historique sur 12 mois."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratuit vs Pro",
      title: "Devenez bêta-testeur - recevez 12 mois de Pro",
      subtitle:
        "Commencez gratuitement avec les outils sociaux essentiels. En tant que bêta-testeur, vous recevez 12 mois de Bike ME Pro lorsque l'app sera lancée officiellement.",
      plans: [
        {
          name: "Bike ME",
          label: "Gratuit",
          description: "Carte, RIDE NOW, trouver des cyclistes, données de base et historique simple.",
          items: [
            "Découverte des sorties sur la carte",
            "RIDE NOW et sorties planifiées",
            "Trouver des cyclistes proches",
            "Données de base",
            "Historique simple"
          ]
        },
        {
          name: "Bike ME Pro",
          label: "Pro",
          description:
            "Suivez votre progression. Estimation complète des watts, zones d'entraînement (fréquence cardiaque/watts), historique avancé 12M et graphiques de progression.",
          items: [
            "Estimation complète des watts",
            "Zones cardio et watts",
            "Historique avancé sur 12 mois",
            "Graphiques de progression",
            "Analyses plus détaillées"
          ]
        }
      ],
      cta: "Obtenir via TestFlight"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions fréquentes",
      items: [
        {
          question: "Bike Me est-elle gratuite ?",
          answer:
            "Oui. Les fonctions sociales clés sont gratuites : trouver des cyclistes, créer des sorties, inviter d'autres personnes et suivre vos sorties. Bike ME Pro donne accès à un historique plus profond, au statut, à l'estimation des watts, aux zones d'entraînement et aux graphiques de progression. En tant que bêta-testeur, vous recevez 12 mois gratuits de Pro lorsque l'app sera lancée officiellement."
        },
        {
          question: "Puis-je tester Bike Me maintenant ?",
          answer:
            "Oui. Bike Me est actuellement ouverte aux bêta-testeurs iOS via TestFlight. Tous les bêta-testeurs reçoivent 12 mois gratuits de Bike Me Pro lorsque l'app sera lancée officiellement."
        },
        {
          question: "Comment fonctionne Ride Now ?",
          answer: "Ride Now vous permet de créer une sortie qui démarre bientôt pour que les cyclistes proches puissent rejoindre rapidement."
        },
        {
          question: "Puis-je importer un itinéraire ?",
          answer:
            "Oui. Vous pouvez importer un fichier GPX si vous souhaitez afficher un itinéraire planifié sur la carte."
        },
        {
          question: "Comment fonctionnent les notifications ?",
          answer: "Les participants reçoivent des notifications push pour les mises à jour importantes, y compris si l'hôte ne peut plus participer."
        }
      ]
    },
    footer: {
      tagline: "Bike Me",
      privacy: "Confidentialité",
      terms: "Conditions",
      contact: "Contact"
    }
  },
  nl: {
    meta: {
      title: "Bike Me | Beta via TestFlight",
      description:
        "Bike Me is open voor iPhone-betatesters via TestFlight. Betatesters krijgen 12 maanden gratis Bike Me Pro bij de officiële lancering."
    },
    nav: {
      features: "Functies",
      howItWorks: "Hoe het werkt",
      screenshots: "Screenshots",
      pricing: "Gratis vs Pro",
      faq: "FAQ",
      joinTestFlight: "Download via TestFlight"
    },
    hero: {
      headline: "Bike Me is open voor betatesters",
      subheadline:
        "Vind fietsers, maak ritten, nodig fietsvrienden uit en track je ritten. Help ons Bike Me te testen via TestFlight.",
      payoffTitle: "12 maanden gratis Pro voor betatesters",
      payoffText:
        "Als bedankje krijgen alle betatesters 12 maanden gratis Bike Me Pro wanneer de app officieel wordt gelanceerd. Vereist iPhone en Apple's TestFlight-app.",
      primaryCta: "Download via TestFlight",
      secondaryCta: "Bekijk hoe het werkt",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike ME is gebouwd voor spontane RIDE NOW-ritten",
      bullets: [
        "Maak in een paar seconden een RIDE NOW-rit",
        "Vind deelnemers bij jou in de buurt op de kaart",
        "Spreek af waar en wanneer jullie vertrekken",
        "Importeer een GPX-route (optioneel)",
        "Ontvang pushmeldingen bij belangrijke wijzigingen"
      ]
    },
    features: {
      eyebrow: "Functies",
      title: "Groepsritten zonder gedoe",
      items: [
        {
          title: "Zie ritten bij jou in de buurt",
          description: "Ontdek direct ritten in de buurt met een overzichtelijke kaartweergave."
        },
        {
          title: "Ride Now of vooruit plannen",
          description: "Start binnen enkele minuten of plan een rit voor later."
        },
        {
          title: "Nodig de juiste fietsers uit",
          description: "Kies precies wie je wilt uitnodigen voor de rit."
        },
        {
          title: "Importeer GPX-routes",
          description: "Importeer een GPX-bestand zodat de route op de kaart kan worden getoond."
        },
        {
          title: "Slimme meldingen",
          description: "Als een host niet kan, krijgen deelnemers meteen een update."
        }
      ]
    },
    howItWorks: {
      eyebrow: "Hoe het werkt",
      title: "Van kaart naar vertrek in drie stappen",
      steps: [
        {
          title: "Open de kaart en spot ritten",
          description: "Bekijk actieve en geplande ritten in jouw omgeving in seconden."
        },
        {
          title: "Maak Ride Now of plan een rit",
          description: "Organiseer iets direct of prik een moment voor later."
        },
        {
          title: "Nodig uit en vertrek",
          description: "Bevestig wie meegaat en rijd samen weg."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshots",
      title: "Ontworpen om helder te blijven voor, tijdens en na elke rit",
      subtitle: "Van gratis RIDE NOW-tools tot diepere Pro-inzichten wanneer je meer wilt.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Kaartoverzicht",
          description: "Vind fietsers bij jou in de buurt en zie wie nu klaar is voor een rit."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Maak RIDE NOW-rit",
          description: "Stel route, tijd en ontmoetingsplek in binnen enkele seconden."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "De community",
          description: "Vind fietsers op jouw niveau en nodig ze uit voor de rit."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Klaar voor vertrek",
          description: "Verzamel de groep en start live tracking direct vanaf de kaart."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Ritdetails (Pro)",
          description: "Duik in je data. Bekijk watt, trainingszones en beklimmingen na de rit."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Bekijk je ontwikkeling (Pro)",
          description:
            "Volg je vorm in de tijd met gedetailleerde grafieken en 12 maanden historie."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Word betatester - krijg 12 maanden Pro",
      subtitle:
        "Begin gratis met de belangrijkste sociale ritfuncties. Als betatester krijg je 12 maanden Bike ME Pro wanneer de app officieel wordt gelanceerd.",
      plans: [
        {
          name: "Bike ME",
          label: "Gratis",
          description: "Kaart, RIDE NOW, fietsers vinden, basis routegegevens en eenvoudige historie.",
          items: [
            "Ritten ontdekken op de kaart",
            "RIDE NOW en geplande ritten",
            "Fietsers in de buurt vinden",
            "Basis routegegevens",
            "Eenvoudige historie"
          ]
        },
        {
          name: "Bike ME Pro",
          label: "Pro",
          description:
            "Zie je ontwikkeling. Volledige wattinschatting, trainingszones (hartslag/watt), geavanceerde 12M historie en voortgangsgrafieken.",
          items: [
            "Volledige wattinschatting",
            "Hartslag- en wattzones",
            "Geavanceerde 12-maandenhistorie",
            "Voortgangsgrafieken",
            "Diepere ritinzichten"
          ]
        }
      ],
      cta: "Download via TestFlight"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Veelgestelde vragen",
      items: [
        {
          question: "Is Bike Me gratis?",
          answer:
            "Ja. De belangrijkste sociale functies zijn gratis: vind fietsers, maak ritten, nodig anderen uit en track je ritten. Bike ME Pro geeft toegang tot diepere historie, status, wattinschatting, trainingszones en voortgangsgrafieken. Als betatester krijg je 12 maanden gratis Pro wanneer de app officieel wordt gelanceerd."
        },
        {
          question: "Kan ik Bike Me nu testen?",
          answer:
            "Ja. Bike Me is momenteel open voor iOS-betatesters via TestFlight. Alle betatesters krijgen 12 maanden gratis Bike Me Pro wanneer de app officieel wordt gelanceerd."
        },
        {
          question: "Hoe werkt Ride Now?",
          answer: "Met Ride Now maak je een rit die snel start, zodat fietsers in de buurt direct kunnen aansluiten."
        },
        {
          question: "Kan ik een route importeren?",
          answer:
            "Ja. Je kunt een GPX-bestand importeren als je een geplande route op de kaart wilt weergeven."
        },
        {
          question: "Hoe werken meldingen?",
          answer: "Deelnemers krijgen pushmeldingen bij belangrijke updates, ook wanneer een host niet meer kan."
        }
      ]
    },
    footer: {
      tagline: "Bike Me",
      privacy: "Privacy",
      terms: "Voorwaarden",
      contact: "Contact"
    }
  }
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
