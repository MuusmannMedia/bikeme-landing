# Fælles servergrundlag for klubbesøg

Leveret 16. november 2026, **kun** til `bike-me-clubs-test` / `bcskqapoagflshewvzzc`. Ingen produktion, webgrænseflade eller nye iOS-skærme. Alle fire serverflag er efterladt `false`.

## Migrationskilde og historik

`backend/supabase/migrations/` er den fælles kilde til **nye** databasekontrakter for både web og fremtidig iOS. Nye ændringer tilføjes fremadrettet; anvendte filer omskrives aldrig. Denne leverance anvender 0070 → 0071 → 0072 → 0073 → 0074.

`backend/supabase/baseline/migrations/` er et byteidentisk arkiv af de 62 migrationsfiler i det frosne iOS-grundlag, `/Users/mortenmuusmann/Projects/Bike Me App Store Candidate 20261111`. SHA-256 findes i `supabase/BASELINE-SHA256.json`. Arkivet er dokumentation, ikke en kø til automatisk replay. Det frosne grundlag er ikke ændret.

Testprojektets faktiske migrationshistorik er gemt før ændringen i `review/server-visitors-20261116/preflight.json`. Historiske 0001–0035 samt 0058, 0059 og 0066 er ikke registreret med disse filversioner i testhistorikken. De aktive blokkeringsfunktioner findes alligevel. Historikken er hverken repareret eller ombaseret. Kør **ikke** et generisk `supabase db push` over arkivet. En frisk installation kræver særskilt baselineafklaring; disse forward-migrationer forudsætter de allerede kontrollerede klub-, chat-, profil-, moderation- og blokkeringskontrakter.

`scripts/apply-test-migration.cjs` tillader kun leverancens fem versioner, afviser allerede registrerede versioner og bekræfter projekt-ID og projektnavn. SQL og historikkvittering lagres i samme transaktion. Kvitteringer med SHA-256 ligger i reviewmappen. Værktøjet har intet produktionsmål.

## Adgang og private standarder

Alle otte nye tabeller ligger i `club_private`, har RLS og ingen direkte klientrettigheder. Nye offentlige RPC'er er kun eksekverbare af `authenticated`; hver RPC håndhæver frisk identitet, stopflag og relevante klubroller/adgangsregler. Ingen anonyme besøgende. Ingen ny direkte læseadgang til `clubs`, `club_members`, `rides`, chat, opslag eller Storage.

En eksisterende klub har ingen besøgsprofil og ingen synlige ture. Ejer/admin skal aktivt publicere en separat, godkendt profiltekst og vælge cover/logo og ansøgninger. Navn, tekst, billedreferencer og rammer lagres som et snapshot. Senere profilredigering fra en gammel iOS-klient ændrer ikke automatisk det publicerede snapshot. Medlemsliste, opslag, chat, deltagere, præcist mødested, koordinater, ruter og GPX åbnes aldrig af disse kontrakter. Fritekst til besøgende skal også redaktionelt holdes fri for disse oplysninger; serveren kan ikke afgøre, om en admin skriver en adresse ind i en godkendt tekst.

`club_private.visit_flags` har serverstyrede `visits`, `applications`, `rides`, `images`. `visits=false` lukker alle nye kontrakter; de øvrige flag lukker deres egne funktioner. Ingen klientsetter. Der er ingen automatisk aktivering efter migration eller oprydning. Flagændring udsender revisionssignal. Den operative stopprocedure findes i `supabase/stop-visitors-test.sql`.

## RPC-kontrakter

Parameternavne nedenfor er de faktiske PostgREST-navne. Alle UUID'er sendes som strenge. `p_key` er et klientgenereret UUID, som genbruges ved gentagelse af **samme** handling/payload. Nøglen er isoleret pr. bruger; genbrug til en anden payload afvises. Tilbageleveret resultat ved retry er en kvittering for den tidligere handling, ikke et nyt øjebliksbillede. Genlæs derfor altid den aktuelle tilstand bagefter.

