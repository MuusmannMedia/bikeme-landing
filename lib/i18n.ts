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

type LaunchSection = {
  eyebrow: string;
  title: string;
  text: string;
  note: string;
  cta: string;
  imageAlt: string;
};

export type Dictionary = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    download: string;
    features: string;
    howItWorks: string;
    screenshots: string;
    faq: string;
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
  launch: LaunchSection;
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
      title: "Bike Me | Now on the App Store",
      description:
        "Download Bike Me for iPhone and start creating rides, inviting riders, and finding cycling routes near you."
    },
    nav: {
      download: "Download",
      features: "Features",
      howItWorks: "How it works",
      screenshots: "Screenshots",
      faq: "FAQ"
    },
    hero: {
      headline: "Keep your cycling friends close - and find new riders",
      subheadline:
        "Bike Me brings your cycling contacts, rides, and invitations together. Create private rides for friends or public rides where new cyclists can join.",
      payoffTitle: "Bike Me is now on the App Store",
      payoffText:
        "Download Bike Me for iPhone and start creating rides, inviting riders, and finding cycling routes near you.",
      primaryCta: "Download on the App Store",
      secondaryCta: "See how it works",
      previewLabel: "App preview"
    },
    brand: {
      intro: "Bike Me is built for cycling friends, familiar faces, and the next ride together",
      bullets: [
        "Keep track of the riders you want to see again",
        "Create private rides for friends, clubs, and training partners",
        "Open public rides when new cyclists should be able to join",
        "Invite the right riders and keep everyone aligned",
        "Import a GPX route (optional)",
        "Get push alerts for important ride changes"
      ]
    },
    launch: {
      eyebrow: "Available for iPhone",
      title: "Download Bike Me for iPhone",
      text:
        "Bike Me brings your cycling friends, rides, and invitations together. Create private rides for friends or public rides where new riders can join.",
      note: "Available now on the App Store",
      cta: "Open in the App Store",
      imageAlt: "Bike Me app launch preview"
    },
    features: {
      eyebrow: "Features",
      title: "A cycling community that actually gets people riding",
      items: [
        {
          title: "Plan rides together",
          description:
            "Create a ride, choose a time, and share it with the people you want to ride with. Keep it private for your regular group or make it public so others can join."
        },
        {
          title: "Keep cycling contacts alive",
          description:
            "Cyclists meet good people all the time, but the connection often fades. Bike Me makes it easier to keep hold of the riders you want to ride with again."
        },
        {
          title: "Private and public rides",
          description:
            "Invite close cycling friends to a closed ride, or open it up to new riders in the area. You decide how the group should work."
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
      title: "From cycling friends to a shared ride in three steps",
      steps: [
        {
          title: "Gather your riders",
          description: "Keep friends, clubmates, and new cycling contacts close in one place."
        },
        {
          title: "Create a private or public ride",
          description: "Choose the time, meeting point, and whether the ride is closed or open."
        },
        {
          title: "Invite riders and roll out",
          description: "Share the plan, see who joins, and head out together."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshots",
      title: "Everything around your rides, friends, and progress",
      subtitle: "From meeting points and invitations to ride history and deeper ride insights.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Join the community",
          description: "Create a profile and start building your cycling network."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Map and meeting points",
          description: "See fixed meeting points, nearby rides, and where your next group can start."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Meeting point details",
          description: "Check activity, upcoming rides, and create a ride from a known spot."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Ride Now or plan ahead",
          description: "Choose whether the ride starts soon or is planned for later."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Create and invite",
          description: "Set the ride up and invite the riders you want with you."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Ride title suggestions",
          description: "Pick a clear ride title so the group knows what kind of ride it is."
        },
        {
          image: "/screenshots/app-07.png",
          title: "Ride details",
          description: "See meeting point, participants, and start tracking when everyone is ready."
        },
        {
          image: "/screenshots/app-08.png",
          title: "Your rides and invitations",
          description: "Keep your own rides, invites, and next actions in one simple view."
        },
        {
          image: "/screenshots/app-09.png",
          title: "Invite riders",
          description: "Find cycling friends and invite the right people to the ride."
        },
        {
          image: "/screenshots/app-10.png",
          title: "Hotspots nearby",
          description: "Discover popular cycling spots and create rides around them."
        },
        {
          image: "/screenshots/app-11.png",
          title: "Ride history",
          description: "Look back at completed rides and keep track of what you rode."
        },
        {
          image: "/screenshots/app-12.png",
          title: "Status and distance",
          description: "Follow your development over time with distance and progress charts."
        },
        {
          image: "/screenshots/app-13.png",
          title: "Weekly overview",
          description: "See your weekly distance, elevation, and activity status."
        },
        {
          image: "/screenshots/app-14.png",
          title: "Watts and training zones",
          description: "Dive into estimated watts, zones, and performance after the ride."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Top performances",
          description: "Track your best times, longest rides, top speed, and highest watt."
        }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions",
      items: [
        {
          question: "What is Bike Me?",
          answer:
            "Bike Me is a cycling app for finding riders, creating rides, inviting others, and keeping track of your rides."
        },
        {
          question: "Where can I download Bike Me?",
          answer: "You can download Bike Me for iPhone from the App Store."
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
      title: "Bike Me | Nu på App Store",
      description:
        "Hent Bike Me til iPhone og kom i gang med at arrangere cykelture, invitere ryttere og finde ture i dit område."
    },
    nav: {
      download: "Hent appen",
      features: "Funktioner",
      howItWorks: "Sådan virker det",
      screenshots: "Skærmbilleder",
      faq: "FAQ"
    },
    hero: {
      headline: "Hold fast i dine cykelvenner - og find nye at køre med",
      subheadline:
        "Bike Me samler dine cykelbekendtskaber, ture og invitationer ét sted. Opret private ture for dine venner, eller lav offentlige ture, hvor nye ryttere kan hoppe med.",
      payoffTitle: "Bike Me er nu på App Store",
      payoffText:
        "Hent Bike Me til iPhone og kom i gang med at arrangere cykelture, invitere ryttere og finde ture i dit område.",
      primaryCta: "Hent i App Store",
      secondaryCta: "Se hvordan det virker",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike Me er dit cykelfællesskab til venner, bekendtskaber og næste tur",
      bullets: [
        "Hold styr på de ryttere, du gerne vil køre med igen",
        "Opret private ture for venner, klubkammerater og træningsmakkere",
        "Gør ture offentlige, når nye ryttere skal kunne hoppe med",
        "Invitér de rigtige ryttere og hold gruppen samlet",
        "Importér en GPX-rute (valgfrit)",
        "Få push-besked ved vigtige turændringer"
      ]
    },
    launch: {
      eyebrow: "Tilgængelig til iPhone",
      title: "Download Bike Me til iPhone",
      text:
        "Bike Me samler dine cykelvenner, ture og invitationer ét sted. Opret private ture for venner eller offentlige ture, hvor nye ryttere kan melde sig til.",
      note: "Tilgængelig nu i App Store",
      cta: "Åbn i App Store",
      imageAlt: "Bike Me app launch preview"
    },
    features: {
      eyebrow: "Funktioner",
      title: "Et cykelfællesskab, der gør det lettere at komme afsted",
      items: [
        {
          title: "Planlæg ture sammen",
          description:
            "Opret en tur, vælg tidspunkt og del den med dem, du gerne vil køre med. Gør turen privat for din faste gruppe - eller offentlig, hvis andre ryttere skal kunne finde og deltage."
        },
        {
          title: "Hold kontakten med dine cykelbekendtskaber",
          description:
            "De fleste cyklister møder mange gode mennesker på vejen, men kontakten forsvinder ofte igen. Bike Me gør det nemmere at holde fast i dem, du gerne vil køre med igen."
        },
        {
          title: "Private og offentlige ture",
          description:
            "Invitér dine nærmeste cykelvenner til en lukket tur, eller åbn turen for nye ryttere i området. Du bestemmer selv, hvordan fællesskabet skal fungere."
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
      title: "Fra cykelvenner til fælles tur i tre trin",
      steps: [
        {
          title: "Saml dine ryttere",
          description: "Hold venner, klubkammerater og nye cykelbekendtskaber samlet ét sted."
        },
        {
          title: "Opret en privat eller offentlig tur",
          description: "Vælg tidspunkt, mødested og om turen kun er for inviterede eller åben."
        },
        {
          title: "Invitér ryttere og kør",
          description: "Del planen, se hvem der er med, og rul ud sammen."
        }
      ]
    },
    screenshots: {
      eyebrow: "Skærmbilleder",
      title: "Alt omkring dine ture, cykelvenner og udvikling",
      subtitle: "Fra mødesteder og invitationer til turhistorik og dybere indsigt.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Bliv en del af fællesskabet",
          description: "Opret din profil og begynd at samle dine cykelbekendtskaber."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Kort og faste mødesteder",
          description: "Se faste mødesteder, ture i nærheden og hvor næste fællestur kan starte."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Detaljer om mødested",
          description: "Se aktivitet, kommende ture og opret en tur fra et kendt spot."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "KØR NU eller planlæg frem",
          description: "Vælg om turen starter snart eller planlægges til senere."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Opret og invitér",
          description: "Sæt turen op og invitér de ryttere, du gerne vil have med."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Forslag til turtitel",
          description: "Vælg en tydelig titel, så gruppen ved, hvilken type tur det er."
        },
        {
          image: "/screenshots/app-07.png",
          title: "Turdetaljer",
          description: "Se mødested, deltagere og start tracking, når alle er klar."
        },
        {
          image: "/screenshots/app-08.png",
          title: "Dine ture og invitationer",
          description: "Hold styr på egne ture, invitationer og næste handlinger ét sted."
        },
        {
          image: "/screenshots/app-09.png",
          title: "Invitér ryttere",
          description: "Find cykelvenner og invitér de rigtige personer til turen."
        },
        {
          image: "/screenshots/app-10.png",
          title: "Hotspots i området",
          description: "Find populære cykelspots og opret ture omkring dem."
        },
        {
          image: "/screenshots/app-11.png",
          title: "Turhistorik",
          description: "Se tidligere ture og hold overblik over det, du har kørt."
        },
        {
          image: "/screenshots/app-12.png",
          title: "Status og distance",
          description: "Følg din udvikling med distance og grafer over tid."
        },
        {
          image: "/screenshots/app-13.png",
          title: "Ugeoverblik",
          description: "Se ugens distance, højdemeter og aktivitetsstatus."
        },
        {
          image: "/screenshots/app-14.png",
          title: "Watt og træningszoner",
          description: "Dyk ned i estimerede watt, zoner og præstation efter turen."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Toppræstationer",
          description: "Følg dine bedste tider, længste ture, topfart og højeste watt."
        }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Ofte stillede spørgsmål",
      items: [
        {
          question: "Hvad er Bike Me?",
          answer:
            "Bike Me er en cykelapp til at finde ryttere, oprette ture, invitere andre og holde styr på dine cykelture."
        },
        {
          question: "Hvor kan jeg hente Bike Me?",
          answer: "Du kan hente Bike Me til iPhone i App Store."
        },
        {
          question: "Hvordan virker KØR NU?",
          answer: "KØR NU lader dig oprette en tur, der starter snart, så ryttere i nærheden hurtigt kan deltage."
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
      title: "Bike Me | Jetzt im App Store",
      description:
        "Lade Bike Me für iPhone und erstelle Fahrten, lade Fahrer ein und finde Routen in deiner Nähe."
    },
    nav: {
      download: "Download",
      features: "Funktionen",
      howItWorks: "So funktioniert's",
      screenshots: "Screenshots",
      faq: "FAQ"
    },
    hero: {
      headline: "Bleib mit deinen Radfreunden verbunden - und finde neue",
      subheadline:
        "Bike Me bringt deine Radkontakte, Fahrten und Einladungen an einem Ort zusammen. Erstelle private Fahrten für Freunde oder öffentliche Fahrten, bei denen neue Fahrer dazukommen können.",
      payoffTitle: "Bike Me ist jetzt im App Store",
      payoffText:
        "Lade Bike Me für iPhone und erstelle Fahrten, lade Fahrer ein und finde Routen in deiner Nähe.",
      primaryCta: "Im App Store laden",
      secondaryCta: "So funktioniert's",
      previewLabel: "App-Vorschau"
    },
    brand: {
      intro: "Bike Me ist für Radfreunde, bekannte Gesichter und die nächste gemeinsame Fahrt gemacht",
      bullets: [
        "Behalte die Fahrer im Blick, mit denen du wieder fahren willst",
        "Erstelle private Fahrten für Freunde, Clubs und Trainingspartner",
        "Öffne Fahrten öffentlich, wenn neue Fahrer mitkommen sollen",
        "Lade die richtigen Fahrer ein und halte die Gruppe zusammen",
        "Importiere eine GPX-Route (optional)",
        "Erhalte Push-Benachrichtigungen bei wichtigen Fahrtänderungen"
      ]
    },
    launch: {
      eyebrow: "Für iPhone verfügbar",
      title: "Bike Me für iPhone herunterladen",
      text:
        "Bike Me bringt Radfreunde, Fahrten und Einladungen an einem Ort zusammen. Erstelle private Fahrten für Freunde oder öffentliche Fahrten, bei denen neue Fahrer dazukommen können.",
      note: "Jetzt im App Store verfügbar",
      cta: "Im App Store öffnen",
      imageAlt: "Bike Me App-Launch-Vorschau"
    },
    features: {
      eyebrow: "Funktionen",
      title: "Eine Radcommunity, die Menschen wirklich aufs Rad bringt",
      items: [
        {
          title: "Gemeinsam Fahrten planen",
          description:
            "Erstelle eine Fahrt, wähle die Zeit und teile sie mit den Menschen, mit denen du fahren willst. Privat für deine feste Gruppe oder öffentlich, damit andere Fahrer teilnehmen können."
        },
        {
          title: "Radkontakte lebendig halten",
          description:
            "Viele Radfahrer treffen unterwegs tolle Menschen, verlieren aber wieder den Kontakt. Bike Me macht es leichter, die Fahrer wiederzufinden, mit denen du erneut fahren möchtest."
        },
        {
          title: "Private und öffentliche Fahrten",
          description:
            "Lade deine engsten Radfreunde zu einer geschlossenen Fahrt ein oder öffne sie für neue Fahrer in der Umgebung. Du bestimmst, wie die Gruppe funktioniert."
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
      title: "In drei Schritten von Radfreunden zur gemeinsamen Fahrt",
      steps: [
        {
          title: "Sammle deine Fahrer",
          description: "Halte Freunde, Clubkollegen und neue Radkontakte an einem Ort zusammen."
        },
        {
          title: "Erstelle eine private oder öffentliche Fahrt",
          description: "Wähle Zeit, Treffpunkt und ob die Fahrt geschlossen oder offen ist."
        },
        {
          title: "Fahrer einladen und losfahren",
          description: "Teile den Plan, sieh wer dabei ist, und startet gemeinsam."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshots",
      title: "Alles rund um Fahrten, Radfreunde und Fortschritt",
      subtitle: "Von Treffpunkten und Einladungen bis zu Fahrtenhistorie und tieferen Einblicken.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Teil der Community werden",
          description: "Erstelle dein Profil und baue dein Radnetzwerk auf."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Karte und feste Treffpunkte",
          description: "Sieh feste Treffpunkte, Fahrten in der Nähe und wo die nächste Gruppe starten kann."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Treffpunktdetails",
          description: "Sieh Aktivität, kommende Fahrten und erstelle eine Fahrt von einem bekannten Ort."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Ride Now oder vorausplanen",
          description: "Wähle, ob die Fahrt bald startet oder für später geplant wird."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Erstellen und einladen",
          description: "Richte die Fahrt ein und lade die Fahrer ein, die du dabeihaben möchtest."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Vorschläge für Fahrttitel",
          description: "Wähle einen klaren Titel, damit die Gruppe weiß, welche Art Fahrt geplant ist."
        },
        {
          image: "/screenshots/app-07.png",
          title: "Fahrtdetails",
          description: "Sieh Treffpunkt, Teilnehmer und starte Tracking, wenn alle bereit sind."
        },
        {
          image: "/screenshots/app-08.png",
          title: "Deine Fahrten und Einladungen",
          description: "Behalte eigene Fahrten, Einladungen und nächste Schritte an einem Ort."
        },
        {
          image: "/screenshots/app-09.png",
          title: "Fahrer einladen",
          description: "Finde Radfreunde und lade die richtigen Menschen zur Fahrt ein."
        },
        {
          image: "/screenshots/app-10.png",
          title: "Hotspots in der Nähe",
          description: "Entdecke beliebte Radspots und erstelle Fahrten rund um sie."
        },
        {
          image: "/screenshots/app-11.png",
          title: "Fahrtenhistorie",
          description: "Blicke auf abgeschlossene Fahrten zurück und behalte deine Touren im Blick."
        },
        {
          image: "/screenshots/app-12.png",
          title: "Status und Distanz",
          description: "Verfolge deine Entwicklung mit Distanz und Fortschrittsdiagrammen."
        },
        {
          image: "/screenshots/app-13.png",
          title: "Wochenübersicht",
          description: "Sieh deine wöchentliche Distanz, Höhenmeter und Aktivität."
        },
        {
          image: "/screenshots/app-14.png",
          title: "Watt und Trainingszonen",
          description: "Tauche nach der Fahrt in geschätzte Watt, Zonen und Leistung ein."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Top-Leistungen",
          description: "Verfolge Bestzeiten, längste Fahrten, Höchsttempo und höchste Wattwerte."
        }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      items: [
        {
          question: "Was ist Bike Me?",
          answer:
            "Bike Me ist eine Fahrrad-App, mit der du Fahrer finden, Fahrten erstellen, andere einladen und deine Touren im Blick behalten kannst."
        },
        {
          question: "Wo kann ich Bike Me herunterladen?",
          answer: "Du kannst Bike Me für iPhone im App Store herunterladen."
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
      title: "Bike Me | Ya en App Store",
      description:
        "Descarga Bike Me para iPhone y empieza a crear salidas, invitar ciclistas y encontrar rutas cerca de ti."
    },
    nav: {
      download: "Descargar",
      features: "Funciones",
      howItWorks: "Cómo funciona",
      screenshots: "Capturas",
      faq: "FAQ"
    },
    hero: {
      headline: "Mantén cerca a tus amigos ciclistas - y encuentra nuevos",
      subheadline:
        "Bike Me reúne tus contactos ciclistas, salidas e invitaciones en un solo lugar. Crea salidas privadas para tus amigos o salidas públicas para que se unan nuevos ciclistas.",
      payoffTitle: "Bike Me ya está en App Store",
      payoffText:
        "Descarga Bike Me para iPhone y empieza a crear salidas, invitar ciclistas y encontrar rutas cerca de ti.",
      primaryCta: "Descargar en App Store",
      secondaryCta: "Ver cómo funciona",
      previewLabel: "Vista de la app"
    },
    brand: {
      intro: "Bike Me está pensado para amigos ciclistas, contactos conocidos y la próxima salida juntos",
      bullets: [
        "Mantén cerca a los ciclistas con los que quieres volver a rodar",
        "Crea salidas privadas para amigos, clubes y compañeros de entrenamiento",
        "Haz salidas públicas cuando quieras que se unan nuevos ciclistas",
        "Invita a las personas adecuadas y mantén el grupo organizado",
        "Importa una ruta GPX (opcional)",
        "Recibe notificaciones push sobre cambios importantes de la salida"
      ]
    },
    launch: {
      eyebrow: "Disponible para iPhone",
      title: "Descarga Bike Me para iPhone",
      text:
        "Bike Me reúne tus amigos ciclistas, salidas e invitaciones en un solo lugar. Crea salidas privadas para amigos o salidas públicas donde nuevos ciclistas puedan unirse.",
      note: "Disponible ahora en App Store",
      cta: "Abrir en App Store",
      imageAlt: "Vista de lanzamiento de la app Bike Me"
    },
    features: {
      eyebrow: "Funciones",
      title: "Una comunidad ciclista que hace más fácil salir a rodar",
      items: [
        {
          title: "Planifica salidas juntos",
          description:
            "Crea una salida, elige la hora y compártela con quienes quieres rodar. Hazla privada para tu grupo habitual o pública para que otros ciclistas puedan encontrarla y unirse."
        },
        {
          title: "Mantén vivos tus contactos ciclistas",
          description:
            "Muchos ciclistas conocen gente increíble en la carretera, pero el contacto se pierde. Bike Me te ayuda a mantener cerca a quienes quieres volver a ver."
        },
        {
          title: "Salidas privadas y públicas",
          description:
            "Invita a tus amigos ciclistas más cercanos a una salida cerrada o ábrela a nuevos ciclistas de la zona. Tú decides cómo funciona el grupo."
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
      title: "De amigos ciclistas a una salida juntos en tres pasos",
      steps: [
        {
          title: "Reúne a tus ciclistas",
          description: "Ten amigos, compañeros de club y nuevos contactos ciclistas en un solo lugar."
        },
        {
          title: "Crea una salida privada o pública",
          description: "Elige hora, punto de encuentro y si la salida será cerrada o abierta."
        },
        {
          title: "Invita y salid a rodar",
          description: "Comparte el plan, mira quién se une y salid juntos."
        }
      ]
    },
    screenshots: {
      eyebrow: "Capturas",
      title: "Todo sobre tus salidas, amigos ciclistas y progreso",
      subtitle: "De puntos de encuentro e invitaciones a historial de salidas e insights más profundos.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Únete a la comunidad",
          description: "Crea tu perfil y empieza a construir tu red ciclista."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Mapa y puntos de encuentro",
          description: "Ve puntos fijos, salidas cercanas y dónde puede empezar el próximo grupo."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Detalles del punto de encuentro",
          description: "Consulta actividad, próximas salidas y crea una salida desde un lugar conocido."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Ride Now o planificar",
          description: "Elige si la salida empieza pronto o se planifica para más tarde."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Crear e invitar",
          description: "Configura la salida e invita a los ciclistas que quieres llevar contigo."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Sugerencias de título",
          description: "Elige un título claro para que el grupo sepa qué tipo de salida es."
        },
        {
          image: "/screenshots/app-07.png",
          title: "Detalles de la salida",
          description: "Ve punto de encuentro, participantes e inicia el tracking cuando todo esté listo."
        },
        {
          image: "/screenshots/app-08.png",
          title: "Tus salidas e invitaciones",
          description: "Ten tus salidas, invitaciones y próximas acciones en una vista sencilla."
        },
        {
          image: "/screenshots/app-09.png",
          title: "Invitar ciclistas",
          description: "Encuentra amigos ciclistas e invita a las personas adecuadas a la salida."
        },
        {
          image: "/screenshots/app-10.png",
          title: "Hotspots cercanos",
          description: "Descubre puntos ciclistas populares y crea salidas alrededor de ellos."
        },
        {
          image: "/screenshots/app-11.png",
          title: "Historial de salidas",
          description: "Revisa salidas completadas y mantén el control de lo que has rodado."
        },
        {
          image: "/screenshots/app-12.png",
          title: "Estado y distancia",
          description: "Sigue tu evolución con distancia y gráficas de progreso."
        },
        {
          image: "/screenshots/app-13.png",
          title: "Vista semanal",
          description: "Consulta distancia semanal, desnivel y estado de actividad."
        },
        {
          image: "/screenshots/app-14.png",
          title: "Vatios y zonas",
          description: "Profundiza en vatios estimados, zonas y rendimiento después de la salida."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Mejores marcas",
          description: "Sigue tus mejores tiempos, salidas más largas, velocidad máxima y watt más alto."
        }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Preguntas frecuentes",
      items: [
        {
          question: "¿Qué es Bike Me?",
          answer:
            "Bike Me es una app ciclista para encontrar ciclistas, crear salidas, invitar a otros y seguir tus rutas."
        },
        {
          question: "¿Dónde puedo descargar Bike Me?",
          answer: "Puedes descargar Bike Me para iPhone desde App Store."
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
      title: "Bike Me | Ora su App Store",
      description:
        "Scarica Bike Me per iPhone e inizia a creare uscite, invitare ciclisti e trovare percorsi vicino a te."
    },
    nav: {
      download: "Scarica",
      features: "Funzionalità",
      howItWorks: "Come funziona",
      screenshots: "Screenshot",
      faq: "FAQ"
    },
    hero: {
      headline: "Resta vicino ai tuoi amici ciclisti - e trovane di nuovi",
      subheadline:
        "Bike Me riunisce contatti ciclistici, uscite e inviti in un unico posto. Crea uscite private per gli amici o uscite pubbliche dove nuovi ciclisti possono unirsi.",
      payoffTitle: "Bike Me è ora su App Store",
      payoffText:
        "Scarica Bike Me per iPhone e inizia a creare uscite, invitare ciclisti e trovare percorsi vicino a te.",
      primaryCta: "Scarica su App Store",
      secondaryCta: "Scopri come funziona",
      previewLabel: "Anteprima app"
    },
    brand: {
      intro: "Bike Me nasce per amici ciclisti, contatti conosciuti e la prossima uscita insieme",
      bullets: [
        "Tieni vicini i ciclisti con cui vuoi pedalare ancora",
        "Crea uscite private per amici, club e compagni di allenamento",
        "Rendi pubbliche le uscite quando vuoi invitare nuovi ciclisti",
        "Invita i ciclisti giusti e tieni il gruppo allineato",
        "Importa un percorso GPX (opzionale)",
        "Ricevi notifiche push per i cambiamenti importanti dell'uscita"
      ]
    },
    launch: {
      eyebrow: "Disponibile per iPhone",
      title: "Scarica Bike Me per iPhone",
      text:
        "Bike Me riunisce amici ciclisti, uscite e inviti in un unico posto. Crea uscite private per gli amici o uscite pubbliche a cui nuovi ciclisti possono unirsi.",
      note: "Disponibile ora su App Store",
      cta: "Apri su App Store",
      imageAlt: "Anteprima del lancio dell'app Bike Me"
    },
    features: {
      eyebrow: "Funzionalità",
      title: "Una community ciclistica che rende più facile uscire a pedalare",
      items: [
        {
          title: "Pianifica uscite insieme",
          description:
            "Crea un'uscita, scegli l'orario e condividila con chi vuoi avere con te. Rendila privata per il tuo gruppo fisso o pubblica se altri ciclisti devono poterla trovare e unirsi."
        },
        {
          title: "Mantieni vivi i contatti ciclistici",
          description:
            "I ciclisti incontrano tante persone interessanti, ma spesso il contatto si perde. Bike Me ti aiuta a ritrovare chi vorresti rivedere in sella."
        },
        {
          title: "Uscite private e pubbliche",
          description:
            "Invita gli amici ciclisti più vicini a un'uscita chiusa, oppure aprila a nuovi ciclisti della zona. Decidi tu come deve funzionare il gruppo."
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
      title: "Dagli amici ciclisti a un'uscita insieme in tre passi",
      steps: [
        {
          title: "Riunisci i tuoi ciclisti",
          description: "Tieni amici, compagni di club e nuovi contatti ciclistici in un unico posto."
        },
        {
          title: "Crea un'uscita privata o pubblica",
          description: "Scegli orario, punto di ritrovo e se l'uscita è chiusa o aperta."
        },
        {
          title: "Invita e parti",
          description: "Condividi il piano, vedi chi partecipa e partite insieme."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshot",
      title: "Tutto su uscite, amici ciclisti e progressi",
      subtitle: "Da punti di ritrovo e inviti allo storico uscite e agli insight più dettagliati.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Entra nella community",
          description: "Crea il tuo profilo e inizia a costruire la tua rete ciclistica."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Mappa e punti di ritrovo",
          description: "Vedi punti fissi, uscite vicine e dove può partire il prossimo gruppo."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Dettagli del punto di ritrovo",
          description: "Controlla attività, uscite in arrivo e crea un'uscita da uno spot conosciuto."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Ride Now o pianifica",
          description: "Scegli se l'uscita parte a breve o viene pianificata per dopo."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Crea e invita",
          description: "Imposta l'uscita e invita i ciclisti che vuoi con te."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Suggerimenti per il titolo",
          description: "Scegli un titolo chiaro così il gruppo sa che tipo di uscita è."
        },
        {
          image: "/screenshots/app-07.png",
          title: "Dettagli uscita",
          description: "Vedi punto di ritrovo, partecipanti e avvia il tracking quando siete pronti."
        },
        {
          image: "/screenshots/app-08.png",
          title: "Le tue uscite e inviti",
          description: "Tieni uscite, inviti e prossime azioni in una vista semplice."
        },
        {
          image: "/screenshots/app-09.png",
          title: "Invita ciclisti",
          description: "Trova amici ciclisti e invita le persone giuste all'uscita."
        },
        {
          image: "/screenshots/app-10.png",
          title: "Hotspot vicini",
          description: "Scopri luoghi ciclistici popolari e crea uscite intorno a loro."
        },
        {
          image: "/screenshots/app-11.png",
          title: "Storico uscite",
          description: "Rivedi le uscite completate e tieni traccia di ciò che hai pedalato."
        },
        {
          image: "/screenshots/app-12.png",
          title: "Status e distanza",
          description: "Segui i tuoi progressi con distanza e grafici nel tempo."
        },
        {
          image: "/screenshots/app-13.png",
          title: "Panoramica settimanale",
          description: "Vedi distanza settimanale, dislivello e stato attività."
        },
        {
          image: "/screenshots/app-14.png",
          title: "Watt e zone",
          description: "Approfondisci watt stimati, zone e prestazione dopo l'uscita."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Migliori prestazioni",
          description: "Segui migliori tempi, uscite più lunghe, velocità massima e watt più alto."
        }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Domande frequenti",
      items: [
        {
          question: "Che cos'è Bike Me?",
          answer:
            "Bike Me è un'app per ciclisti per trovare altri ciclisti, creare uscite, invitare persone e tenere traccia delle tue pedalate."
        },
        {
          question: "Dove posso scaricare Bike Me?",
          answer: "Puoi scaricare Bike Me per iPhone da App Store."
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
      title: "Bike Me | Maintenant sur l'App Store",
      description:
        "Téléchargez Bike Me pour iPhone et commencez à créer des sorties, inviter des cyclistes et trouver des itinéraires près de vous."
    },
    nav: {
      download: "Télécharger",
      features: "Fonctionnalités",
      howItWorks: "Comment ça marche",
      screenshots: "Captures",
      faq: "FAQ"
    },
    hero: {
      headline: "Gardez vos amis cyclistes près de vous - et trouvez-en de nouveaux",
      subheadline:
        "Bike Me réunit vos contacts cyclistes, sorties et invitations au même endroit. Créez des sorties privées pour vos amis ou des sorties publiques où de nouveaux cyclistes peuvent vous rejoindre.",
      payoffTitle: "Bike Me est maintenant sur l'App Store",
      payoffText:
        "Téléchargez Bike Me pour iPhone et commencez à créer des sorties, inviter des cyclistes et trouver des itinéraires près de vous.",
      primaryCta: "Télécharger sur l'App Store",
      secondaryCta: "Voir le fonctionnement",
      previewLabel: "Aperçu de l'app"
    },
    brand: {
      intro: "Bike Me est conçu pour les amis cyclistes, les contacts retrouvés et la prochaine sortie ensemble",
      bullets: [
        "Gardez le contact avec les cyclistes que vous voulez revoir",
        "Créez des sorties privées pour amis, clubs et partenaires d'entraînement",
        "Ouvrez des sorties publiques quand de nouveaux cyclistes peuvent rejoindre",
        "Invitez les bons cyclistes et gardez le groupe aligné",
        "Importez un itinéraire GPX (optionnel)",
        "Recevez des notifications push en cas de changement important de sortie"
      ]
    },
    launch: {
      eyebrow: "Disponible pour iPhone",
      title: "Télécharger Bike Me pour iPhone",
      text:
        "Bike Me rassemble vos amis cyclistes, sorties et invitations au même endroit. Créez des sorties privées pour vos amis ou des sorties publiques où de nouveaux cyclistes peuvent vous rejoindre.",
      note: "Disponible maintenant sur l'App Store",
      cta: "Ouvrir dans l'App Store",
      imageAlt: "Aperçu du lancement de l'app Bike Me"
    },
    features: {
      eyebrow: "Fonctionnalités",
      title: "Une communauté cycliste qui donne envie de rouler",
      items: [
        {
          title: "Planifiez des sorties ensemble",
          description:
            "Créez une sortie, choisissez l'heure et partagez-la avec les personnes avec qui vous voulez rouler. Gardez-la privée pour votre groupe habituel ou rendez-la publique pour que d'autres cyclistes puissent la trouver et rejoindre."
        },
        {
          title: "Gardez le lien avec vos contacts cyclistes",
          description:
            "Les cyclistes rencontrent souvent des personnes formidables sur la route, mais le contact disparaît. Bike Me aide à garder près de vous ceux avec qui vous voulez rouler à nouveau."
        },
        {
          title: "Sorties privées et publiques",
          description:
            "Invitez vos amis cyclistes proches à une sortie fermée, ou ouvrez-la aux nouveaux cyclistes du secteur. Vous décidez comment le groupe fonctionne."
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
      title: "Des amis cyclistes à une sortie ensemble en trois étapes",
      steps: [
        {
          title: "Rassemblez vos cyclistes",
          description: "Gardez amis, camarades de club et nouveaux contacts cyclistes au même endroit."
        },
        {
          title: "Créez une sortie privée ou publique",
          description: "Choisissez l'heure, le lieu de rendez-vous et si la sortie est fermée ou ouverte."
        },
        {
          title: "Invitez et partez rouler",
          description: "Partagez le plan, voyez qui participe et partez ensemble."
        }
      ]
    },
    screenshots: {
      eyebrow: "Captures",
      title: "Tout autour de vos sorties, amis cyclistes et progrès",
      subtitle: "Des lieux de rendez-vous et invitations à l'historique des sorties et aux analyses plus détaillées.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Rejoindre la communauté",
          description: "Créez votre profil et commencez à construire votre réseau cycliste."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Carte et lieux de rendez-vous",
          description: "Voyez les points fixes, les sorties proches et où le prochain groupe peut partir."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Détails du lieu de rendez-vous",
          description: "Consultez l'activité, les sorties à venir et créez une sortie depuis un spot connu."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Ride Now ou planification",
          description: "Choisissez si la sortie démarre bientôt ou si elle est prévue plus tard."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Créer et inviter",
          description: "Configurez la sortie et invitez les cyclistes que vous voulez avec vous."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Suggestions de titre",
          description: "Choisissez un titre clair pour que le groupe sache quel type de sortie est prévu."
        },
        {
          image: "/screenshots/app-07.png",
          title: "Détails de sortie",
          description: "Voyez le rendez-vous, les participants et lancez le suivi quand tout le monde est prêt."
        },
        {
          image: "/screenshots/app-08.png",
          title: "Vos sorties et invitations",
          description: "Gardez vos sorties, invitations et prochaines actions dans une vue simple."
        },
        {
          image: "/screenshots/app-09.png",
          title: "Inviter des cyclistes",
          description: "Trouvez vos amis cyclistes et invitez les bonnes personnes à la sortie."
        },
        {
          image: "/screenshots/app-10.png",
          title: "Hotspots proches",
          description: "Découvrez les spots cyclistes populaires et créez des sorties autour d'eux."
        },
        {
          image: "/screenshots/app-11.png",
          title: "Historique de sorties",
          description: "Revenez sur les sorties terminées et gardez une trace de ce que vous avez roulé."
        },
        {
          image: "/screenshots/app-12.png",
          title: "Statut et distance",
          description: "Suivez votre progression avec distance et graphiques dans le temps."
        },
        {
          image: "/screenshots/app-13.png",
          title: "Vue hebdomadaire",
          description: "Consultez distance hebdomadaire, dénivelé et statut d'activité."
        },
        {
          image: "/screenshots/app-14.png",
          title: "Watts et zones",
          description: "Explorez watts estimés, zones et performance après la sortie."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Meilleures performances",
          description: "Suivez meilleurs temps, plus longues sorties, vitesse max et watts les plus élevés."
        }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions fréquentes",
      items: [
        {
          question: "Qu'est-ce que Bike Me ?",
          answer:
            "Bike Me est une app cycliste pour trouver des cyclistes, créer des sorties, inviter d'autres personnes et suivre vos sorties."
        },
        {
          question: "Où télécharger Bike Me ?",
          answer: "Vous pouvez télécharger Bike Me pour iPhone sur l'App Store."
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
      title: "Bike Me | Nu in de App Store",
      description:
        "Download Bike Me voor iPhone en begin met ritten maken, fietsers uitnodigen en routes in je buurt vinden."
    },
    nav: {
      download: "Download",
      features: "Functies",
      howItWorks: "Hoe het werkt",
      screenshots: "Screenshots",
      faq: "FAQ"
    },
    hero: {
      headline: "Houd je fietsvrienden dichtbij - en vind nieuwe",
      subheadline:
        "Bike Me brengt je fietscontacten, ritten en uitnodigingen op één plek samen. Maak private ritten voor vrienden of openbare ritten waar nieuwe fietsers kunnen aansluiten.",
      payoffTitle: "Bike Me staat nu in de App Store",
      payoffText:
        "Download Bike Me voor iPhone en begin met ritten maken, fietsers uitnodigen en routes in je buurt vinden.",
      primaryCta: "Download in de App Store",
      secondaryCta: "Bekijk hoe het werkt",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike Me is gebouwd voor fietsvrienden, bekende gezichten en de volgende rit samen",
      bullets: [
        "Houd de fietsers bij met wie je opnieuw wilt rijden",
        "Maak private ritten voor vrienden, clubs en trainingsmaatjes",
        "Zet ritten openbaar wanneer nieuwe fietsers mogen aansluiten",
        "Nodig de juiste fietsers uit en houd de groep op één lijn",
        "Importeer een GPX-route (optioneel)",
        "Ontvang pushmeldingen bij belangrijke ritwijzigingen"
      ]
    },
    launch: {
      eyebrow: "Beschikbaar voor iPhone",
      title: "Download Bike Me voor iPhone",
      text:
        "Bike Me brengt je fietsvrienden, ritten en uitnodigingen op één plek samen. Maak private ritten voor vrienden of openbare ritten waar nieuwe fietsers kunnen aansluiten.",
      note: "Nu beschikbaar in de App Store",
      cta: "Open in de App Store",
      imageAlt: "Bike Me app-lanceringspreview"
    },
    features: {
      eyebrow: "Functies",
      title: "Een fietscommunity die mensen echt laat rijden",
      items: [
        {
          title: "Plan ritten samen",
          description:
            "Maak een rit, kies een tijd en deel die met de mensen met wie je wilt rijden. Houd de rit privé voor je vaste groep of maak hem openbaar zodat andere fietsers kunnen aansluiten."
        },
        {
          title: "Houd fietscontacten levend",
          description:
            "Fietsers ontmoeten vaak goede mensen onderweg, maar het contact verdwijnt snel. Bike Me maakt het makkelijker om de mensen vast te houden met wie je opnieuw wilt rijden."
        },
        {
          title: "Private en openbare ritten",
          description:
            "Nodig je dichtste fietsvrienden uit voor een gesloten rit, of open de rit voor nieuwe fietsers in de buurt. Jij bepaalt hoe de groep werkt."
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
      title: "Van fietsvrienden naar samen rijden in drie stappen",
      steps: [
        {
          title: "Verzamel je fietsers",
          description: "Houd vrienden, clubgenoten en nieuwe fietscontacten bij elkaar op één plek."
        },
        {
          title: "Maak een private of openbare rit",
          description: "Kies tijd, ontmoetingsplek en of de rit gesloten of open is."
        },
        {
          title: "Nodig uit en vertrek",
          description: "Deel het plan, zie wie meegaat en vertrek samen."
        }
      ]
    },
    screenshots: {
      eyebrow: "Screenshots",
      title: "Alles rond je ritten, fietsvrienden en voortgang",
      subtitle: "Van ontmoetingsplekken en uitnodigingen tot ritgeschiedenis en diepere inzichten.",
      items: [
        {
          image: "/screenshots/app-01.PNG",
          title: "Word deel van de community",
          description: "Maak je profiel aan en begin met het opbouwen van je fietsnetwerk."
        },
        {
          image: "/screenshots/app-02.PNG",
          title: "Kaart en vaste ontmoetingsplekken",
          description: "Zie vaste plekken, ritten in de buurt en waar je volgende groep kan starten."
        },
        {
          image: "/screenshots/app-03.PNG",
          title: "Details van ontmoetingsplek",
          description: "Bekijk activiteit, komende ritten en maak een rit vanaf een bekende plek."
        },
        {
          image: "/screenshots/app-04.PNG",
          title: "Ride Now of vooruit plannen",
          description: "Kies of de rit binnenkort start of later wordt gepland."
        },
        {
          image: "/screenshots/app-05.PNG",
          title: "Maak en nodig uit",
          description: "Stel de rit in en nodig de fietsers uit die je erbij wilt hebben."
        },
        {
          image: "/screenshots/app-06.PNG",
          title: "Suggesties voor rittitel",
          description: "Kies een duidelijke titel zodat de groep weet wat voor rit het is."
        },
        {
          image: "/screenshots/app-07.png",
          title: "Ritdetails",
          description: "Bekijk ontmoetingsplek, deelnemers en start tracking wanneer iedereen klaar is."
        },
        {
          image: "/screenshots/app-08.png",
          title: "Je ritten en uitnodigingen",
          description: "Houd eigen ritten, uitnodigingen en volgende acties overzichtelijk bij."
        },
        {
          image: "/screenshots/app-09.png",
          title: "Nodig fietsers uit",
          description: "Vind fietsvrienden en nodig de juiste mensen uit voor de rit."
        },
        {
          image: "/screenshots/app-10.png",
          title: "Hotspots in de buurt",
          description: "Ontdek populaire fietsplekken en maak ritten daaromheen."
        },
        {
          image: "/screenshots/app-11.png",
          title: "Ritgeschiedenis",
          description: "Kijk terug op voltooide ritten en houd bij wat je hebt gereden."
        },
        {
          image: "/screenshots/app-12.png",
          title: "Status en afstand",
          description: "Volg je ontwikkeling met afstand en voortgangsgrafieken."
        },
        {
          image: "/screenshots/app-13.png",
          title: "Weekoverzicht",
          description: "Bekijk je weekafstand, hoogtemeters en activiteitsstatus."
        },
        {
          image: "/screenshots/app-14.png",
          title: "Watt en trainingszones",
          description: "Duik in geschatte watt, zones en prestaties na de rit."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Topprestaties",
          description: "Volg je beste tijden, langste ritten, topsnelheid en hoogste watt."
        }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Veelgestelde vragen",
      items: [
        {
          question: "Wat is Bike Me?",
          answer:
            "Bike Me is een fietsapp om fietsers te vinden, ritten te maken, anderen uit te nodigen en je ritten bij te houden."
        },
        {
          question: "Waar kan ik Bike Me downloaden?",
          answer: "Je kunt Bike Me voor iPhone downloaden in de App Store."
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
