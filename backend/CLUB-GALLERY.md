# Klubgalleriet på Bike Me-web

Galleriet er bygget fra den verificerede produktionsversion `3f97eaefe3ce537f41ae386a2bd19d30e8619503`. Det oprindelige galleri er klargjort fra dette grundlag, og migrationerne 0100–0102 er allerede registreret i produktion. Den afgrænsede uploadautorisation er klargjort lokalt til separat godkendelse.

## Grænser og lager

| Grænse | Værdi |
| --- | --- |
| Upload | 1–5 JPEG- eller PNG-billeder, højst 20 billeder pr. konto på tværs af klubber i et rullende døgn |
| Kilde | Højst 24 megapixel. Filvælgeren accepterer op til 25 MiB pr. original, før browseren komprimerer. Den samlede filpayload til serveren er højst 3,5 MB, og hele multipart-anmodningen højst 4,0 MB. |
| Visning | JPEG, maks. 1.600 px på længste led og 500.000 bytes. Serveren sænker kvaliteten og om nødvendigt opløsningen for at overholde loftet. |
| Miniature | JPEG, maks. 360 px på længste led og 90.000 bytes. |
| Behandling | Sharp behandler billeder sekventielt med højst 4 sekunder pr. billedoperation og en samlet behandlingsfrist på 24 sekunder pr. batch. Uploadpladsen holdes i højst 90 sekunder. |
| Galleri | 24 billeder pr. side. Billedtekst højst 280 tegn. |
| Klub | 256 MiB billedbytes. Loftet medregner aktive reservationer, miniaturer og anmeldelsesbeviser. |

En batch kan efter serverkomprimering fylde højst **2,95 MB**. Maksimalt fylder 100 billeder og deres miniaturer cirka **59 MB**. Ved et illustrativt gennemsnit på 250–350 KB pr. billede inklusive miniature svarer 100 billeder til **25–35 MB**. Det fælles loft svarer til cirka **454** billeder ved maksimal billedstørrelse. Databaseindeks, versionshistorik i WAL og sikkerhedskopier kan kræve ekstra plads.

