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

export type Dictionary = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    features: string;
    howItWorks: string;
    screenshots: string;
    faq: string;
    joinTestFlight: string;
  };
  hero: {
    headline: string;
    subheadline: string;
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
    items: string[];
    replaceHint: string;
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
      title: "Bike Me | Find rides. Join fast. Ride together.",
      description:
        "Bike Me helps cyclists discover nearby rides, create Ride Now meetups, and plan future rides - all from the map."
    },
    nav: {
      features: "Features",
      howItWorks: "How it works",
      screenshots: "Screenshots",
      faq: "FAQ",
      joinTestFlight: "Join TestFlight"
    },
    hero: {
      headline: "Find nogen at køre med her og nu med Bike ME",
      subheadline:
        "Bike ME makes it easy to find riders right now. Create a RIDE NOW ride in seconds, or plan a ride for later.",
      primaryCta: "Join TestFlight",
      secondaryCta: "See how it works",
      previewLabel: "App preview"
    },
    brand: {
      intro: "Bike ME is built around spontaneous RIDE NOW rides",
      bullets: [
        "Create a RIDE NOW ride in seconds",
        "Find nearby riders on the map",
        "Agree on meeting point and time",
        "Add a Strava route (optional)",
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
          title: "Add Strava routes",
          description: "Attach a route link and open it directly from ride details."
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
      subtitle: "Drop your real app screenshots into the slots below when ready.",
      items: [
        "Map discovery",
        "Ride details",
        "Ride Now creation",
        "Invite riders",
        "Route link",
        "Notifications"
      ],
      replaceHint: "Replace with /public/screenshots/shot-{n}.png"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions",
      items: [
        {
          question: "Is Bike Me free?",
          answer: "Bike Me is currently in testing. Pricing will be shared before public launch."
        },
        {
          question: "Is it available on iOS/Android?",
          answer: "Bike Me is currently available via iOS TestFlight. Android availability will be announced later."
        },
        {
          question: "How does Ride Now work?",
          answer: "Ride Now lets you create a ride that starts soon so nearby cyclists can join quickly."
        },
        {
          question: "Can I add a Strava route?",
          answer: "Yes. Add a Strava route link when creating or editing a ride and open it from ride details."
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
      title: "Bike Me | Find ture. Kom hurtigt med. Kør sammen.",
      description:
        "Bike Me hjælper cyklister med at finde ture i nærheden, oprette 'Ride Now'-ture og planlægge fremtidige ture - direkte fra kortet."
    },
    nav: {
      features: "Funktioner",
      howItWorks: "Sådan virker det",
      screenshots: "Skærmbilleder",
      faq: "FAQ",
      joinTestFlight: "Join TestFlight"
    },
    hero: {
      headline: "Find nogen at køre med her og nu med Bike ME",
      subheadline:
        "Bike ME gør det nemt at finde andre at køre med – her og nu. Opret en KØR NU-tur på få sekunder, eller planlæg en tur til senere.",
      primaryCta: "Join TestFlight",
      secondaryCta: "Se hvordan det virker",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike ME er skabt til spontane KØR NU-ture",
      bullets: [
        "Opret en KØR NU-tur på få sekunder",
        "Find deltagere tæt på dig på kortet",
        "Aftal mødested og tidspunkt",
        "Tilføj Strava-rute (valgfrit)",
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
          title: "Tilføj Strava-ruter",
          description: "Vedhæft et rutelink og åbn det direkte fra turdetaljer."
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
      subtitle: "Udskift felterne herunder med rigtige app-skærmbilleder.",
      items: [
        "Kortoversigt",
        "Turdetaljer",
        "Ride Now-oprettelse",
        "Invitationer",
        "Rutelink",
        "Notifikationer"
      ],
      replaceHint: "Udskift med /public/screenshots/shot-{n}.png"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Ofte stillede spørgsmål",
      items: [
        {
          question: "Er Bike Me gratis?",
          answer: "Bike Me er i testfasen. Pris bliver meldt ud inden offentlig lancering."
        },
        {
          question: "Er den tilgængelig på iOS/Android?",
          answer: "Bike Me er lige nu tilgængelig via iOS TestFlight. Android kommer senere."
        },
        {
          question: "Hvordan virker Ride Now?",
          answer: "Ride Now lader dig oprette en tur, der starter snart, så ryttere i nærheden hurtigt kan deltage."
        },
        {
          question: "Kan jeg tilføje en Strava-rute?",
          answer: "Ja. Tilføj et Strava-link ved oprettelse eller redigering af turen, og åbn det fra turdetaljer."
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
      title: "Bike Me | Fahrten finden. Schnell beitreten. Gemeinsam fahren.",
      description:
        "Bike Me hilft Radfahrern, Fahrten in der Nähe zu entdecken, 'Ride Now'-Treffen zu erstellen und zukünftige Fahrten direkt auf der Karte zu planen."
    },
    nav: {
      features: "Funktionen",
      howItWorks: "So funktioniert's",
      screenshots: "Screenshots",
      faq: "FAQ",
      joinTestFlight: "Join TestFlight"
    },
    hero: {
      headline: "Find nogen at køre med her og nu med Bike ME",
      subheadline:
        "Mit Bike ME findest du ganz einfach andere zum Fahren – hier und jetzt. Erstelle in Sekunden eine RIDE NOW-Fahrt oder plane eine Fahrt für später.",
      primaryCta: "Join TestFlight",
      secondaryCta: "So funktioniert's",
      previewLabel: "App-Vorschau"
    },
    brand: {
      intro: "Bike ME ist auf spontane RIDE NOW-Fahrten ausgelegt",
      bullets: [
        "Erstelle in Sekunden eine RIDE NOW-Fahrt",
        "Finde Teilnehmende in deiner Nähe auf der Karte",
        "Lege Treffpunkt und Zeitpunkt fest",
        "Füge eine Strava-Route hinzu (optional)",
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
          title: "Strava-Routen hinzufügen",
          description: "Hänge einen Strava-Link an und öffne ihn direkt aus den Fahrtdetails."
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
      subtitle: "Ersetze die Platzhalter später durch echte App-Screenshots.",
      items: [
        "Kartenansicht",
        "Fahrtdetails",
        "Ride Now erstellen",
        "Einladungen",
        "Routenlink",
        "Benachrichtigungen"
      ],
      replaceHint: "Ersetzen mit /public/screenshots/shot-{n}.png"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      items: [
        {
          question: "Ist Bike Me kostenlos?",
          answer: "Bike Me befindet sich aktuell im Test. Preisdetails folgen vor dem öffentlichen Start."
        },
        {
          question: "Gibt es Bike Me für iOS/Android?",
          answer: "Derzeit ist Bike Me über iOS TestFlight verfügbar. Android folgt später."
        },
        {
          question: "Wie funktioniert Ride Now?",
          answer: "Mit Ride Now erstellst du eine Fahrt, die bald startet, damit Fahrer in der Nähe schnell beitreten können."
        },
        {
          question: "Kann ich eine Strava-Route hinzufügen?",
          answer: "Ja. Du kannst beim Erstellen oder Bearbeiten einen Strava-Link hinzufügen und in den Fahrtdetails öffnen."
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
      title: "Bike Me | Encuentra salidas. Únete rápido. Rodad juntos.",
      description:
        "Bike Me ayuda a ciclistas a descubrir salidas cercanas, crear encuentros 'Ride Now' y planificar salidas futuras, todo desde el mapa."
    },
    nav: {
      features: "Funciones",
      howItWorks: "Cómo funciona",
      screenshots: "Capturas",
      faq: "FAQ",
      joinTestFlight: "Join TestFlight"
    },
    hero: {
      headline: "Find nogen at køre med her og nu med Bike ME",
      subheadline:
        "Bike ME te lo pone fácil para encontrar con quién rodar aquí y ahora. Crea una salida RIDE NOW en segundos o planifica una salida para más tarde.",
      primaryCta: "Join TestFlight",
      secondaryCta: "Ver cómo funciona",
      previewLabel: "Vista de la app"
    },
    brand: {
      intro: "Bike ME está pensado para salidas espontáneas RIDE NOW",
      bullets: [
        "Crea una salida RIDE NOW en segundos",
        "Encuentra participantes cerca de ti en el mapa",
        "Acordad punto de encuentro y hora",
        "Añade una ruta de Strava (opcional)",
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
          title: "Añade rutas de Strava",
          description: "Incluye un enlace y ábrelo directamente desde los detalles."
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
      subtitle: "Sustituye estas tarjetas por capturas reales cuando quieras.",
      items: [
        "Mapa",
        "Detalles de salida",
        "Crear Ride Now",
        "Invitaciones",
        "Enlace de ruta",
        "Notificaciones"
      ],
      replaceHint: "Sustituir por /public/screenshots/shot-{n}.png"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Preguntas frecuentes",
      items: [
        {
          question: "¿Bike Me es gratis?",
          answer: "Bike Me está en fase de pruebas. Compartiremos precios antes del lanzamiento público."
        },
        {
          question: "¿Está disponible en iOS/Android?",
          answer: "Ahora mismo Bike Me está disponible en iOS mediante TestFlight. Android llegará más adelante."
        },
        {
          question: "¿Cómo funciona Ride Now?",
          answer: "Ride Now te permite crear una salida que empieza pronto para que ciclistas cercanos se unan rápido."
        },
        {
          question: "¿Puedo añadir una ruta de Strava?",
          answer: "Sí. Puedes añadir un enlace de Strava al crear o editar la salida y abrirlo desde los detalles."
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
      title: "Bike Me | Trova uscite. Unisciti subito. Pedala insieme.",
      description:
        "Bike Me aiuta i ciclisti a trovare uscite vicine, creare incontri 'Ride Now' e pianificare uscite future direttamente dalla mappa."
    },
    nav: {
      features: "Funzionalità",
      howItWorks: "Come funziona",
      screenshots: "Screenshot",
      faq: "FAQ",
      joinTestFlight: "Join TestFlight"
    },
    hero: {
      headline: "Find nogen at køre med her og nu med Bike ME",
      subheadline:
        "Bike ME rende facile trovare altri ciclisti con cui uscire, qui e ora. Crea in pochi secondi un'uscita RIDE NOW oppure pianifica un'uscita per dopo.",
      primaryCta: "Join TestFlight",
      secondaryCta: "Scopri come funziona",
      previewLabel: "Anteprima app"
    },
    brand: {
      intro: "Bike ME nasce per le uscite spontanee RIDE NOW",
      bullets: [
        "Crea un'uscita RIDE NOW in pochi secondi",
        "Trova partecipanti vicino a te sulla mappa",
        "Concorda punto di ritrovo e orario",
        "Aggiungi un percorso Strava (opzionale)",
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
          title: "Aggiungi percorsi Strava",
          description: "Inserisci un link al percorso e aprilo direttamente dai dettagli."
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
      subtitle: "Sostituisci questi segnaposto con screenshot reali quando vuoi.",
      items: [
        "Mappa",
        "Dettagli uscita",
        "Creazione Ride Now",
        "Inviti",
        "Link percorso",
        "Notifiche"
      ],
      replaceHint: "Sostituisci con /public/screenshots/shot-{n}.png"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Domande frequenti",
      items: [
        {
          question: "Bike Me è gratuita?",
          answer: "Bike Me è attualmente in test. I dettagli sui prezzi saranno condivisi prima del lancio pubblico."
        },
        {
          question: "È disponibile su iOS/Android?",
          answer: "Al momento Bike Me è disponibile su iOS tramite TestFlight. Android arriverà più avanti."
        },
        {
          question: "Come funziona Ride Now?",
          answer: "Ride Now ti permette di creare un'uscita che parte a breve, così i ciclisti vicini possono unirsi rapidamente."
        },
        {
          question: "Posso aggiungere un percorso Strava?",
          answer: "Sì. Aggiungi un link Strava quando crei o modifichi l'uscita e aprilo dai dettagli."
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
      title: "Bike Me | Trouvez des sorties. Rejoignez vite. Roulez ensemble.",
      description:
        "Bike Me aide les cyclistes à trouver des sorties proches, créer des sorties 'Ride Now' et planifier des sorties futures, directement depuis la carte."
    },
    nav: {
      features: "Fonctionnalités",
      howItWorks: "Comment ça marche",
      screenshots: "Captures",
      faq: "FAQ",
      joinTestFlight: "Join TestFlight"
    },
    hero: {
      headline: "Find nogen at køre med her og nu med Bike ME",
      subheadline:
        "Bike ME facilite la recherche de cyclistes avec qui rouler, ici et maintenant. Créez une sortie RIDE NOW en quelques secondes ou planifiez une sortie plus tard.",
      primaryCta: "Join TestFlight",
      secondaryCta: "Voir le fonctionnement",
      previewLabel: "Aperçu de l'app"
    },
    brand: {
      intro: "Bike ME est conçu pour les sorties spontanées RIDE NOW",
      bullets: [
        "Créez une sortie RIDE NOW en quelques secondes",
        "Trouvez des participants proches de vous sur la carte",
        "Fixez le lieu et l'heure de rendez-vous",
        "Ajoutez un itinéraire Strava (optionnel)",
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
          title: "Ajoutez des itinéraires Strava",
          description: "Ajoutez un lien d'itinéraire et ouvrez-le depuis les détails de la sortie."
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
      subtitle: "Remplacez ces emplacements par vos captures réelles quand vous voulez.",
      items: [
        "Carte",
        "Détails sortie",
        "Création Ride Now",
        "Invitations",
        "Lien itinéraire",
        "Notifications"
      ],
      replaceHint: "Remplacer par /public/screenshots/shot-{n}.png"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions fréquentes",
      items: [
        {
          question: "Bike Me est-elle gratuite ?",
          answer: "Bike Me est actuellement en phase de test. Les tarifs seront communiqués avant le lancement public."
        },
        {
          question: "Disponible sur iOS/Android ?",
          answer: "Bike Me est disponible pour l'instant sur iOS via TestFlight. Android sera annoncé plus tard."
        },
        {
          question: "Comment fonctionne Ride Now ?",
          answer: "Ride Now vous permet de créer une sortie qui démarre bientôt pour que les cyclistes proches puissent rejoindre rapidement."
        },
        {
          question: "Puis-je ajouter un itinéraire Strava ?",
          answer: "Oui. Ajoutez un lien Strava lors de la création ou modification d'une sortie et ouvrez-le depuis les détails."
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
      title: "Bike Me | Vind ritten. Sluit snel aan. Rijd samen.",
      description:
        "Bike Me helpt fietsers ritten in de buurt te vinden, 'Ride Now'-meetups te maken en toekomstige ritten te plannen, allemaal vanaf de kaart."
    },
    nav: {
      features: "Functies",
      howItWorks: "Hoe het werkt",
      screenshots: "Screenshots",
      faq: "FAQ",
      joinTestFlight: "Join TestFlight"
    },
    hero: {
      headline: "Find nogen at køre med her og nu med Bike ME",
      subheadline:
        "Bike ME maakt het makkelijk om hier en nu iemand te vinden om mee te rijden. Maak in een paar seconden een RIDE NOW-rit of plan een rit voor later.",
      primaryCta: "Join TestFlight",
      secondaryCta: "Bekijk hoe het werkt",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike ME is gebouwd voor spontane RIDE NOW-ritten",
      bullets: [
        "Maak in een paar seconden een RIDE NOW-rit",
        "Vind deelnemers bij jou in de buurt op de kaart",
        "Spreek af waar en wanneer jullie vertrekken",
        "Voeg een Strava-route toe (optioneel)",
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
          title: "Strava-routes toevoegen",
          description: "Voeg een routelink toe en open die direct vanuit de ritdetails."
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
      subtitle: "Vervang deze placeholders later met echte app-screenshots.",
      items: [
        "Kaart",
        "Ritdetails",
        "Ride Now maken",
        "Uitnodigingen",
        "Routelink",
        "Meldingen"
      ],
      replaceHint: "Vervang door /public/screenshots/shot-{n}.png"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Veelgestelde vragen",
      items: [
        {
          question: "Is Bike Me gratis?",
          answer: "Bike Me zit momenteel in de testfase. Prijsinformatie volgt voor de publieke lancering."
        },
        {
          question: "Is het beschikbaar op iOS/Android?",
          answer: "Bike Me is nu beschikbaar via iOS TestFlight. Android volgt later."
        },
        {
          question: "Hoe werkt Ride Now?",
          answer: "Met Ride Now maak je een rit die snel start, zodat fietsers in de buurt direct kunnen aansluiten."
        },
        {
          question: "Kan ik een Strava-route toevoegen?",
          answer: "Ja. Voeg een Strava-link toe bij het maken of bewerken van een rit en open die vanuit de ritdetails."
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
