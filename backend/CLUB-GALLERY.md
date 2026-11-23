# Klubgalleriet på Bike Me-web

Galleriet er bygget fra den verificerede produktionsversion `3f97eaefe3ce537f41ae386a2bd19d30e8619503`. Koden og migrationen er klargjort lokalt. Der er ingen produktionsændringer i denne leverance.

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

## Udrulning efter separat godkendelse

1. Bekræft produktionsprojektet `zawilafvdwlnwsdeufts`, webgrenen og migrationshistorikken igen. Ved denne gennemgang var webcommit `3f97eaefe3ce537f41ae386a2bd19d30e8619503` aktivt, og seneste registrerede migration var `0098`. Kandidatfilerne er `0100_club_gallery.sql`, `0101_club_gallery_discussion.sql` og `0102_club_gallery_comment_reports.sql`, i den rækkefølge. Verificér numrene, før de registreres.
2. Kør kæden i et afgrænset miljø med det eksisterende tekstfilter og de aktuelle anmeldelsestriggere. Hold galleriwebkoden tilbage, til alle tre trin er anvendt. I produktion køres og registreres kæden i én ydre transaktion. Udelad kun filernes ydre `BEGIN` og `COMMIT`, hvis de samles til den transaktion. Kontrollér migrationsloggen, de nye RPC-rettigheder, klubroller, blokering og de adskilte anmeldelseskøer. Kontrollér også, at appens eksisterende kø fortsat bruger sin hidtidige kontrakt.
3. Billeder og beviser bruger privat Postgres-lager. Ingen ny Storage-bucket eller Storage-politik. Verificér database- og backupkapacitet ud fra antal klubber og loftet på 256 MiB pr. klub.
4. Behold `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for produktionsprojektet. Opret `BIKE_ME_GALLERY_SERVER_KEY` som en miljøafgrænset serverhemmelighed i Vercel for samme Supabase-projekt. Den bruges til uploadreservation, commit og frigivelse. Udrul dernæst releasecommittet som en samlet webversion. Der er ingen appudrulning i dette trin.
5. Efterkontrollér foto- og kommentaranmeldelser i begge køer, retention efter sletning, likes, kommentarfilter, tidligere medlemmers direkte links og uploadgrænser med godkendte testkonti. Kontrollér særskilt, at support kan hente bevis, og at klubmoderatorer ikke kan se supporthenvendelser.
6. Ved tilbageførsel genudgives den tidligere webversion, og galleriets Vercel-hemmelighed fjernes. Hvis direktelinks og nye galleriskrivninger også skal stoppes, tilbagekald `EXECUTE` for medlemsvisning, upload, likes, kommentarer og nye anmeldelser fra de relevante `authenticated`- og `service_role`-roller. Bevar de eksisterende moderationsfunktioner, de to bevis-RPC’er og de private sagsdata. Fjern kun migrationsobjekter ved en særskilt, kontrolleret afvikling af allerede indsendte sager.

Ved et isoleret galleristop kan den gennemgåede webversion blive online, så klubmoderatorer stadig har adgang til deres kø. Følgende begrænser de nye medlemsfunktioner og uploads. De eksisterende klubfunktioner, kø og beviser beholder deres rettigheder.

```sql
BEGIN;
REVOKE EXECUTE ON FUNCTION
  public.club_gallery_page(uuid,timestamptz,uuid),
  public.club_gallery_image(uuid,uuid,boolean),
  public.club_gallery_discussion(uuid,uuid,timestamptz,uuid),
  public.club_gallery_remove(uuid,uuid),
  public.club_gallery_set_like(uuid,uuid,boolean),
  public.club_gallery_add_comment(uuid,uuid,uuid,text),
  public.club_gallery_remove_comment(uuid,uuid,uuid),
  public.club_gallery_report(uuid,uuid,text,text,text),
  public.club_gallery_report_comment(uuid,uuid,uuid,text,text,text)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION
  public.club_gallery_reserve(uuid,uuid,uuid,text,integer),
  public.club_gallery_commit(uuid,uuid,uuid,uuid,jsonb),
  public.club_gallery_release(uuid,uuid,uuid)
  FROM service_role;
COMMIT;
```

Hvis selve webversionen skal tilbageføres, bruges den tidligere verificerede Vercel-udgivelse for `3f97eaefe3ce537f41ae386a2bd19d30e8619503`. Den version læser kun den gamle klubkø. Brug den gennemgåede webmoderation i et adgangsbeskyttet miljø til åbne galleri-sager, eller lad den autoriserede supportfunktion håndtere sine egne sager under tilbageførslen.
