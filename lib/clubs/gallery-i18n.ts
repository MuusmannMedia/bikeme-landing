import { locales, type Locale } from "../locales";

const messages = {
  title: ["Gallery", "Galleri", "Galerie", "Galería", "Galleria", "Galerie", "Galerij"],
  add: ["Upload photos", "Upload billeder", "Fotos hochladen", "Subir fotos", "Carica foto", "Ajouter des photos", "Foto’s uploaden"],
  choose: ["Choose up to 5 JPEG or PNG photos.", "Vælg op til 5 billeder i JPEG eller PNG.", "Wähle bis zu 5 JPEG- oder PNG-Fotos.", "Elige hasta 5 fotos JPEG o PNG.", "Scegli fino a 5 foto JPEG o PNG.", "Choisissez jusqu’à 5 photos JPEG ou PNG.", "Kies maximaal 5 JPEG- of PNG-foto’s."],
  caption: ["Caption (optional)", "Billedtekst (valgfri)", "Bildunterschrift (optional)", "Pie de foto (opcional)", "Didascalia (facoltativa)", "Légende (facultative)", "Bijschrift (optioneel)"],
  previousPhoto: ["Previous photo", "Forrige billede", "Vorheriges Foto", "Foto anterior", "Foto precedente", "Photo précédente", "Vorige foto"],
  nextPhoto: ["Next photo", "Næste billede", "Nächstes Foto", "Foto siguiente", "Foto successiva", "Photo suivante", "Volgende foto"],
  like: ["Like", "Synes godt om", "Gefällt mir", "Me gusta", "Mi piace", "J’aime", "Vind ik leuk"],
  comments: ["Comments", "Kommentarer", "Kommentare", "Comentarios", "Commenti", "Commentaires", "Reacties"],
  loadingComments: ["Loading comments…", "Henter kommentarer…", "Kommentare werden geladen…", "Cargando comentarios…", "Caricamento commenti…", "Chargement des commentaires…", "Reacties laden…"],
  noComments: ["No comments yet.", "Ingen kommentarer endnu.", "Noch keine Kommentare.", "Aún no hay comentarios.", "Non ci sono ancora commenti.", "Aucun commentaire pour l’instant.", "Nog geen reacties."],
  sendComment: ["Post comment", "Send kommentar", "Kommentar senden", "Publicar comentario", "Pubblica commento", "Publier le commentaire", "Reactie plaatsen"],
  moreComments: ["Load older comments", "Hent ældre kommentarer", "Ältere Kommentare laden", "Cargar comentarios anteriores", "Carica commenti precedenti", "Charger les commentaires précédents", "Oudere reacties laden"],
  deleteComment: ["Delete comment", "Slet kommentar", "Kommentar löschen", "Eliminar comentario", "Elimina commento", "Supprimer le commentaire", "Reactie verwijderen"],
  photo: ["Photo", "Billede", "Foto", "Foto", "Foto", "Photo", "Foto"],
  uploader: ["Uploaded by {name}", "Uploadet af {name}", "Hochgeladen von {name}", "Subida por {name}", "Caricata da {name}", "Ajoutée par {name}", "Geüpload door {name}"],
  empty: ["There are no photos yet.", "Der er endnu ingen billeder.", "Es gibt noch keine Fotos.", "Aún no hay fotos.", "Non ci sono ancora foto.", "Il n’y a pas encore de photos.", "Er zijn nog geen foto’s."],
  more: ["Load more photos", "Hent flere billeder", "Weitere Fotos laden", "Cargar más fotos", "Carica altre foto", "Charger plus de photos", "Meer foto’s laden"],
  loading: ["Loading photos…", "Henter billeder…", "Fotos werden geladen…", "Cargando fotos…", "Caricamento foto…", "Chargement des photos…", "Foto’s laden…"],
  uploadUnavailable: ["Photo upload is currently unavailable.", "Upload af billeder er midlertidigt utilgængelig.", "Der Foto-Upload ist derzeit nicht verfügbar.", "La subida de fotos no está disponible en este momento.", "Il caricamento delle foto non è al momento disponibile.", "L’envoi de photos est temporairement indisponible.", "Foto’s uploaden is tijdelijk niet beschikbaar."],
  uploading: ["Preparing and uploading photos…", "Forbereder og uploader billeder…", "Fotos werden vorbereitet und hochgeladen…", "Preparando y subiendo fotos…", "Preparazione e caricamento delle foto…", "Préparation et envoi des photos…", "Foto’s voorbereiden en uploaden…"],
  uploaded: ["Photos uploaded.", "Billederne er uploadet.", "Die Fotos wurden hochgeladen.", "Fotos subidas.", "Foto caricate.", "Photos ajoutées.", "Foto’s geüpload."],
  showLarge: ["Enlarge", "Vis stort", "Groß anzeigen", "Ampliar", "Ingrandisci", "Agrandir", "Vergroten"],
  closeLarge: ["Close enlarged view", "Luk stor visning", "Großansicht schließen", "Cerrar vista ampliada", "Chiudi vista ingrandita", "Fermer la vue agrandie", "Grote weergave sluiten"],
  close: ["Close", "Luk", "Schließen", "Cerrar", "Chiudi", "Fermer", "Sluiten"],
  remove: ["Remove photo", "Fjern billede", "Foto entfernen", "Eliminar foto", "Rimuovi foto", "Retirer la photo", "Foto verwijderen"],
  confirmRemove: ["Remove this photo from the gallery?", "Vil du fjerne billedet fra galleriet?", "Dieses Foto aus der Galerie entfernen?", "¿Eliminar esta foto de la galería?", "Rimuovere questa foto dalla galleria?", "Retirer cette photo de la galerie ?", "Deze foto uit de galerij verwijderen?"],
  invalid: ["Check the photos and captions, then try again.", "Kontrollér billeder og billedtekster, og prøv igen.", "Prüfe die Fotos und Bildunterschriften.", "Revisa las fotos y los pies de foto.", "Controlla le foto e le didascalie.", "Vérifiez les photos et les légendes.", "Controleer de foto’s en bijschriften."],
  image: ["This photo could not be opened. Choose a valid JPEG or PNG of up to 64 megapixels.", "Billedet kunne ikke åbnes. Vælg et gyldigt JPEG- eller PNG-billede på højst 64 megapixel.", "Das Foto konnte nicht geöffnet werden. Wähle ein gültiges JPEG- oder PNG-Foto mit bis zu 64 Megapixeln.", "No se pudo abrir la foto. Elige un JPEG o PNG válido de hasta 64 megapíxeles.", "Impossibile aprire la foto. Scegli un JPEG o PNG valido fino a 64 megapixel.", "Impossible d’ouvrir la photo. Choisissez un JPEG ou un PNG valide de 64 mégapixels maximum.", "De foto kon niet worden geopend. Kies een geldig JPEG- of PNG-bestand van maximaal 64 megapixel."],
  size: ["The photos are too large. Choose fewer or smaller photos.", "Billederne fylder for meget. Vælg færre eller mindre billeder.", "Die Fotos sind zu groß. Wähle weniger oder kleinere Fotos.", "Las fotos son demasiado grandes. Elige menos o más pequeñas.", "Le foto sono troppo grandi. Scegli meno foto o file più piccoli.", "Les photos sont trop volumineuses. Sélectionnez-en moins ou choisissez des fichiers plus petits.", "De foto’s zijn te groot. Kies minder of kleinere foto’s."],
  quota: ["You can upload up to 20 photos in 24 hours. Try again later.", "Du kan uploade op til 20 billeder på 24 timer. Prøv igen senere.", "Bis zu 20 Fotos in 24 Stunden. Versuche es später erneut.", "Puedes subir hasta 20 fotos en 24 horas. Inténtalo más tarde.", "Puoi caricare fino a 20 foto in 24 ore. Riprova più tardi.", "Vous pouvez ajouter jusqu’à 20 photos par période de 24 heures. Réessayez plus tard.", "Je kunt maximaal 20 foto’s in 24 uur uploaden. Probeer het later opnieuw."],
  capacity: ["The club gallery is full.", "Klubbens galleri er fyldt.", "Die Clubgalerie ist voll.", "La galería del club está llena.", "La galleria del club è piena.", "La galerie du club est pleine.", "De clubgalerij is vol."],
  busy: ["This upload is still being processed. Try again shortly.", "Denne upload behandles stadig. Prøv igen om lidt.", "Dieser Upload wird noch verarbeitet. Versuche es gleich erneut.", "La subida sigue en curso. Inténtalo en breve.", "Il caricamento è ancora in corso. Riprova tra poco.", "L’envoi est encore en cours. Réessayez dans un instant.", "Deze upload wordt nog verwerkt. Probeer het zo opnieuw."],
  unreadable: ["Photo unavailable", "Billedet er ikke tilgængeligt", "Foto nicht verfügbar", "Foto no disponible", "Foto non disponibile", "Photo indisponible", "Foto niet beschikbaar"],
  report: ["Report", "Anmeld", "Melden", "Denunciar", "Segnala", "Signaler", "Melden"],
  reportComment: ["Report comment", "Anmeld kommentar", "Kommentar melden", "Denunciar comentario", "Segnala commento", "Signaler le commentaire", "Reactie melden"],
  reportClub: ["Report to club administrators", "Anmeld til klubbens administratorer", "Den Clubadmins melden", "Denunciar a los administradores del club", "Segnala agli amministratori del club", "Signaler aux admins du club", "Melden bij de clubbeheerders"],
  reportSupport: ["Report to Bike Me", "Anmeld til Bike Me", "Bike Me melden", "Denunciar a Bike Me", "Segnala a Bike Me", "Signaler à Bike Me", "Melden bij Bike Me"],
  evidence: ["View photo evidence", "Se billedbevis", "Fotobeleg ansehen", "Ver foto de la denuncia", "Mostra la foto segnalata", "Voir la photo signalée", "Bekijk de gemelde foto"],
} as const;

export type GalleryTextKey = keyof typeof messages;
export function galleryText(locale: Locale, key: GalleryTextKey) {
  return messages[key][locales.indexOf(locale)];
}