| RPC | Parametre | Resultat og betingelser |
|---|---|---|
| `club_visit_settings` | `p_club` | Kun ejer/admin. Privat snapshot eller revision 0, unpublished og ansøgninger lukket. |
| `club_visit_publish` | `p_club,p_revision,p_body,p_cover,p_logo,p_applications,p_key` | Kun ejer/admin. Tekst højst 1.000 tegn; eksplicitte booleske valg. `{revision}`. Billeder skal først stages. |
| `club_visit_unpublish` | `p_club,p_revision,p_key` | Kun ejer/admin. Lukker profilen og ansøgninger; revision øges. |
| `club_visit_profile` | `p_club` | `{id,name,description,revision,applications_open,has_cover,has_logo,cover_frame,logo_frame}`. Ingen Storage-stier eller uploader-ID'er; rammer uden `source`. |
| `club_visit_watch` | `p_club` | Registrerer læser i 30 dage; returnerer brugerens revisionsnummer. Kun aktuel besøgsadgang eller medlemskab. |
| `club_visit_image_stage` | `p_club,p_slot,p_source,p_data` | Ejer/admin; `cover`/`logo`, aktuel privat kilde, base64. Returnerer void. |
| `club_visit_image` | `p_club,p_slot,p_revision` | `{mime,data,revision}`; `data` er base64. Frisk autorisation og præcis profilrevision kræves. |
| `club_ride_visit_publish` | `p_club,p_ride,p_revision,p_title,p_body,p_area,p_key` | Ejer/admin; aktiv privat EVENT-klubtur. Titel 2–120, tekst ≤1.000, område ≤100 tegn. `{revision}`. |
| `club_ride_visit_unpublish` | `p_club,p_ride,p_revision,p_key` | Ejer/admin; trækker kun forhåndsvisningen tilbage. |
| `club_visit_rides` | `p_club,p_after=null,p_limit=20` | Liste; UUID-keyset, limit 1–50. Kun fremtidige aktive godkendte ture i den aktuelle klub. |
| `club_application_submit` | `p_club,p_body,p_key` | Profil og ansøgninger åbne. Tekst ≤500 Unicode-tegn. `{id,status,expires_at}` eller `{status:'invited',invite_id}`. |
| `club_applications_mine` | ingen | Kun egne ansøgninger: id, club_id, status, body, created_at, expires_at, resolved_at. |
| `club_applications_review` | `p_club,p_after=null,p_limit=30` | Ejer/admin; kun levende pending-ansøgninger. Tilladt ansøger-id/navn/avatar og ansøgningstekst/tider. Limit 1–50. |
| `club_application_cancel` | `p_id,p_key` | Kun ansøgeren; pending → cancelled eller expired. `{id,status}`. |
| `club_application_resolve` | `p_id,p_accept,p_key` | Frisk ejer/admin; pending → accepted/rejected/expired. Accept opretter medlemskab atomisk. `{id,status}`. |
| `club_application_restrict` | `p_club,p_applicant,p_restrict,p_key` | Ejer/admin; privat ansøgningsstop for bruger i klubben. `{restricted}`. Ændrer ikke personlige blokeringer. |

Turprojektionen indeholder præcis `id,title,description,area,start_time,discipline,distance_km,status,revision`. Den giver ingen deltagelsesret. Aflyste, afsluttede, flyttede, ikke længere private eller passerede ture skjules ved genlæsning. Blokering mellem besøgende og turvært skjuler turen.

Profil- og turpublicering bruger optimistisk revision: 0 ved første publicering, derefter den senest læste revision. Konflikt: `CLUB_VISIT_CHANGED`, SQLSTATE `PT409`. Generisk manglende besøgsadgang/stopflag: `42501`; input, afsluttet ansøgning, cooldown, rategrænse eller requestkonflikt: `22023`. Web skal oversætte kendte fejl, rydde skjult indhold ved adgangstab og undgå at afsløre blokering som årsag.

## Ansøgninger, samtidighed og misbrug

