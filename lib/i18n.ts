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

type AndroidTesterSection = {
  banner: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
  };
  page: {
    metaTitle: string;
    metaDescription: string;
    openGraphImageAlt: string;
    backToHome: string;
    formHeading: string;
  };
  eyebrow: string;
  title: string;
  body: string;
  rewardEyebrow: string;
  rewardBadge: string;
  rewardNote: string;
  formTitle: string;
  formText: string;
  requiredNote: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailHint: string;
  deviceLabel: string;
  devicePlaceholder: string;
  versionLabel: string;
  selectPrompt: string;
  versionEarlier: string;
  versionOther: string;
  versionUnknown: string;
  frequencyLabel: string;
  frequencyPrompt: string;
  frequencyOptions: {
    daily: string;
    severalWeekly: string;
    weekly: string;
    monthly: string;
    rarely: string;
  };
  commentLabel: string;
  commentPlaceholder: string;
  commitmentLabel: string;
  privacyPrefix: string;
  privacyLink: string;
  privacySuffix: string;
  submissionNote: string;
  submit: string;
  submitting: string;
  technicalError: string;
  successTitle: string;
  success: string;
  honeypotLabel: string;
  validation: {
    required: string;
    invalidName: string;
    invalidEmail: string;
    invalidDevice: string;
    invalidSelection: string;
    commentTooLong: string;
    commitmentRequired: string;
    privacyRequired: string;
  };
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
    languageSwitcherLabel: string;
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
  androidTester: AndroidTesterSection;
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
      faq: "FAQ",
      languageSwitcherLabel: "Choose language"
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
          image: "/screenshots/app-01.png",
          title: "Join the community",
          description: "Create a profile and start building your cycling network."
        },
        {
          image: "/screenshots/app-02.png",
          title: "Map and meeting points",
          description: "See fixed meeting points, nearby rides, and where your next group can start."
        },
        {
          image: "/screenshots/app-03.png",
          title: "Meeting point details",
          description: "Check activity, upcoming rides, and create a ride from a known spot."
        },
        {
          image: "/screenshots/app-04.png",
          title: "Ride Now or plan ahead",
          description: "Choose whether the ride starts soon or is planned for later."
        },
        {
          image: "/screenshots/app-05.png",
          title: "Create and invite",
          description: "Set the ride up and invite the riders you want with you."
        },
        {
          image: "/screenshots/app-06.png",
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
    androidTester: {
      banner: {
        eyebrow: "Android early access",
        title: "Bike Me is coming to Android",
        body: "Join us in testing the new Bike Me app on your Android phone.",
        cta: "Join the Android test"
      },
      page: {
        metaTitle: "Join the Android test | Bike Me",
        metaDescription:
          "Join the Bike Me Android test and help us test the app on your Android phone.",
        openGraphImageAlt: "Preview of Bike Me",
        backToHome: "Back to home",
        formHeading: "Your tester details"
      },
      eyebrow: "Android testers wanted",
      title: "Test Bike Me for Android – and get 1 year of full access",
      body:
        "Do you have an Android phone? Help us test Bike Me before the app is released. As a thank-you for taking part and sharing feedback, active testers receive one year of full access to the entire app.",
      rewardEyebrow: "A thank-you for active participation",
      rewardBadge: "1 year of full access",
      rewardNote:
        "Full access is granted after you have actively taken part in the test and shared feedback. Signing up does not give immediate access.",
      formTitle: "Join the Android test",
      formText: "Complete the form and we will contact you with information about the testing process.",
      requiredNote: "Fields marked with * are required.",
      nameLabel: "Name",
      namePlaceholder: "Your name",
      emailLabel: "Google Play email",
      emailPlaceholder: "you@example.com",
      emailHint: "Use the email address connected to your Google Play account.",
      deviceLabel: "Phone brand and model",
      devicePlaceholder: "For example, Google Pixel 9",
      versionLabel: "Android version",
      selectPrompt: "Select Android version",
      versionEarlier: "Android 11 or earlier",
      versionOther: "Other version",
      versionUnknown: "I don't know",
      frequencyLabel: "How often do you cycle? (optional)",
      frequencyPrompt: "Choose an answer",
      frequencyOptions: {
        daily: "Every day or almost every day",
        severalWeekly: "Several times a week",
        weekly: "About once a week",
        monthly: "A few times a month",
        rarely: "Less often"
      },
      commentLabel: "Message or relevant comments (optional)",
      commentPlaceholder: "Anything we should know about your phone or how you cycle?",
      commitmentLabel: "I understand that I am expected to install the test version and share feedback.",
      privacyPrefix: "I have read the ",
      privacyLink: "privacy policy",
      privacySuffix: ".",
      submissionNote:
        "Submitting this form registers you for the testing process. It does not provide immediate access to the reward.",
      submit: "Sign up for the Android test",
      submitting: "Sending your sign-up…",
      technicalError: "We could not send your sign-up right now. Your information is still in the form, so please try again shortly.",
      successTitle: "You're signed up",
      success: "Thank you for signing up! We will contact you at your Google Play email when the Android test is ready.",
      honeypotLabel: "Company website",
      validation: {
        required: "Please complete this field.",
        invalidName: "Enter a name between 2 and 100 characters.",
        invalidEmail: "Enter a valid email address.",
        invalidDevice: "Enter a phone brand and model between 2 and 120 characters.",
        invalidSelection: "Choose one of the available options.",
        commentTooLong: "Keep your message under 1,000 characters.",
        commitmentRequired: "Please confirm that you can install the test version and share feedback.",
        privacyRequired: "Please confirm that you have read the privacy policy."
      }
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
      faq: "FAQ",
      languageSwitcherLabel: "Vælg sprog"
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
          image: "/screenshots/app-01.png",
          title: "Bliv en del af fællesskabet",
          description: "Opret din profil og begynd at samle dine cykelbekendtskaber."
        },
        {
          image: "/screenshots/app-02.png",
          title: "Kort og faste mødesteder",
          description: "Se faste mødesteder, ture i nærheden og hvor næste fællestur kan starte."
        },
        {
          image: "/screenshots/app-03.png",
          title: "Detaljer om mødested",
          description: "Se aktivitet, kommende ture og opret en tur fra et kendt spot."
        },
        {
          image: "/screenshots/app-04.png",
          title: "KØR NU eller planlæg frem",
          description: "Vælg om turen starter snart eller planlægges til senere."
        },
        {
          image: "/screenshots/app-05.png",
          title: "Opret og invitér",
          description: "Sæt turen op og invitér de ryttere, du gerne vil have med."
        },
        {
          image: "/screenshots/app-06.png",
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
    androidTester: {
      banner: {
        eyebrow: "Android early access",
        title: "Bike Me kommer til Android",
        body: "Kom og vær med til at teste den nye Bike Me-app på din Android-mobil.",
        cta: "Tilmeld dig Android-testen"
      },
      page: {
        metaTitle: "Tilmeld dig Android-testen | Bike Me",
        metaDescription:
          "Tilmeld dig Bike Mes Android-test, og hjælp os med at teste appen på din Android-mobil.",
        openGraphImageAlt: "Forhåndsvisning af Bike Me",
        backToHome: "Tilbage til forsiden",
        formHeading: "Dine testeroplysninger"
      },
      eyebrow: "Android-testere søges",
      title: "Test Bike Me til Android – og få 1 års fuld adgang",
      body:
        "Har du en Android-telefon? Hjælp os med at teste Bike Me, inden appen bliver udgivet. Som tak for din deltagelse og feedback får aktive testere 1 års fuld adgang til hele appen.",
      rewardEyebrow: "Som tak for din aktive deltagelse",
      rewardBadge: "1 års fuld adgang",
      rewardNote:
        "Den fulde adgang gives, når du aktivt har deltaget i testen og delt feedback. Tilmelding giver ikke øjeblikkelig adgang.",
      formTitle: "Tilmeld dig Android-testen",
      formText: "Udfyld formularen, så kontakter vi dig med information om testforløbet.",
      requiredNote: "Felter markeret med * skal udfyldes.",
      nameLabel: "Navn",
      namePlaceholder: "Dit navn",
      emailLabel: "Google Play-e-mail",
      emailPlaceholder: "dig@eksempel.dk",
      emailHint: "Brug den e-mailadresse, der er knyttet til din Google Play-konto.",
      deviceLabel: "Telefonens mærke og model",
      devicePlaceholder: "Fx Google Pixel 9",
      versionLabel: "Android-version",
      selectPrompt: "Vælg Android-version",
      versionEarlier: "Android 11 eller ældre",
      versionOther: "Anden version",
      versionUnknown: "Det ved jeg ikke",
      frequencyLabel: "Hvor ofte cykler du? (valgfrit)",
      frequencyPrompt: "Vælg et svar",
      frequencyOptions: {
        daily: "Hver dag eller næsten hver dag",
        severalWeekly: "Flere gange om ugen",
        weekly: "Cirka én gang om ugen",
        monthly: "Et par gange om måneden",
        rarely: "Sjældnere"
      },
      commentLabel: "Kort besked eller relevante kommentarer (valgfrit)",
      commentPlaceholder: "Er der noget, vi bør vide om din telefon eller dine cykelvaner?",
      commitmentLabel: "Jeg er indforstået med, at jeg forventes at installere testversionen og dele feedback.",
      privacyPrefix: "Jeg har læst ",
      privacyLink: "privatlivspolitikken",
      privacySuffix: ".",
      submissionNote:
        "Når du sender formularen, tilmelder du dig testforløbet. Det giver ikke øjeblikkelig adgang til belønningen.",
      submit: "Tilmeld mig Android-testen",
      submitting: "Sender din tilmelding…",
      technicalError: "Vi kunne ikke sende din tilmelding lige nu. Dine oplysninger står stadig i formularen, så prøv igen om lidt.",
      successTitle: "Du er tilmeldt",
      success: "Tak for din tilmelding! Vi kontakter dig på din Google Play-e-mail, når Android-testen er klar.",
      honeypotLabel: "Virksomhedens hjemmeside",
      validation: {
        required: "Udfyld venligst feltet.",
        invalidName: "Skriv et navn på mellem 2 og 100 tegn.",
        invalidEmail: "Skriv en gyldig e-mailadresse.",
        invalidDevice: "Skriv telefonens mærke og model med mellem 2 og 120 tegn.",
        invalidSelection: "Vælg en af de tilgængelige muligheder.",
        commentTooLong: "Hold beskeden under 1.000 tegn.",
        commitmentRequired: "Bekræft, at du kan installere testversionen og dele feedback.",
        privacyRequired: "Bekræft, at du har læst privatlivspolitikken."
      }
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
      faq: "FAQ",
      languageSwitcherLabel: "Sprache wählen"
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
          image: "/screenshots/app-01.png",
          title: "Teil der Community werden",
          description: "Erstelle dein Profil und baue dein Radnetzwerk auf."
        },
        {
          image: "/screenshots/app-02.png",
          title: "Karte und feste Treffpunkte",
          description: "Sieh feste Treffpunkte, Fahrten in der Nähe und wo die nächste Gruppe starten kann."
        },
        {
          image: "/screenshots/app-03.png",
          title: "Treffpunktdetails",
          description: "Sieh Aktivität, kommende Fahrten und erstelle eine Fahrt von einem bekannten Ort."
        },
        {
          image: "/screenshots/app-04.png",
          title: "Ride Now oder vorausplanen",
          description: "Wähle, ob die Fahrt bald startet oder für später geplant wird."
        },
        {
          image: "/screenshots/app-05.png",
          title: "Erstellen und einladen",
          description: "Richte die Fahrt ein und lade die Fahrer ein, die du dabeihaben möchtest."
        },
        {
          image: "/screenshots/app-06.png",
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
    androidTester: {
      banner: {
        eyebrow: "Android-Frühzugang",
        title: "Bike Me kommt für Android",
        body: "Teste gemeinsam mit uns die neue Bike Me-App auf deinem Android-Smartphone.",
        cta: "Für den Android-Test anmelden"
      },
      page: {
        metaTitle: "Für den Android-Test anmelden | Bike Me",
        metaDescription:
          "Melde dich für den Android-Test von Bike Me an und hilf uns, die App auf deinem Android-Smartphone zu testen.",
        openGraphImageAlt: "Vorschau von Bike Me",
        backToHome: "Zur Startseite",
        formHeading: "Deine Angaben für den Test"
      },
      eyebrow: "Android-Tester gesucht",
      title: "Teste Bike Me für Android – und erhalte 1 Jahr vollen Zugang",
      body:
        "Hast du ein Android-Smartphone? Hilf uns, Bike Me vor der Veröffentlichung zu testen. Als Dank für die aktive Teilnahme und dein Feedback erhältst du ein Jahr lang vollen Zugang zur gesamten App.",
      rewardEyebrow: "Unser Dank für deine aktive Teilnahme",
      rewardBadge: "1 Jahr voller Zugang",
      rewardNote:
        "Der volle Zugang wird gewährt, nachdem du aktiv am Test teilgenommen und Feedback gegeben hast. Die Anmeldung allein schaltet ihn nicht sofort frei.",
      formTitle: "Für den Android-Test anmelden",
      formText: "Fülle das Formular aus. Wir melden uns dann mit Informationen zum Testablauf bei dir.",
      requiredNote: "Mit * gekennzeichnete Felder sind Pflichtfelder.",
      nameLabel: "Name",
      namePlaceholder: "Dein Name",
      emailLabel: "Google-Play-E-Mail",
      emailPlaceholder: "du@beispiel.de",
      emailHint: "Verwende die E-Mail-Adresse, die mit deinem Google-Play-Konto verknüpft ist.",
      deviceLabel: "Marke und Modell des Smartphones",
      devicePlaceholder: "Zum Beispiel Google Pixel 9",
      versionLabel: "Android-Version",
      selectPrompt: "Android-Version auswählen",
      versionEarlier: "Android 11 oder älter",
      versionOther: "Andere Version",
      versionUnknown: "Ich weiß es nicht",
      frequencyLabel: "Wie oft fährst du Rad? (optional)",
      frequencyPrompt: "Antwort auswählen",
      frequencyOptions: {
        daily: "Jeden oder fast jeden Tag",
        severalWeekly: "Mehrmals pro Woche",
        weekly: "Etwa einmal pro Woche",
        monthly: "Ein paar Mal pro Monat",
        rarely: "Seltener"
      },
      commentLabel: "Kurze Nachricht oder relevante Hinweise (optional)",
      commentPlaceholder: "Gibt es etwas, das wir über dein Smartphone oder deine Radfahrgewohnheiten wissen sollten?",
      commitmentLabel: "Mir ist bewusst, dass von mir erwartet wird, die Testversion zu installieren und Feedback zu geben.",
      privacyPrefix: "Ich habe die ",
      privacyLink: "Datenschutzerklärung",
      privacySuffix: " gelesen.",
      submissionNote:
        "Mit dem Absenden meldest du dich für den Testablauf an. Du erhältst dadurch nicht sofort Zugang zur Belohnung.",
      submit: "Für den Android-Test anmelden",
      submitting: "Anmeldung wird gesendet…",
      technicalError: "Deine Anmeldung konnte gerade nicht gesendet werden. Deine Angaben stehen weiterhin im Formular. Bitte versuche es gleich noch einmal.",
      successTitle: "Du bist angemeldet",
      success: "Vielen Dank für deine Anmeldung! Wir kontaktieren dich über deine Google-Play-E-Mail, sobald der Android-Test bereit ist.",
      honeypotLabel: "Unternehmenswebsite",
      validation: {
        required: "Bitte fülle dieses Feld aus.",
        invalidName: "Gib einen Namen mit 2 bis 100 Zeichen ein.",
        invalidEmail: "Gib eine gültige E-Mail-Adresse ein.",
        invalidDevice: "Gib Marke und Modell mit 2 bis 120 Zeichen ein.",
        invalidSelection: "Wähle eine der verfügbaren Optionen.",
        commentTooLong: "Die Nachricht darf höchstens 1.000 Zeichen lang sein.",
        commitmentRequired: "Bestätige bitte, dass du die Testversion installieren und Feedback geben kannst.",
        privacyRequired: "Bestätige bitte, dass du die Datenschutzerklärung gelesen hast."
      }
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
      faq: "FAQ",
      languageSwitcherLabel: "Elegir idioma"
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
          image: "/screenshots/app-01.png",
          title: "Únete a la comunidad",
          description: "Crea tu perfil y empieza a construir tu red ciclista."
        },
        {
          image: "/screenshots/app-02.png",
          title: "Mapa y puntos de encuentro",
          description: "Ve puntos fijos, salidas cercanas y dónde puede empezar el próximo grupo."
        },
        {
          image: "/screenshots/app-03.png",
          title: "Detalles del punto de encuentro",
          description: "Consulta actividad, próximas salidas y crea una salida desde un lugar conocido."
        },
        {
          image: "/screenshots/app-04.png",
          title: "Ride Now o planificar",
          description: "Elige si la salida empieza pronto o se planifica para más tarde."
        },
        {
          image: "/screenshots/app-05.png",
          title: "Crear e invitar",
          description: "Configura la salida e invita a los ciclistas que quieres llevar contigo."
        },
        {
          image: "/screenshots/app-06.png",
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
    androidTester: {
      banner: {
        eyebrow: "Acceso anticipado para Android",
        title: "Bike Me llega a Android",
        body: "Ayúdanos a probar la nueva app de Bike Me en tu móvil Android.",
        cta: "Inscríbete en la prueba de Android"
      },
      page: {
        metaTitle: "Inscríbete en la prueba de Android | Bike Me",
        metaDescription:
          "Inscríbete en la prueba de Bike Me para Android y ayúdanos a probar la app en tu móvil Android.",
        openGraphImageAlt: "Vista previa de Bike Me",
        backToHome: "Volver al inicio",
        formHeading: "Tus datos para la prueba"
      },
      eyebrow: "Buscamos testers de Android",
      title: "Prueba Bike Me para Android y consigue 1 año de acceso completo",
      body:
        "¿Tienes un teléfono Android? Ayúdanos a probar Bike Me antes de su lanzamiento. Como agradecimiento por participar activamente y compartir tus comentarios, recibirás un año de acceso completo a toda la aplicación.",
      rewardEyebrow: "Nuestro agradecimiento por tu participación activa",
      rewardBadge: "1 año de acceso completo",
      rewardNote:
        "El acceso completo se concede después de participar activamente en la prueba y compartir comentarios. Inscribirte no te da acceso inmediato.",
      formTitle: "Inscríbete en la prueba de Android",
      formText: "Rellena el formulario y nos pondremos en contacto contigo con información sobre el proceso de prueba.",
      requiredNote: "Los campos marcados con * son obligatorios.",
      nameLabel: "Nombre",
      namePlaceholder: "Tu nombre",
      emailLabel: "Correo de Google Play",
      emailPlaceholder: "tu@ejemplo.com",
      emailHint: "Usa la dirección de correo vinculada a tu cuenta de Google Play.",
      deviceLabel: "Marca y modelo del teléfono",
      devicePlaceholder: "Por ejemplo, Google Pixel 9",
      versionLabel: "Versión de Android",
      selectPrompt: "Selecciona la versión de Android",
      versionEarlier: "Android 11 o anterior",
      versionOther: "Otra versión",
      versionUnknown: "No lo sé",
      frequencyLabel: "¿Con qué frecuencia montas en bicicleta? (opcional)",
      frequencyPrompt: "Elige una respuesta",
      frequencyOptions: {
        daily: "Todos o casi todos los días",
        severalWeekly: "Varias veces por semana",
        weekly: "Aproximadamente una vez por semana",
        monthly: "Varias veces al mes",
        rarely: "Con menor frecuencia"
      },
      commentLabel: "Mensaje breve o comentarios relevantes (opcional)",
      commentPlaceholder: "¿Hay algo que debamos saber sobre tu teléfono o tus hábitos ciclistas?",
      commitmentLabel: "Entiendo que se espera que instale la versión de prueba y comparta mis comentarios.",
      privacyPrefix: "He leído la ",
      privacyLink: "política de privacidad",
      privacySuffix: ".",
      submissionNote:
        "Al enviar el formulario te inscribes en el proceso de prueba. Esto no te da acceso inmediato a la recompensa.",
      submit: "Inscribirme en la prueba de Android",
      submitting: "Enviando tu inscripción…",
      technicalError: "No hemos podido enviar tu inscripción ahora. Tus datos siguen en el formulario; inténtalo de nuevo en unos instantes.",
      successTitle: "Te has inscrito",
      success: "¡Gracias por inscribirte! Nos pondremos en contacto contigo en tu correo de Google Play cuando la prueba de Android esté lista.",
      honeypotLabel: "Sitio web de la empresa",
      validation: {
        required: "Completa este campo.",
        invalidName: "Introduce un nombre de entre 2 y 100 caracteres.",
        invalidEmail: "Introduce una dirección de correo válida.",
        invalidDevice: "Introduce una marca y un modelo de entre 2 y 120 caracteres.",
        invalidSelection: "Elige una de las opciones disponibles.",
        commentTooLong: "El mensaje debe tener menos de 1.000 caracteres.",
        commitmentRequired: "Confirma que puedes instalar la versión de prueba y compartir comentarios.",
        privacyRequired: "Confirma que has leído la política de privacidad."
      }
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
      faq: "FAQ",
      languageSwitcherLabel: "Scegli la lingua"
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
          image: "/screenshots/app-01.png",
          title: "Entra nella community",
          description: "Crea il tuo profilo e inizia a costruire la tua rete ciclistica."
        },
        {
          image: "/screenshots/app-02.png",
          title: "Mappa e punti di ritrovo",
          description: "Vedi punti fissi, uscite vicine e dove può partire il prossimo gruppo."
        },
        {
          image: "/screenshots/app-03.png",
          title: "Dettagli del punto di ritrovo",
          description: "Controlla attività, uscite in arrivo e crea un'uscita da uno spot conosciuto."
        },
        {
          image: "/screenshots/app-04.png",
          title: "Ride Now o pianifica",
          description: "Scegli se l'uscita parte a breve o viene pianificata per dopo."
        },
        {
          image: "/screenshots/app-05.png",
          title: "Crea e invita",
          description: "Imposta l'uscita e invita i ciclisti che vuoi con te."
        },
        {
          image: "/screenshots/app-06.png",
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
    androidTester: {
      banner: {
        eyebrow: "Accesso anticipato Android",
        title: "Bike Me arriva su Android",
        body: "Unisciti a noi per testare la nuova app Bike Me sul tuo telefono Android.",
        cta: "Iscriviti al test Android"
      },
      page: {
        metaTitle: "Iscriviti al test Android | Bike Me",
        metaDescription:
          "Iscriviti al test Android di Bike Me e aiutaci a provare l'app sul tuo telefono Android.",
        openGraphImageAlt: "Anteprima di Bike Me",
        backToHome: "Torna alla home",
        formHeading: "I tuoi dati per il test"
      },
      eyebrow: "Cerchiamo tester Android",
      title: "Prova Bike Me per Android e ottieni 1 anno di accesso completo",
      body:
        "Hai un telefono Android? Aiutaci a testare Bike Me prima del lancio. Come ringraziamento per la partecipazione attiva e il feedback, riceverai un anno di accesso completo all'intera app.",
      rewardEyebrow: "Il nostro ringraziamento per la tua partecipazione attiva",
      rewardBadge: "1 anno di accesso completo",
      rewardNote:
        "L'accesso completo viene assegnato dopo aver partecipato attivamente al test e condiviso il feedback. L'iscrizione non dà accesso immediato.",
      formTitle: "Iscriviti al test Android",
      formText: "Compila il modulo e ti contatteremo con le informazioni sullo svolgimento del test.",
      requiredNote: "I campi contrassegnati con * sono obbligatori.",
      nameLabel: "Nome",
      namePlaceholder: "Il tuo nome",
      emailLabel: "E-mail di Google Play",
      emailPlaceholder: "tu@esempio.it",
      emailHint: "Usa l'indirizzo e-mail collegato al tuo account Google Play.",
      deviceLabel: "Marca e modello del telefono",
      devicePlaceholder: "Ad esempio, Google Pixel 9",
      versionLabel: "Versione Android",
      selectPrompt: "Seleziona la versione Android",
      versionEarlier: "Android 11 o precedente",
      versionOther: "Altra versione",
      versionUnknown: "Non lo so",
      frequencyLabel: "Quanto spesso vai in bicicletta? (facoltativo)",
      frequencyPrompt: "Scegli una risposta",
      frequencyOptions: {
        daily: "Ogni giorno o quasi",
        severalWeekly: "Più volte alla settimana",
        weekly: "Circa una volta alla settimana",
        monthly: "Alcune volte al mese",
        rarely: "Meno spesso"
      },
      commentLabel: "Breve messaggio o commenti utili (facoltativo)",
      commentPlaceholder: "C'è qualcosa che dovremmo sapere sul tuo telefono o sulle tue abitudini in bici?",
      commitmentLabel: "Sono consapevole che dovrò installare la versione di test e condividere il mio feedback.",
      privacyPrefix: "Ho letto l'",
      privacyLink: "informativa sulla privacy",
      privacySuffix: ".",
      submissionNote:
        "Inviando il modulo ti iscrivi al percorso di test. Questo non dà accesso immediato alla ricompensa.",
      submit: "Iscrivimi al test Android",
      submitting: "Invio dell'iscrizione…",
      technicalError: "Non è stato possibile inviare l'iscrizione. I tuoi dati sono ancora nel modulo: riprova tra poco.",
      successTitle: "Iscrizione completata",
      success: "Grazie per esserti iscritto! Ti contatteremo all'e-mail di Google Play quando il test Android sarà pronto.",
      honeypotLabel: "Sito web dell'azienda",
      validation: {
        required: "Compila questo campo.",
        invalidName: "Inserisci un nome tra 2 e 100 caratteri.",
        invalidEmail: "Inserisci un indirizzo e-mail valido.",
        invalidDevice: "Inserisci marca e modello tra 2 e 120 caratteri.",
        invalidSelection: "Scegli una delle opzioni disponibili.",
        commentTooLong: "Il messaggio deve contenere meno di 1.000 caratteri.",
        commitmentRequired: "Conferma di poter installare la versione di test e condividere il feedback.",
        privacyRequired: "Conferma di aver letto l'informativa sulla privacy."
      }
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
      faq: "FAQ",
      languageSwitcherLabel: "Choisir la langue"
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
          image: "/screenshots/app-01.png",
          title: "Rejoindre la communauté",
          description: "Créez votre profil et commencez à construire votre réseau cycliste."
        },
        {
          image: "/screenshots/app-02.png",
          title: "Carte et lieux de rendez-vous",
          description: "Voyez les points fixes, les sorties proches et où le prochain groupe peut partir."
        },
        {
          image: "/screenshots/app-03.png",
          title: "Détails du lieu de rendez-vous",
          description: "Consultez l'activité, les sorties à venir et créez une sortie depuis un spot connu."
        },
        {
          image: "/screenshots/app-04.png",
          title: "Ride Now ou planification",
          description: "Choisissez si la sortie démarre bientôt ou si elle est prévue plus tard."
        },
        {
          image: "/screenshots/app-05.png",
          title: "Créer et inviter",
          description: "Configurez la sortie et invitez les cyclistes que vous voulez avec vous."
        },
        {
          image: "/screenshots/app-06.png",
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
    androidTester: {
      banner: {
        eyebrow: "Accès anticipé Android",
        title: "Bike Me arrive sur Android",
        body: "Rejoignez-nous pour tester la nouvelle application Bike Me sur votre téléphone Android.",
        cta: "Inscrivez-vous au test Android"
      },
      page: {
        metaTitle: "Inscrivez-vous au test Android | Bike Me",
        metaDescription:
          "Inscrivez-vous au test Android de Bike Me et aidez-nous à tester l'application sur votre téléphone Android.",
        openGraphImageAlt: "Aperçu de Bike Me",
        backToHome: "Retour à l'accueil",
        formHeading: "Vos informations pour le test"
      },
      eyebrow: "Testeurs Android recherchés",
      title: "Testez Bike Me sur Android et bénéficiez d'un an d'accès complet",
      body:
        "Vous avez un téléphone Android ? Aidez-nous à tester Bike Me avant sa sortie. Pour vous remercier de votre participation active et de vos retours, vous bénéficierez d'un an d'accès complet à toute l'application.",
      rewardEyebrow: "Pour vous remercier de votre participation active",
      rewardBadge: "1 an d'accès complet",
      rewardNote:
        "L'accès complet est accordé après une participation active au test et le partage de retours. L'inscription ne donne pas un accès immédiat.",
      formTitle: "Inscrivez-vous au test Android",
      formText: "Remplissez le formulaire et nous vous contacterons avec les informations sur le déroulement du test.",
      requiredNote: "Les champs marqués d'un * sont obligatoires.",
      nameLabel: "Nom",
      namePlaceholder: "Votre nom",
      emailLabel: "E-mail Google Play",
      emailPlaceholder: "vous@exemple.fr",
      emailHint: "Utilisez l'adresse e-mail associée à votre compte Google Play.",
      deviceLabel: "Marque et modèle du téléphone",
      devicePlaceholder: "Par exemple, Google Pixel 9",
      versionLabel: "Version d'Android",
      selectPrompt: "Sélectionnez la version d'Android",
      versionEarlier: "Android 11 ou version antérieure",
      versionOther: "Autre version",
      versionUnknown: "Je ne sais pas",
      frequencyLabel: "À quelle fréquence faites-vous du vélo ? (facultatif)",
      frequencyPrompt: "Choisissez une réponse",
      frequencyOptions: {
        daily: "Tous les jours ou presque",
        severalWeekly: "Plusieurs fois par semaine",
        weekly: "Environ une fois par semaine",
        monthly: "Quelques fois par mois",
        rarely: "Moins souvent"
      },
      commentLabel: "Court message ou remarques utiles (facultatif)",
      commentPlaceholder: "Y a-t-il quelque chose à savoir sur votre téléphone ou vos habitudes cyclistes ?",
      commitmentLabel: "Je comprends que je devrai installer la version de test et partager mes retours.",
      privacyPrefix: "J'ai lu la ",
      privacyLink: "politique de confidentialité",
      privacySuffix: ".",
      submissionNote:
        "En envoyant ce formulaire, vous vous inscrivez au programme de test. Cela ne donne pas un accès immédiat à la récompense.",
      submit: "M'inscrire au test Android",
      submitting: "Envoi de votre inscription…",
      technicalError: "Nous n'avons pas pu envoyer votre inscription. Vos informations sont toujours dans le formulaire ; veuillez réessayer dans quelques instants.",
      successTitle: "Votre inscription est enregistrée",
      success: "Merci pour votre inscription ! Nous vous contacterons à votre adresse e-mail Google Play lorsque le test Android sera prêt.",
      honeypotLabel: "Site web de l'entreprise",
      validation: {
        required: "Veuillez remplir ce champ.",
        invalidName: "Saisissez un nom de 2 à 100 caractères.",
        invalidEmail: "Saisissez une adresse e-mail valide.",
        invalidDevice: "Saisissez une marque et un modèle de 2 à 120 caractères.",
        invalidSelection: "Choisissez l'une des options proposées.",
        commentTooLong: "Votre message doit contenir moins de 1 000 caractères.",
        commitmentRequired: "Confirmez que vous pouvez installer la version de test et partager vos retours.",
        privacyRequired: "Confirmez avoir lu la politique de confidentialité."
      }
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
      faq: "FAQ",
      languageSwitcherLabel: "Taal kiezen"
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
          image: "/screenshots/app-01.png",
          title: "Word deel van de community",
          description: "Maak je profiel aan en begin met het opbouwen van je fietsnetwerk."
        },
        {
          image: "/screenshots/app-02.png",
          title: "Kaart en vaste ontmoetingsplekken",
          description: "Zie vaste plekken, ritten in de buurt en waar je volgende groep kan starten."
        },
        {
          image: "/screenshots/app-03.png",
          title: "Details van ontmoetingsplek",
          description: "Bekijk activiteit, komende ritten en maak een rit vanaf een bekende plek."
        },
        {
          image: "/screenshots/app-04.png",
          title: "Ride Now of vooruit plannen",
          description: "Kies of de rit binnenkort start of later wordt gepland."
        },
        {
          image: "/screenshots/app-05.png",
          title: "Maak en nodig uit",
          description: "Stel de rit in en nodig de fietsers uit die je erbij wilt hebben."
        },
        {
          image: "/screenshots/app-06.png",
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
    androidTester: {
      banner: {
        eyebrow: "Vroege toegang voor Android",
        title: "Bike Me komt naar Android",
        body: "Help mee de nieuwe Bike Me-app op je Android-telefoon te testen.",
        cta: "Meld je aan voor de Android-test"
      },
      page: {
        metaTitle: "Meld je aan voor de Android-test | Bike Me",
        metaDescription:
          "Meld je aan voor de Android-test van Bike Me en help de app op je Android-telefoon te testen.",
        openGraphImageAlt: "Voorbeeld van Bike Me",
        backToHome: "Terug naar home",
        formHeading: "Je gegevens voor de test"
      },
      eyebrow: "Android-testers gezocht",
      title: "Test Bike Me voor Android en krijg 1 jaar volledige toegang",
      body:
        "Heb je een Android-telefoon? Help ons Bike Me te testen voordat de app wordt uitgebracht. Als dank voor je actieve deelname en feedback krijg je een jaar volledige toegang tot de hele app.",
      rewardEyebrow: "Onze dank voor je actieve deelname",
      rewardBadge: "1 jaar volledige toegang",
      rewardNote:
        "De volledige toegang wordt toegekend nadat je actief aan de test hebt deelgenomen en feedback hebt gedeeld. Aanmelden geeft niet direct toegang.",
      formTitle: "Meld je aan voor de Android-test",
      formText: "Vul het formulier in. We nemen daarna contact met je op met informatie over het testtraject.",
      requiredNote: "Velden met een * zijn verplicht.",
      nameLabel: "Naam",
      namePlaceholder: "Je naam",
      emailLabel: "Google Play-e-mailadres",
      emailPlaceholder: "jij@voorbeeld.nl",
      emailHint: "Gebruik het e-mailadres dat aan je Google Play-account is gekoppeld.",
      deviceLabel: "Merk en model van je telefoon",
      devicePlaceholder: "Bijvoorbeeld Google Pixel 9",
      versionLabel: "Android-versie",
      selectPrompt: "Kies je Android-versie",
      versionEarlier: "Android 11 of ouder",
      versionOther: "Andere versie",
      versionUnknown: "Dat weet ik niet",
      frequencyLabel: "Hoe vaak fiets je? (optioneel)",
      frequencyPrompt: "Kies een antwoord",
      frequencyOptions: {
        daily: "Elke of bijna elke dag",
        severalWeekly: "Meerdere keren per week",
        weekly: "Ongeveer één keer per week",
        monthly: "Een paar keer per maand",
        rarely: "Minder vaak"
      },
      commentLabel: "Kort bericht of relevante opmerkingen (optioneel)",
      commentPlaceholder: "Is er iets dat we over je telefoon of fietsgewoonten moeten weten?",
      commitmentLabel: "Ik begrijp dat van mij wordt verwacht dat ik de testversie installeer en feedback deel.",
      privacyPrefix: "Ik heb het ",
      privacyLink: "privacybeleid",
      privacySuffix: " gelezen.",
      submissionNote:
        "Door het formulier te verzenden meld je je aan voor het testtraject. Dit geeft niet direct toegang tot de beloning.",
      submit: "Aanmelden voor de Android-test",
      submitting: "Je aanmelding wordt verzonden…",
      technicalError: "We konden je aanmelding nu niet verzenden. Je gegevens staan nog in het formulier; probeer het zo nog eens.",
      successTitle: "Je bent aangemeld",
      success: "Bedankt voor je aanmelding! We nemen contact op via je Google Play-e-mailadres wanneer de Android-test klaar is.",
      honeypotLabel: "Bedrijfswebsite",
      validation: {
        required: "Vul dit veld in.",
        invalidName: "Vul een naam van 2 tot 100 tekens in.",
        invalidEmail: "Vul een geldig e-mailadres in.",
        invalidDevice: "Vul een merk en model van 2 tot 120 tekens in.",
        invalidSelection: "Kies een van de beschikbare opties.",
        commentTooLong: "Houd je bericht onder de 1.000 tekens.",
        commitmentRequired: "Bevestig dat je de testversie kunt installeren en feedback kunt delen.",
        privacyRequired: "Bevestig dat je het privacybeleid hebt gelezen."
      }
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