Uploadgrænsen ligger under Vercels normale grænse på 4,5 MB. Se [Vercels funktionsgrænser](https://vercel.com/docs/functions/limitations).

## Adgang og bevisopbevaring

Billederne ligger som behandlede bytes i private Postgres-tabeller. Det følger mønstret fra klubbens tilbagekaldelige medier. Der oprettes ingen Storage-bucket eller delbare, signerede links. Billedendepunktet genkontrollerer medlemskab og blokering ved hver læsning og sender `private, no-store`. Allerede hentede bytes på en enhed kan ikke trækkes tilbage.

Serveren kontrollerer medlemskab, døgnkvote og plads atomisk før Sharp. Upload-ID og indholdsaftryk forhindrer dubletter, også når et svar går tabt. Alle billeder i en batch gemmes i én databasetransaktion. En afbrudt eller afvist upload har ingen delvist gemte billeder. Udløbne reservatposter renses ved senere upload fra samme konto. Den lille kvittering for et gennemført upload-ID følger klubben og kontoen.

Klub- og supportanmeldelser bruger de eksisterende tabeller og rollegrænser. Webkøen viser også anmeldelser af billeder og billedkommentarer. Det eksisterende app-endepunkt returnerer fortsat kun de anmeldelsestyper appen kender. En autoriseret supportoperatør henter fotobevis med `club_support_gallery_evidence(p_report)` og behandler sagen gennem den eksisterende `club_support_resolve`. Klubmoderatorer får fotobevis via webkøen med deres aktuelle rolle. Klub- og supportkøen kan dele de samme billedbytes uden at dele sagsoplysninger.

Fjernelse rydder miniature og galleriadgang. Billedvisningen bevares, mens en eksisterende sag henviser til den. En slettet klub mister sine klubanmeldelser, mens supportbeviser følger supportkøens eksisterende levetid. Kontosletning fjerner uploaderens billeder og tilhørende billedbevis efter de eksisterende regler for sletning af personhenførbart bevis.

## Likes og kommentarer

Aktive medlemmer kan tilføje og fjerne deres eget like samt kommentere på billeder, de har adgang til. Blokreglerne gælder for billedet, kommentarerne og likeantallet. Kommentaroprettelse bruger klubbens eksisterende indholdsfilter i databasen. Web bevarer teksten ved afvisning. Første webversion tilbyder oprettelse og fjernelse af kommentarer. Kommentarer kan fjernes af deres forfatter eller klubbens ejer/administratorer. Andre aktive medlemmer kan anmelde den enkelte kommentar til klubbens administration eller fortroligt til Bike Me. Sagen gemmer kommentartekst, forfatter, tidspunkt og en reference til billedbeviset. Den bevarer beviset efter kommentarens eller billedets fjernelse med samme slette- og anonymiseringsregler som den eksisterende kø. Afgørelsen om fjernelse i begge køer rammer den anmeldte kommentar. Uploader, ejer og administratorer er de eneste med sletteret på selve fotoet. Fjernelse af et billede rydder dets likes og kommentarer. En eksisterende billedanmeldelse bevarer sit fotobevis efter galleriets eksisterende regler.

## Afgrænset identitet for upload

Den oprindelige servernøgle blev brugt i tre kald: reservation af plads og kvote, atomisk lagring af de behandlede billedbytes og frigivelse af en ubrugt reservation. De øvrige gallerioperationer bruger allerede brugerens Supabase-session.

Den nye løsning bruger også sessionen til de tre uploadkald. En separat signeringsidentitet i webserveren godkender kun lagring af de bytes, der har passeret Sharp. Signeringsnøglen er hverken et Supabase-API-token eller en databasebruger.

| Ny RPC | Adgang |
| --- | --- |
| `club_gallery_upload_reserve(uuid,uuid,text,integer)` | `authenticated`. Aktøren tages fra `auth.uid()`. Det eksisterende medlems-, kvote- og reservationscheck gælder. |
| `club_gallery_upload_commit(uuid,uuid,uuid,text,text)` | `authenticated` med aktivt medlemskab, egen aktuelle reservation og gyldig HMAC for aktør, klub, upload-ID, reservationsforsøg og de eksakte behandlede bytes. Den eksisterende lagringsfunktion gentager medlems- og reservationskontrollen atomisk. |
| `club_gallery_upload_release(uuid,uuid)` | `authenticated`. Kan frigive ét eget, uafsluttet reservationsforsøg, også efter medlemsfjernelse. Kaldet giver ingen læseadgang. |

Der oprettes ingen Postgres-rolle, ingen JWT og ingen generelle tabelrettigheder. De eksisterende rå upload-RPC'er får ingen nye kaldere. Læseadgang, sletning, likes, kommentarer og begge anmeldelsesveje bruger fortsat deres eksisterende sessionskontroller. Signeringsnøglen kan ikke bruges som bearer-token og giver ingen adgang til Vault, lagertabeller, andre klubber eller supportanmeldelser.

## Produktion efter separat godkendelse

1. Bekræft igen Supabase-projektet `zawilafvdwlnwsdeufts`, aktivt webcommit og migrationshistorik. `0100`–`0102` er allerede registreret og skal hverken redigeres eller genkøres. Den foreslåede ændring er alene [migration 0103](supabase/migrations/0103_club_gallery_upload_attestation.sql). Kontrollér at nummeret og de tre nye RPC-navne stadig er ledige. Den læsende kontrol har bekræftet `extensions.hmac`, korrekt HMAC-resultat på et offentligt testinput og at medlemmer og anonyme ikke kan læse Vault eller kalde den rå commit-funktion.
2. Anvend og registrér `0103` atomisk efter godkendelse. Kontrollér de tre nævnte `EXECUTE`-rettigheder til `authenticated`, afvisning af anonyme kald og de eksisterende private tabellers adgang. Der ændres ikke Storage-buckets eller browserpush-konfiguration.
3. Generér **én ny, tilfældig 32-byte nøgle** kodet som 64 små hextegn, kun til produktionsgalleriet. Lagr samme værdi som `club_gallery_upload_commit_hmac` i Supabase Vault og som følsom `BIKE_ME_GALLERY_UPLOAD_HMAC_KEY` kun til Production i Vercel-projektet `bikeme-landing`. Værdien må ikke indgå i Git, SQL-migrationshistorik, logfiler eller chat. Genbrug ikke en Supabase-nøgle eller en nøgle fra et andet miljø. Den tidligere `BIKE_ME_GALLERY_SERVER_KEY` bruges ikke.
4. Verificér scoping med dedikerede konti gennem Supabase Data API. Prøv gyldig signatur, falsk og genbrugt signatur, forkert konto, rå commit, anonymt kald, adgang efter medlemsfjernelse, og at supportbeviser stadig er afgrænset. Test derefter upload, oprydning og moderation på et adgangsbeskyttet Vercel-deployment, som bruger Production-miljøet uden at overtage produktionsdomænet.
5. Udgiv den fastlåste webversion til `www.bikeme.one`, når de afgrænsede produktionsprøver er bestået og produktionsudgivelse er godkendt. Behold den eksisterende app og browserpush-konfiguration.

## Tilbageførsel

Før webdomænet tilbage til den tidligere verificerede Vercel-udgivelse for `3f97eaefe3ce537f41ae386a2bd19d30e8619503`, hvis webudgivelsen skal rulles tilbage. Fjern derefter Vercels gallerivariabel og den konkrete Vault-hemmelighed efter navn og kontrolleret ID. Ved et isoleret uploadstop kan den nuværende webversion fortsætte med læsning og moderation.

```sql
BEGIN;
REVOKE EXECUTE ON FUNCTION
  public.club_gallery_upload_reserve(uuid,uuid,text,integer),
  public.club_gallery_upload_commit(uuid,uuid,uuid,text,text),
  public.club_gallery_upload_release(uuid,uuid) FROM authenticated;
COMMIT;
```

Et fuldt galleristop kan desuden tilbagekalde medlems-RPC'erne for galleri, visning, sletning, likes, kommentarer og nye anmeldelser. Bevar migrationshistorik, eksisterende moderation, bevis-RPC'er og private sagsdata. Den tidligere webversion læser den gamle klubkø. Brug den gennemgåede webmoderation i et adgangsbeskyttet miljø til åbne galleri-sager ved tilbageførsel.
