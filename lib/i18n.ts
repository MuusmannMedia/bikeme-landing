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
      title: "Bike Me | Cycling community on TestFlight",
      description:
        "Bike Me helps cyclists keep in touch, invite friends, and create private or public rides. Beta testers get 6 months of free Bike Me Pro at official launch."
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
      headline: "Keep your cycling friends close - and find new riders",
      subheadline:
        "Bike Me brings your cycling contacts, rides, and invitations together. Create private rides for friends or public rides where new cyclists can join.",
      payoffTitle: "6 months of free Pro for beta testers",
      payoffText:
        "Become a beta tester and help shape the future cycling community. All beta testers get 6 months of free Bike Me Pro when the app officially launches. Requires iPhone and Apple's TestFlight app.",
      primaryCta: "Get via TestFlight",
      secondaryCta: "See how it works",
      previewLabel: "App preview"
    },
    brand: {
      intro: "Bike ME is built for cycling friends, familiar faces, and the next ride together",
      bullets: [
        "Keep track of the riders you want to see again",
        "Create private rides for friends, clubs, and training partners",
        "Open public rides when new cyclists should be able to join",
        "Invite the right riders and keep everyone aligned",
        "Import a GPX route (optional)",
        "Get push alerts for important ride changes"
      ]
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
      subtitle: "From meeting points and invitations to ride history and deeper Pro insights.",
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
          title: "Watts and training zones (Pro)",
          description: "Dive into estimated watts, zones, and performance after the ride."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Top performances (Pro)",
          description: "Track your best times, longest rides, top speed, and highest watt."
        }
      ]
    },
    pricing: {
      eyebrow: "Free vs Pro",
      title: "Become a beta tester - get 6 months of Pro",
      subtitle:
        "Join the beta and help shape a cycling community built around friends, invites, and rides. As a beta tester, you get 6 months of Bike ME Pro when the app officially launches.",
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
            "Yes. The key social features are free: find riders, create rides, invite others, and track your rides. Bike ME Pro gives access to deeper history, status, watt estimation, training zones, and progress graphs. As a beta tester, you get 6 months of free Pro when the app officially launches."
        },
        {
          question: "Can I test Bike Me now?",
          answer:
            "Yes. Bike Me is currently open for iOS beta testers via TestFlight. All beta testers get 6 months of free Bike Me Pro when the app officially launches."
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
      title: "Bike Me | Cykelfællesskab via TestFlight",
      description:
        "Bike Me samler cykelvenner, invitationer og private eller offentlige ture. Beta-testere får 6 måneders gratis Bike Me Pro ved officiel lancering."
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
      headline: "Hold fast i dine cykelvenner - og find nye at køre med",
      subheadline:
        "Bike Me samler dine cykelbekendtskaber, ture og invitationer ét sted. Opret private ture for dine venner, eller lav offentlige ture, hvor nye ryttere kan hoppe med.",
      payoffTitle: "6 måneders gratis Pro til beta-testere",
      payoffText:
        "Bliv beta-tester og vær med til at skabe fremtidens cykelfællesskab. Som tak får alle beta-testere 6 måneders gratis Bike Me Pro, når appen lanceres officielt. Kræver iPhone og Apples TestFlight-app.",
      primaryCta: "Hent via TestFlight",
      secondaryCta: "Se hvordan det virker",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike ME er dit cykelfællesskab til venner, bekendtskaber og næste tur",
      bullets: [
        "Hold styr på de ryttere, du gerne vil køre med igen",
        "Opret private ture for venner, klubkammerater og træningsmakkere",
        "Gør ture offentlige, når nye ryttere skal kunne hoppe med",
        "Invitér de rigtige ryttere og hold gruppen samlet",
        "Importér en GPX-rute (valgfrit)",
        "Få push-besked ved vigtige turændringer"
      ]
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
      subtitle: "Fra mødesteder og invitationer til turhistorik og dybere Pro-indsigter.",
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
          title: "Ride Now eller planlæg frem",
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
          title: "Watt og træningszoner (Pro)",
          description: "Dyk ned i estimerede watt, zoner og præstation efter turen."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Toppræstationer (Pro)",
          description: "Følg dine bedste tider, længste ture, topfart og højeste watt."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Bliv beta-tester - få 6 måneder Pro",
      subtitle:
        "Vær med til at forme et cykelfællesskab bygget omkring venner, invitationer og ture. Som beta-tester får du 6 måneders Bike ME Pro, når appen lanceres officielt.",
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
            "Ja. De vigtigste sociale funktioner er gratis: find ryttere, opret ture, inviter andre og track dine ture. Bike ME Pro giver adgang til dybere historik, status, watt-estimering, træningszoner og udviklingsgrafer. Som beta-tester får du 6 måneders gratis Pro, når appen lanceres officielt."
        },
        {
          question: "Kan jeg teste Bike Me nu?",
          answer:
            "Ja. Bike Me er lige nu åben for iOS beta-testere via TestFlight. Alle beta-testere får 6 måneders gratis Bike Me Pro, når appen lanceres officielt."
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
      title: "Bike Me | Radcommunity über TestFlight",
      description:
        "Bike Me verbindet Radfreunde, Einladungen und private oder öffentliche Fahrten. Betatester erhalten 6 Monate Bike Me Pro kostenlos zum offiziellen Launch."
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
      headline: "Bleib mit deinen Radfreunden verbunden - und finde neue",
      subheadline:
        "Bike Me bringt deine Radkontakte, Fahrten und Einladungen an einem Ort zusammen. Erstelle private Fahrten für Freunde oder öffentliche Fahrten, bei denen neue Fahrer dazukommen können.",
      payoffTitle: "6 Monate Pro kostenlos für Betatester",
      payoffText:
        "Werde Betatester und hilf mit, die Radcommunity der Zukunft zu gestalten. Alle Betatester erhalten 6 Monate Bike Me Pro kostenlos, wenn die App offiziell startet. Erfordert ein iPhone und Apples TestFlight-App.",
      primaryCta: "Über TestFlight laden",
      secondaryCta: "So funktioniert's",
      previewLabel: "App-Vorschau"
    },
    brand: {
      intro: "Bike ME ist für Radfreunde, bekannte Gesichter und die nächste gemeinsame Fahrt gemacht",
      bullets: [
        "Behalte die Fahrer im Blick, mit denen du wieder fahren willst",
        "Erstelle private Fahrten für Freunde, Clubs und Trainingspartner",
        "Öffne Fahrten öffentlich, wenn neue Fahrer mitkommen sollen",
        "Lade die richtigen Fahrer ein und halte die Gruppe zusammen",
        "Importiere eine GPX-Route (optional)",
        "Erhalte Push-Benachrichtigungen bei wichtigen Fahrtänderungen"
      ]
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
      subtitle: "Von Treffpunkten und Einladungen bis zu Fahrtenhistorie und tieferen Pro-Einblicken.",
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
          title: "Watt und Trainingszonen (Pro)",
          description: "Tauche nach der Fahrt in geschätzte Watt, Zonen und Leistung ein."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Top-Leistungen (Pro)",
          description: "Verfolge Bestzeiten, längste Fahrten, Höchsttempo und höchste Wattwerte."
        }
      ]
    },
    pricing: {
      eyebrow: "Kostenlos vs Pro",
      title: "Werde Betatester - erhalte 6 Monate Pro",
      subtitle:
        "Hilf mit, eine Radcommunity rund um Freunde, Einladungen und Fahrten zu gestalten. Als Betatester erhältst du 6 Monate Bike ME Pro, wenn die App offiziell startet.",
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
            "Ja. Die wichtigsten sozialen Funktionen sind kostenlos: Fahrer finden, Fahrten erstellen, andere einladen und deine Touren tracken. Bike ME Pro bietet Zugriff auf tiefere Historie, Status, Watt-Schätzung, Trainingszonen und Fortschrittsgrafen. Als Betatester erhältst du 6 Monate Pro kostenlos, wenn die App offiziell startet."
        },
        {
          question: "Kann ich Bike Me jetzt testen?",
          answer:
            "Ja. Bike Me ist derzeit für iOS-Betatester über TestFlight geöffnet. Alle Betatester erhalten 6 Monate Bike Me Pro kostenlos, wenn die App offiziell startet."
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
      title: "Bike Me | Comunidad ciclista en TestFlight",
      description:
        "Bike Me reúne amigos ciclistas, invitaciones y salidas privadas o públicas. Los beta testers reciben 6 meses gratis de Bike Me Pro en el lanzamiento oficial."
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
      headline: "Mantén cerca a tus amigos ciclistas - y encuentra nuevos",
      subheadline:
        "Bike Me reúne tus contactos ciclistas, salidas e invitaciones en un solo lugar. Crea salidas privadas para tus amigos o salidas públicas para que se unan nuevos ciclistas.",
      payoffTitle: "6 meses de Pro gratis para beta testers",
      payoffText:
        "Hazte beta tester y ayuda a crear la comunidad ciclista del futuro. Todos los beta testers reciben 6 meses gratis de Bike Me Pro cuando la app se lance oficialmente. Requiere iPhone y la app TestFlight de Apple.",
      primaryCta: "Obtener vía TestFlight",
      secondaryCta: "Ver cómo funciona",
      previewLabel: "Vista de la app"
    },
    brand: {
      intro: "Bike ME está pensado para amigos ciclistas, contactos conocidos y la próxima salida juntos",
      bullets: [
        "Mantén cerca a los ciclistas con los que quieres volver a rodar",
        "Crea salidas privadas para amigos, clubes y compañeros de entrenamiento",
        "Haz salidas públicas cuando quieras que se unan nuevos ciclistas",
        "Invita a las personas adecuadas y mantén el grupo organizado",
        "Importa una ruta GPX (opcional)",
        "Recibe notificaciones push sobre cambios importantes de la salida"
      ]
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
      subtitle: "De puntos de encuentro e invitaciones a historial de salidas e insights Pro.",
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
          title: "Vatios y zonas (Pro)",
          description: "Profundiza en vatios estimados, zonas y rendimiento después de la salida."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Mejores marcas (Pro)",
          description: "Sigue tus mejores tiempos, salidas más largas, velocidad máxima y watt más alto."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Hazte beta tester - recibe 6 meses de Pro",
      subtitle:
        "Ayuda a crear una comunidad ciclista basada en amigos, invitaciones y salidas. Como beta tester, recibes 6 meses de Bike ME Pro cuando la app se lance oficialmente.",
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
            "Sí. Las funciones sociales clave son gratis: encuentra ciclistas, crea salidas, invita a otros y registra tus rutas. Bike ME Pro da acceso a más historial, estado, estimación de vatios, zonas de entrenamiento y gráficas de progreso. Como beta tester, recibes 6 meses gratis de Pro cuando la app se lance oficialmente."
        },
        {
          question: "¿Puedo probar Bike Me ahora?",
          answer:
            "Sí. Bike Me está abierta ahora para beta testers de iOS vía TestFlight. Todos los beta testers reciben 6 meses gratis de Bike Me Pro cuando la app se lance oficialmente."
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
      title: "Bike Me | Community ciclistica su TestFlight",
      description:
        "Bike Me riunisce amici ciclisti, inviti e uscite private o pubbliche. I beta tester ricevono 6 mesi gratuiti di Bike Me Pro al lancio ufficiale."
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
      headline: "Resta vicino ai tuoi amici ciclisti - e trovane di nuovi",
      subheadline:
        "Bike Me riunisce contatti ciclistici, uscite e inviti in un unico posto. Crea uscite private per gli amici o uscite pubbliche dove nuovi ciclisti possono unirsi.",
      payoffTitle: "6 mesi di Pro gratis per i beta tester",
      payoffText:
        "Diventa beta tester e aiutaci a creare la community ciclistica del futuro. Tutti i beta tester ricevono 6 mesi gratuiti di Bike Me Pro quando l'app verrà lanciata ufficialmente. Richiede iPhone e l'app TestFlight di Apple.",
      primaryCta: "Scarica via TestFlight",
      secondaryCta: "Scopri come funziona",
      previewLabel: "Anteprima app"
    },
    brand: {
      intro: "Bike ME nasce per amici ciclisti, contatti conosciuti e la prossima uscita insieme",
      bullets: [
        "Tieni vicini i ciclisti con cui vuoi pedalare ancora",
        "Crea uscite private per amici, club e compagni di allenamento",
        "Rendi pubbliche le uscite quando vuoi invitare nuovi ciclisti",
        "Invita i ciclisti giusti e tieni il gruppo allineato",
        "Importa un percorso GPX (opzionale)",
        "Ricevi notifiche push per i cambiamenti importanti dell'uscita"
      ]
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
      subtitle: "Da punti di ritrovo e inviti allo storico uscite e agli insight Pro.",
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
          title: "Watt e zone (Pro)",
          description: "Approfondisci watt stimati, zone e prestazione dopo l'uscita."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Migliori prestazioni (Pro)",
          description: "Segui migliori tempi, uscite più lunghe, velocità massima e watt più alto."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Diventa beta tester - ricevi 6 mesi di Pro",
      subtitle:
        "Aiuta a creare una community ciclistica basata su amici, inviti e uscite. Come beta tester ricevi 6 mesi di Bike ME Pro quando l'app verrà lanciata ufficialmente.",
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
            "Sì. Le funzioni social principali sono gratuite: trova ciclisti, crea uscite, invita altri e traccia le tue pedalate. Bike ME Pro dà accesso a storico più profondo, stato, stima dei watt, zone di allenamento e grafici di progresso. Come beta tester ricevi 6 mesi gratuiti di Pro quando l'app verrà lanciata ufficialmente."
        },
        {
          question: "Posso testare Bike Me ora?",
          answer:
            "Sì. Bike Me è attualmente aperta ai beta tester iOS tramite TestFlight. Tutti i beta tester ricevono 6 mesi gratuiti di Bike Me Pro quando l'app verrà lanciata ufficialmente."
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
      title: "Bike Me | Communauté cycliste sur TestFlight",
      description:
        "Bike Me rassemble amis cyclistes, invitations et sorties privées ou publiques. Les bêta-testeurs reçoivent 6 mois gratuits de Bike Me Pro au lancement officiel."
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
      headline: "Gardez vos amis cyclistes près de vous - et trouvez-en de nouveaux",
      subheadline:
        "Bike Me réunit vos contacts cyclistes, sorties et invitations au même endroit. Créez des sorties privées pour vos amis ou des sorties publiques où de nouveaux cyclistes peuvent vous rejoindre.",
      payoffTitle: "6 mois de Pro gratuits pour les bêta-testeurs",
      payoffText:
        "Devenez bêta-testeur et contribuez à créer la communauté cycliste de demain. Tous les bêta-testeurs reçoivent 6 mois gratuits de Bike Me Pro lorsque l'app sera lancée officiellement. Nécessite un iPhone et l'app TestFlight d'Apple.",
      primaryCta: "Obtenir via TestFlight",
      secondaryCta: "Voir le fonctionnement",
      previewLabel: "Aperçu de l'app"
    },
    brand: {
      intro: "Bike ME est conçu pour les amis cyclistes, les contacts retrouvés et la prochaine sortie ensemble",
      bullets: [
        "Gardez le contact avec les cyclistes que vous voulez revoir",
        "Créez des sorties privées pour amis, clubs et partenaires d'entraînement",
        "Ouvrez des sorties publiques quand de nouveaux cyclistes peuvent rejoindre",
        "Invitez les bons cyclistes et gardez le groupe aligné",
        "Importez un itinéraire GPX (optionnel)",
        "Recevez des notifications push en cas de changement important de sortie"
      ]
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
      subtitle: "Des lieux de rendez-vous et invitations à l'historique des sorties et aux insights Pro.",
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
          title: "Watts et zones (Pro)",
          description: "Explorez watts estimés, zones et performance après la sortie."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Meilleures performances (Pro)",
          description: "Suivez meilleurs temps, plus longues sorties, vitesse max et watts les plus élevés."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratuit vs Pro",
      title: "Devenez bêta-testeur - recevez 6 mois de Pro",
      subtitle:
        "Aidez à créer une communauté cycliste autour des amis, invitations et sorties. En tant que bêta-testeur, vous recevez 6 mois de Bike ME Pro lorsque l'app sera lancée officiellement.",
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
            "Oui. Les fonctions sociales clés sont gratuites : trouver des cyclistes, créer des sorties, inviter d'autres personnes et suivre vos sorties. Bike ME Pro donne accès à un historique plus profond, au statut, à l'estimation des watts, aux zones d'entraînement et aux graphiques de progression. En tant que bêta-testeur, vous recevez 6 mois gratuits de Pro lorsque l'app sera lancée officiellement."
        },
        {
          question: "Puis-je tester Bike Me maintenant ?",
          answer:
            "Oui. Bike Me est actuellement ouverte aux bêta-testeurs iOS via TestFlight. Tous les bêta-testeurs reçoivent 6 mois gratuits de Bike Me Pro lorsque l'app sera lancée officiellement."
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
      title: "Bike Me | Fietscommunity via TestFlight",
      description:
        "Bike Me brengt fietsvrienden, uitnodigingen en private of openbare ritten samen. Betatesters krijgen 6 maanden gratis Bike Me Pro bij de officiële lancering."
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
      headline: "Houd je fietsvrienden dichtbij - en vind nieuwe",
      subheadline:
        "Bike Me brengt je fietscontacten, ritten en uitnodigingen op één plek samen. Maak private ritten voor vrienden of openbare ritten waar nieuwe fietsers kunnen aansluiten.",
      payoffTitle: "6 maanden gratis Pro voor betatesters",
      payoffText:
        "Word betatester en help mee aan de fietscommunity van de toekomst. Alle betatesters krijgen 6 maanden gratis Bike Me Pro wanneer de app officieel wordt gelanceerd. Vereist iPhone en Apple's TestFlight-app.",
      primaryCta: "Download via TestFlight",
      secondaryCta: "Bekijk hoe het werkt",
      previewLabel: "App-preview"
    },
    brand: {
      intro: "Bike ME is gebouwd voor fietsvrienden, bekende gezichten en de volgende rit samen",
      bullets: [
        "Houd de fietsers bij met wie je opnieuw wilt rijden",
        "Maak private ritten voor vrienden, clubs en trainingsmaatjes",
        "Zet ritten openbaar wanneer nieuwe fietsers mogen aansluiten",
        "Nodig de juiste fietsers uit en houd de groep op één lijn",
        "Importeer een GPX-route (optioneel)",
        "Ontvang pushmeldingen bij belangrijke ritwijzigingen"
      ]
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
      subtitle: "Van ontmoetingsplekken en uitnodigingen tot ritgeschiedenis en diepere Pro-inzichten.",
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
          title: "Watt en trainingszones (Pro)",
          description: "Duik in geschatte watt, zones en prestaties na de rit."
        },
        {
          image: "/screenshots/app-15.png",
          title: "Topprestaties (Pro)",
          description: "Volg je beste tijden, langste ritten, topsnelheid en hoogste watt."
        }
      ]
    },
    pricing: {
      eyebrow: "Gratis vs Pro",
      title: "Word betatester - krijg 6 maanden Pro",
      subtitle:
        "Help mee aan een fietscommunity rond vrienden, uitnodigingen en ritten. Als betatester krijg je 6 maanden Bike ME Pro wanneer de app officieel wordt gelanceerd.",
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
            "Ja. De belangrijkste sociale functies zijn gratis: vind fietsers, maak ritten, nodig anderen uit en track je ritten. Bike ME Pro geeft toegang tot diepere historie, status, wattinschatting, trainingszones en voortgangsgrafieken. Als betatester krijg je 6 maanden gratis Pro wanneer de app officieel wordt gelanceerd."
        },
        {
          question: "Kan ik Bike Me nu testen?",
          answer:
            "Ja. Bike Me is momenteel open voor iOS-betatesters via TestFlight. Alle betatesters krijgen 6 maanden gratis Bike Me Pro wanneer de app officieel wordt gelanceerd."
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