Én pending-ansøgning pr. klub/bruger. Et nyt request-ID med eksisterende pending-ansøgning returnerer dens id. Udløb efter 30 dage beregnes på serveren; læsning viser expired straks, og behandling kan ikke optage en udløbet ansøger. Ingen cronjob er nødvendigt for korrekt adgang; lagret pending-status normaliseres ved næste relevante mutation.

Afvisning giver syv dages ventetid. Eksisterende autoriserede invitationskontrakter er uændrede og fungerer under ventetiden. Accepteret invitation eller godkendt ansøgning samles under den eksisterende klublås og den unikke medlemsnøgle. Samtidig annullering/godkendelse får ét autoritativt udfald. En medlemsindsættelsestrigger afslutter konkurrerende pending-ansøgninger/invitationer, også via gamle klienter.

Rategrænse: højst fem nyoprettede ansøgninger pr. bruger i et rullende døgn og højst 20 levende pending på tværs af klubber. Annullering nulstiller ikke døgnkvoten. Nuværende ejers personlige blokering i begge retninger spærrer besøgsprofil, billeder og ansøgning. Blokering mellem behandler og ansøger skjuler ansøgningen for behandleren og forhindrer behandling. Klubspecifik ansøgningsrestriktion spærrer nyansøgning og behandling; den er ikke en medlemsudelukkelse og omskriver ikke gamle invitationers regler. Eksisterende serverbaseret tekstmoderation gælder også de nye tekster.

## Billeder og tilbagetrækning

Besøgende får **aldrig** Storage- eller signed URLs. En første integrationstest fandt, at direkte Storage/CDN-download kunne fortsætte efter RLS-tilbagetrækning. Derfor fjernede 0073 den midlertidige besøgs-Storage-policy fra 0071 og genskabte den eksisterende medlemsgrænse. 0074 fjernede også stier fra besøgsprojektionen.

Ejer/admin henter sit autoriserede originalbillede og sender base64 til stage-RPC'en. Serveren kontrollerer aktuel slot/kilde, privat Storage-metadata, MIME, JPEG/PNG-signatur, størrelse og MD5/eTag. Cover skal være JPEG, logo PNG, højst 3 MiB pr. billede. Ukendt/ikke-MD5 eTag afvises sikkert. Godkendte bytes lagres uforanderligt pr. klub/kildesti i en privat tabel. Ved ny kilde stages på ny; ved samme kilde overskrives snapshot ikke.

Image-RPC'en kræver frisk besøgsadgang, billedflag og aktuel publiceret revision og svarer med `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache` og `nosniff`. Tilbagetrækning/blokering/stopflag afviser næste billedanmodning. Allerede modtagne bytes kan ikke trækkes tilbage fra en enhed; den kommende webklient skal slette billeddata og revoke Blob URLs ved signal, logout, kontoskift, reconnect og adgangstab. Den gamle medlemsklients Storage/CDN-adfærd er ikke ændret.

Tradeoff: bytes i Postgres og base64-transport (omkring 33 % større) frem for Storage-CDN. Op til 6 MiB pr. fuldt staged profilversion, og gamle kilder kan akkumulere. Der er ingen automatisk retention/oprydning i første leverance. Inden større aktivering skal retention og kapacitet fastlægges. Slet aldrig en payload, som en publiceret profil refererer til.

## Revisionssignaler og klientkrav til næste delopgave

Genbruger den eksisterende `club_chat_signals`-række pr. bruger og dens allerede aktive Realtime-publication. Kun `user_id`, `revision` og eksisterende `visibility_revision`; ingen profiltekst, ansøgeroplysninger eller billeder i Realtime. Profil-/tur-/ansøgnings-/restriktionsændringer signalerer registrerede besøgende, medlemmer og ansøgere; flagændring signalerer registrerede besøgende. Turændringer bruger en ny livscyklustrigger. Eksisterende blokkeringssignaler bevares.

