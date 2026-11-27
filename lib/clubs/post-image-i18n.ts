import { locales, type Locale } from "../locales";

const rows = {
  view: ["View photos", "Se billeder", "Fotos ansehen", "Ver fotos", "Vedi foto", "Voir les photos", "Foto’s bekijken"],
  back: ["Back to photos", "Tilbage til billeder", "Zurück zu den Fotos", "Volver a las fotos", "Torna alle foto", "Retour aux photos", "Terug naar foto’s"],
  full: ["This post has reached its photo limit.", "Opslaget har nået grænsen for antal billeder.", "Dieser Beitrag hat das Fotolimit erreicht.", "La publicación ha alcanzado el límite de fotos.", "Il post ha raggiunto il limite di foto.", "La publication a atteint sa limite de photos.", "Dit bericht heeft het maximumaantal foto’s bereikt."],
  removeConfirm: ["Remove this photo from the post?", "Vil du fjerne billedet fra opslaget?", "Das Foto aus dem Beitrag entfernen?", "¿Quitar esta foto de la publicación?", "Rimuovere la foto dal post?", "Retirer cette photo de la publication ?", "Deze foto uit het bericht verwijderen?"],
  add: ["Add image", "Tilføj billede", "Bild hinzufügen", "Añadir imagen", "Aggiungi immagine", "Ajouter une image", "Afbeelding toevoegen"],
  replace: ["Replace image", "Skift billede", "Bild ersetzen", "Cambiar imagen", "Sostituisci immagine", "Remplacer l’image", "Afbeelding vervangen"],
  remove: ["Remove image", "Fjern billede", "Bild entfernen", "Quitar imagen", "Rimuovi immagine", "Retirer l’image", "Afbeelding verwijderen"],
  restore: ["Keep current image", "Behold det nuværende billede", "Aktuelles Bild behalten", "Conservar imagen actual", "Mantieni immagine attuale", "Conserver l’image actuelle", "Huidige afbeelding behouden"],
  reset: ["Reset crop", "Nulstil beskæring", "Zuschnitt zurücksetzen", "Restablecer recorte", "Reimposta ritaglio", "Réinitialiser le cadrage", "Uitsnede herstellen"],
  image: ["Post image", "Billede til opslag", "Beitragsbild", "Imagen de la publicación", "Immagine del post", "Image de la publication", "Afbeelding bij het bericht"],
  limit: ["JPEG or PNG, up to 25 MB.", "JPEG eller PNG, højst 25 MB.", "JPEG oder PNG, bis 25 MB.", "JPEG o PNG, hasta 25 MB.", "JPEG o PNG, fino a 25 MB.", "JPEG ou PNG, 25 Mo maximum.", "JPEG of PNG, maximaal 25 MB."],
} as const;

export function postImageText(locale: Locale, key: keyof typeof rows) {
  return rows[key][locales.indexOf(locale)];
}