Realtime er en invalidationshjælp, ikke en adgangstilladelse eller en garanti om netværkslevering. Den næste webdel skal registrere watch, genlæse ved revisionsændring, foretage frisk kontrol ved reconnect/fokus og rydde data ved afslag. Ingen UI- eller BFCache/telefonacceptprøve er udført som del af denne serverleverance. Udløb evalueres ved serverkald; det udsender ikke et signal præcis på 30-dagesgrænsen.

## Kontrol og drift

Ved slutkontrol uden tilladelse til flagændringer bruges `VISIT_TEST_PRESERVE_FLAGS=true`.
Runneren kræver da allerede aktive testflag, læser/verificerer dem uden at ændre dem og bevarer dem under cleanup.
De tre prøver, der kræver flagændringer, registreres eksplicit som ikke gennemført; tidligere daterede flagbeviser skal vurderes særskilt.
Kun runnerens egne journalførte syntetiske konti, klubber, tur og billeder ryddes op. Visuelle acceptdata berøres ikke.

Node 22 med native WebSocket anbefales. Fra repositoryroden:

```sh
node backend/tests/visitors.integration.cjs
node backend/scripts/test-project.cjs review/server-visitors-20261116/final-audit.sql review/server-visitors-20261116/final-audit.json
```

Integrationstesten skriver kontrolleret **kun i testprojektet**: fire nye syntetiske konti, to egne klubber, en tur og to egne billedobjekter. Service-role bruges kun til fixtureadministration; alle produktkontrakter prøves med rigtige brugersessioner. 30 dage/syv dage simuleres ved at flytte udelukkende egne fixture-tidsstempler. `finally` slukker flagene og rydder kun journalførte fixture-id'er og stier. Journaler indeholder ingen passwords/tokens. Testen skal køres i et reserveret testvindue: flagene er projektglobale, og oprydning efterlader dem slukket.

Leverancerapport, resultater, historik, rettigheder og kvitteringer: `review/server-visitors-20261116/`. Ingen fysisk iOS-build er startet; kompatibilitetsbeviset er uændrede eksisterende funktionsdefinitioner samt integration mod de gamle RPC-kontrakter. Ingen migration til produktion er autoriseret af denne leverance.

## Godkendt webtilføjelse 0075 (16. november 2026)

Særskilt brugerafklaret behov og kvittering findes i `review/web-visitors-20261116/MIGRATION-NEED.md` og `applied-0075.json`. Fælles forward-kilde er uændret `backend/supabase/migrations/`; 0075 følger efter 0074. Gamle filer og iOS-kontrakter er ikke ændret.

- `visit_profiles.show_member_count` er `false` som standard. `club_visit_profile` tilføjer `member_count` (null indtil valgt, ellers aktuelt antal). Medlemslisten åbnes ikke. Medlemsindsættelse/sletning sender eksisterende revisionssignal.
- `club_visit_publish_web(p_club,p_revision,p_body,p_cover,p_logo,p_applications,p_show_member_count,p_key)` publicerer valget atomisk med det eksisterende snapshot og inkluderer det i requestens payloadidentitet. Den gamle `club_visit_publish`-signatur bevares. Den nye wrapper har både en egen og en afledt intern requestkvittering.
- `club_ride_visit_settings(p_club,p_after=null,p_limit=30)` kræver `rides` og frisk ejer/admin. Returnerer paginerede `ride_id,revision,published,title,body,area`, også for tilbagetrukne previews. `p_limit` er 1–50. Ingen medlems- eller besøgsadgang til denne projektion.
- `club_visit_watch` kaldes ved etablering/genetablering af abonnement, ikke ved hver genlæsning: kaldet udsender selv et signal og må ikke give en læs→watch→signal-løkke.

Webkandidatens besøgsfunktioner har nu en særskilt server-only `BIKE_ME_CLUB_VISITS_ENABLED`-gate: produktion kræver både værdien `true`, `VERCEL_ENV=production` og den præcise produktions-URL. Uden for produktion accepteres kun testprojektet. Denne gate aktiverer ikke databaseflagene, privat profil-/billedredigering eller web-klubturpush; de to sidstnævnte forbliver produktionsblokerede. De globale databaseflag er fortsat den autoritative serverafbryder for nye kontrakter. Ved den efterfølgende webgennemgang er alle fire testflag aktive for at gøre de beholdte syntetiske klubber tilgængelige. Se webafleveringen for den faktiske sluttilstand; serverrapportens slukkede tilstand beskriver den tidligere serveraflevering.

## Realtime-klarhed (17. november 2026)

`SUBSCRIBED` er kun kanal-join. Vent på `system` med `extension=postgres_changes,status=ok`, før en test skriver sin første hændelse, eller UI viser transporten som klar. Webklienterne genlæser autoriseret tilstand efter denne kvittering og igen efter reconnect; dette indhenter ændringer fra opstartsgabet. Fejl/timeout giver sikker degradering og eksisterende genkontrol, ikke nye grants. Kun de eksisterende brugerspecifikke revisionstabeller publiceres, aldrig profiltekst, chat eller DM-indhold. Ingen database- eller publikationsændring var nødvendig. `signalChannel` i integrationstesten kontrollerer den rigtige kvittering; chat/DM-prøver inkluderer en anden identitets negative abonnement og gentagne friske forbindelser.

## Godkendt testpilot og retention 0076–0081 (17. november 2026)

Kun anvendt i `bcskqapoagflshewvzzc`. Fælles migrationskilde er fortsat `backend/supabase/migrations/`; 0070–0075 og det frosne iOS-grundlag er uændrede. Fremadrettet rækkefølge: 0076 retention/pilot/kvoter → 0077 nye besøgs-RPC-guards → 0078 pg_cron → 0079 operatørlås uden bruger-JWT → 0080 watch uden selvsignaler → 0081 kvoter for gentagne no-op-tilbagetrækninger. Scripts tillader nu disse eksplicitte versioner og skriver SHA-kvitteringer i `review/retention-pilot-20261117/`. Ingen produktion er aktiveret.

`club_private.visit_pilot` er en privat operatørstyret allowlist, højst 20 aktiverede klubber, håndhævet atomisk også ved samtidige valg. Ingen automatisk optagelse ved kluboprettelse eller migration. Testens fire eksplicit valgte klubber er Grusværk, Kystlinjen CC, Kystsporet CC · besøgsprøve og Søndagskaffe · besøgsprøve. Sidstnævnte modtager fortsat ikke ansøgninger. Almindelig kluboprettelse, medlemskab, gamle invitationer, chat, DM og iOS-RPC’er kontrollerer ikke pilotlisten. Pilotfravalg lukker kun nye besøgs-RPC’er og udsender et revisionssignal; data/medlemskaber slettes ikke. Globale stopflag gælder fortsat derudover.

Opbevaring gælder kun de nye `visit_*`-tabeller:

- Maksimalt seks billedpayloads / 18 MiB pr. klub. Identiske kilder overskrives ikke og bruger ikke ny uploadkvote. Alle aktuelle billedreferencer beskyttes, også på skjult profil. Ubrugt staging udløber efter 24 timer; tidligere refererede, nu urefererede billeder efter syv dage. Ved fuldt loft kan ældste urefererede kopi blive fjernet tidligere. Privat Storage-original slettes aldrig af jobbet. Aktive referencer og oprydning serialiseres med klubbens eksisterende rækkelås.
- Afventende ansøgninger udløber efter 30 dage som før. Afsluttet tekst redigeres væk efter 90 dage og den minimale ansøgningsrække slettes efter 365 dage, regnet fra `resolved_at` eller effektivt udløb. Aktive ansøgninger, medlemskaber, invitationer, klubrestriktioner og fortrolige anmeldelser omfattes ikke af historiksletningen.
- Fuld besøgs-requestkvittering bevares syv dage. Derefter beholdes aktør, nøgle, klub, SHA-256-payloadhash og tider; payload/resultat fjernes. Præcis gammel retry giver `PT410 / CLUB_VISIT_RECEIPT_EXPIRED`, aldrig genudførelse. Ændret payload med samme nøgle giver fortsat idempotenskonflikt, også efter komprimering. Nøglen bevares indtil gældende konto-/klubsletning; ingen tidsbestemt nøglesletning. Dette ændrer ingen eksisterende iOS-requesttabel/-kontrakt.
- Inaktive watch-rækker slettes efter 31 dage; kvotemetadata efter otte dage. Watch-touches samles til højst én pr. fem minutter. Registrering udsender ikke længere sit eget indholdssignal: klienten foretager allerede en autoriseret catch-up efter watch. Ændringer i faktisk indhold/adgang udsender fortsat signaler.

`club-visit-retention` kører hvert kvarter via pg_cron med serverens ur. Aldersgrænser er udvælgelsesgrænser; sletning/redaktion i de aktive tabeller sker ved næste job, normalt højst 15 minutter senere, forudsat at jobbet kører. MVCC, WAL og backups følger platformens særskilte opbevaring; jobbet ændrer ikke backupregler eller udfører VACUUM FULL. Jobfejl skal overvåges, ikke skjules som en garanti om rettidig oprydning. Ingen klient har EXECUTE på vedligeholdelsen eller direkte adgang til de private tabeller. Simuleret tid kræver operatøradgang og eksplicit disponibel klubscope; det er ingen offentlig RPC. Anmodningsreplay afviser udløbet kvittering straks, også inden jobbet har kompakteret den.

Serverkvoter gælder nye besøgsfunktioner på tværs af sessioner: fire nye billedpayloads/klub/rullende døgn og 12/uge; 10 profil-/turpubliceringer/klub/døgn; 10 nye normale mutationer/bruger/minut med burst tre på ét sekund; 120 profil-/preview-/ledelses-/ansøgningslæsninger/bruger/minut; 30 billedkald OG 60 MiB dekodede billedbytes/bruger/minut, burst seks på ét sekund; 12 nye watch-leases/bruger/minut. Eksakte kvitteringsreplays og billeddeduplikering tæller ikke som ny handling. Kun faktiske beskyttende transitions (publiceret → skjult, levende ansøgning → annulleret, ny restriktion) undtages fra skrivekvoten. Gentagen no-op-skjul/restriktion med nye nøgler tæller normalt, og ophævelse af restriktion tæller normalt. Dette er en præcisering af rapportens foreslåede sikkerhedsundtagelse, så den ikke kan bruges til ubegrænsede kvitteringer. Eksisterende ansøgningsgrænser fem/døgn, 20 pending, syv dages cooldown og tekstfilter bevares.

Kvoter måles i samme transaktion som den godkendte handling og ruller tilbage ved afslag. De er ikke en erstatning for platformens trafik-/DoS-begrænsning af afviste eller ugyldige HTTPkald. Klienter kan ikke nulstille tællerne eller ændre serveruret. Web svarer med neutral 429-tekst på alle syv sprog, bevarer kladden og foretager ikke automatisk ny mutation. Et udløbet replay svarer 410, genlæser status og kræver en bevidst ny handling; ingen automatisk ny requestnøgle. Publicering prøver kvitteringen før billeddownload/staging, så gamle retries heller ikke stages på ny. Læsefejl vises som fejl og fjerner utilgængeligt indhold; de bliver ikke til tomme lister.

Testresultater, simulerede grænser, backendregressioner, faktisk skjult Chrome-retur, separat BFCache-status og bevaringsaudit: `review/retention-pilot-20261117/`. Gamle kontraktprøver isolerer deres egne kvotetællere; den særskilte retentionpakke tester de faktiske kvoter uden denne isolation. Den afsluttende fulde flagprøve bruger `VISIT_TEST_RESTORE_FLAGS=true`: testflag ændres kortvarigt og gendannes til førtilstanden i cleanup. Ingen produktionsflag ændres. Midlertidige fixtures er journalført og fjernes særskilt fra de bevarede visuelle acceptdata.
