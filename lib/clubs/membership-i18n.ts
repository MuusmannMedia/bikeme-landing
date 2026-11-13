import type { Locale } from "../locales";
import type { ClubErrorKind } from "./membership-types";
export const membershipText = {
  "incoming": [
    "Club invitations",
    "Klubinvitationer",
    "Clubeinladungen",
    "Invitaciones a clubes",
    "Inviti ai club",
    "Invitations aux clubs",
    "Clubuitnodigingen"
  ],
  "noneIncoming": [
    "No club invitations.",
    "Ingen klubinvitationer.",
    "Keine Clubeinladungen.",
    "No hay invitaciones.",
    "Nessun invito.",
    "Aucune invitation.",
    "Geen clubuitnodigingen."
  ],
  "accept": [
    "Accept",
    "Acceptér",
    "Annehmen",
    "Aceptar",
    "Accetta",
    "Accepter",
    "Accepteren"
  ],
  "decline": [
    "Decline",
    "Afvis",
    "Ablehnen",
    "Rechazar",
    "Rifiuta",
    "Refuser",
    "Weigeren"
  ],
  "cancel": [
    "Cancel",
    "Annuller",
    "Abbrechen",
    "Cancelar",
    "Annulla",
    "Annuler",
    "Annuleren"
  ],
  "confirm": [
    "Confirm",
    "Bekræft",
    "Bestätigen",
    "Confirmar",
    "Conferma",
    "Confirmer",
    "Bevestigen"
  ],
  "confirmTitle": [
    "Confirm club action",
    "Bekræft klubhandling",
    "Clubaktion bestätigen",
    "Confirmar acción del club",
    "Conferma azione del club",
    "Confirmer l’action du club",
    "Clubactie bevestigen"
  ],
  "confirmBody": [
    "Continue with the selected action?",
    "Vil du fortsætte med den valgte handling?",
    "Mit der gewählten Aktion fortfahren?",
    "¿Continuar con la acción seleccionada?",
    "Continuare con l’azione selezionata?",
    "Continuer avec l’action sélectionnée ?",
    "Doorgaan met de gekozen actie?"
  ],
  "busy": [
    "Saving…",
    "Gemmer…",
    "Wird gespeichert…",
    "Guardando…",
    "Salvataggio…",
    "Enregistrement…",
    "Opslaan…"
  ],
  "done": [
    "The action was confirmed. The list has been refreshed.",
    "Handlingen er bekræftet. Oversigten er opdateret.",
    "Die Aktion wurde bestätigt. Die Liste wurde aktualisiert.",
    "Acción confirmada. La lista se ha actualizado.",
    "Azione confermata. Elenco aggiornato.",
    "Action confirmée. La liste a été actualisée.",
    "De actie is bevestigd. De lijst is vernieuwd."
  ],
  "retry": [
    "Retry the same action",
    "Genforsøg samme handling",
    "Dieselbe Aktion erneut versuchen",
    "Reintentar la misma acción",
    "Riprova la stessa azione",
    "Réessayer la même action",
    "Dezelfde actie opnieuw proberen"
  ],
  "uncertain": [
    "The result is unknown. Retry this action before starting another; the same request and recipient will be used.",
    "Resultatet er uafklaret. Genforsøg denne handling før en anden; samme anmodning og modtager bruges.",
    "Das Ergebnis ist unklar. Wiederhole diese Aktion vor einer neuen; Anfrage und Empfänger bleiben gleich.",
    "Resultado desconocido. Reintenta esta acción antes de iniciar otra; se mantendrán la solicitud y el destinatario.",
    "Esito incerto. Riprova questa azione prima di iniziarne un’altra; richiesta e destinatario restano invariati.",
    "Résultat incertain. Réessayez cette action avant d’en lancer une autre ; la requête et le destinataire restent identiques.",
    "Het resultaat is onbekend. Probeer deze actie opnieuw voordat je een andere start; verzoek en ontvanger blijven gelijk."
  ],
  "management": [
    "Membership and leadership",
    "Medlemskab og ledelse",
    "Mitgliedschaft und Verwaltung",
    "Miembros y administración",
    "Membri e gestione",
    "Membres et gestion",
    "Lidmaatschap en beheer"
  ],
  "search": [
    "Find riders",
    "Find ryttere",
    "Fahrer suchen",
    "Buscar ciclistas",
    "Cerca ciclisti",
    "Rechercher des cyclistes",
    "Fietsers zoeken"
  ],
  "query": [
    "Rider name — at least 3 characters",
    "Rytternavn — mindst 3 tegn",
    "Fahrername — mindestens 3 Zeichen",
    "Nombre — al menos 3 caracteres",
    "Nome — almeno 3 caratteri",
    "Nom — au moins 3 caractères",
    "Naam — minimaal 3 tekens"
  ],
  "searching": [
    "Searching…",
    "Søger…",
    "Suche…",
    "Buscando…",
    "Ricerca…",
    "Recherche…",
    "Zoeken…"
  ],
  "noPeople": [
    "No matching riders.",
    "Ingen matchende ryttere.",
    "Keine passenden Fahrer.",
    "No hay coincidencias.",
    "Nessun ciclista trovato.",
    "Aucun cycliste trouvé.",
    "Geen fietsers gevonden."
  ],
  "invite": [
    "Invite rider",
    "Invitér rytter",
    "Fahrer einladen",
    "Invitar ciclista",
    "Invita ciclista",
    "Inviter le cycliste",
    "Fietser uitnodigen"
  ],
  "suggest": [
    "Suggest member",
    "Foreslå medlem",
    "Mitglied vorschlagen",
    "Proponer miembro",
    "Proponi membro",
    "Proposer un membre",
    "Lid voorstellen"
  ],
  "suggestHint": [
    "Suggestions go to the owner and admins. After approval, the rider must accept an invitation.",
    "Forslag går til ejer og administratorer. Efter godkendelse skal rytteren acceptere en invitation.",
    "Vorschläge gehen an Inhaber und Admins. Nach Freigabe muss der Fahrer eine Einladung annehmen.",
    "Las propuestas llegan al propietario y administradores. Tras aprobarse, el ciclista debe aceptar una invitación.",
    "Le proposte vanno a proprietario e amministratori. Dopo l’approvazione, il ciclista deve accettare un invito.",
    "Les propositions vont au propriétaire et aux administrateurs. Après validation, le cycliste doit accepter une invitation.",
    "Voorstellen gaan naar de eigenaar en beheerders. Na goedkeuring moet de fietser een uitnodiging accepteren."
  ],
  "pending": [
    "Pending invitations",
    "Afventende invitationer",
    "Ausstehende Einladungen",
    "Invitaciones pendientes",
    "Inviti in attesa",
    "Invitations en attente",
    "Openstaande uitnodigingen"
  ],
  "nonePending": [
    "No pending invitations.",
    "Ingen afventende invitationer.",
    "Keine ausstehenden Einladungen.",
    "No hay invitaciones pendientes.",
    "Nessun invito in attesa.",
    "Aucune invitation en attente.",
    "Geen openstaande uitnodigingen."
  ],
  "proposals": [
    "Member suggestions",
    "Medlemsforslag",
    "Mitgliedervorschläge",
    "Propuestas de miembros",
    "Proposte di membri",
    "Propositions de membres",
    "Ledenvoorstellen"
  ],
  "noneProposals": [
    "No pending suggestions.",
    "Ingen afventende forslag.",
    "Keine ausstehenden Vorschläge.",
    "No hay propuestas pendientes.",
    "Nessuna proposta in attesa.",
    "Aucune proposition en attente.",
    "Geen openstaande voorstellen."
  ],
  "approve": [
    "Approve and invite",
    "Godkend og invitér",
    "Genehmigen und einladen",
    "Aprobar e invitar",
    "Approva e invita",
    "Approuver et inviter",
    "Goedkeuren en uitnodigen"
  ],
  "proposedBy": [
    "Suggested by",
    "Foreslået af",
    "Vorgeschlagen von",
    "Propuesto por",
    "Proposto da",
    "Proposé par",
    "Voorgesteld door"
  ],
  "expires": [
    "Expires",
    "Udløber",
    "Läuft ab",
    "Caduca",
    "Scade",
    "Expire",
    "Verloopt"
  ],
  "expired": [
    "Expired",
    "Udløbet",
    "Abgelaufen",
    "Caducado",
    "Scaduto",
    "Expiré",
    "Verlopen"
  ],
  "invited": [
    "Invitation pending",
    "Invitation afventer",
    "Einladung ausstehend",
    "Invitación pendiente",
    "Invito in attesa",
    "Invitation en attente",
    "Uitnodiging in behandeling"
  ],
  "suggested": [
    "Suggestion pending",
    "Forslag afventer",
    "Vorschlag ausstehend",
    "Propuesta pendiente",
    "Proposta in attesa",
    "Proposition en attente",
    "Voorstel in behandeling"
  ],
  "alreadyMember": [
    "Already a member",
    "Allerede medlem",
    "Bereits Mitglied",
    "Ya es miembro",
    "Già membro",
    "Déjà membre",
    "Al lid"
  ],
  "leave": [
    "Leave club",
    "Forlad klub",
    "Club verlassen",
    "Salir del club",
    "Lascia il club",
    "Quitter le club",
    "Club verlaten"
  ],
  "remove": [
    "Remove member",
    "Fjern medlem",
    "Mitglied entfernen",
    "Eliminar miembro",
    "Rimuovi membro",
    "Retirer le membre",
    "Lid verwijderen"
  ],
  "make_admin": [
    "Make administrator",
    "Gør til administrator",
    "Zum Administrator machen",
    "Nombrar administrador",
    "Nomina amministratore",
    "Nommer administrateur",
    "Beheerder maken"
  ],
  "make_member": [
    "Make ordinary member",
    "Gør til almindeligt medlem",
    "Zum Mitglied machen",
    "Cambiar a miembro",
    "Rendi membro ordinario",
    "Rendre membre ordinaire",
    "Gewoon lid maken"
  ],
  "ownership": [
    "Ownership transfer",
    "Ejerskabsoverdragelse",
    "Eigentumsübertragung",
    "Transferencia de propiedad",
    "Trasferimento di proprietà",
    "Transfert de propriété",
    "Eigendomsoverdracht"
  ],
  "transfer": [
    "Propose as new owner",
    "Foreslå som ny ejer",
    "Als neuen Inhaber vorschlagen",
    "Proponer como nuevo propietario",
    "Proponi come nuovo proprietario",
    "Proposer comme nouveau propriétaire",
    "Voorstellen als nieuwe eigenaar"
  ],
  "transferHint": [
    "The nominated administrator must accept within seven days. The previous owner becomes an administrator.",
    "Den foreslåede administrator skal acceptere inden syv dage. Den tidligere ejer bliver administrator.",
    "Der vorgeschlagene Admin muss binnen sieben Tagen annehmen. Der bisherige Inhaber wird Admin.",
    "El administrador propuesto debe aceptar en siete días. El propietario anterior pasa a administrador.",
    "L’amministratore proposto deve accettare entro sette giorni. Il proprietario precedente diventa amministratore.",
    "L’administrateur proposé doit accepter sous sept jours. L’ancien propriétaire devient administrateur.",
    "De voorgestelde beheerder moet binnen zeven dagen accepteren. De vorige eigenaar wordt beheerder."
  ],
  "noneTransfers": [
    "No pending ownership transfers.",
    "Ingen afventende ejerskabsoverdragelser.",
    "Keine ausstehenden Eigentumsübertragungen.",
    "No hay transferencias pendientes.",
    "Nessun trasferimento in attesa.",
    "Aucun transfert en attente.",
    "Geen openstaande eigendomsoverdrachten."
  ],
  "noAdmins": [
    "Promote a member to administrator before proposing a new owner.",
    "Gør et medlem til administrator, før du foreslår en ny ejer.",
    "Ernenne zuerst einen Admin, bevor du einen neuen Inhaber vorschlägst.",
    "Nombra un administrador antes de proponer un nuevo propietario.",
    "Nomina un amministratore prima di proporre un nuovo proprietario.",
    "Nommez un administrateur avant de proposer un nouveau propriétaire.",
    "Maak eerst een lid beheerder voordat je een nieuwe eigenaar voorstelt."
  ],
  "ownerCannotLeave": [
    "The owner must transfer ownership before leaving.",
    "Ejeren skal overdrage ejerskabet, før klubben kan forlades.",
    "Der Inhaber muss vor dem Austritt das Eigentum übertragen.",
    "El propietario debe transferir la propiedad antes de salir.",
    "Il proprietario deve trasferire la proprietà prima di uscire.",
    "Le propriétaire doit transférer la propriété avant de quitter le club.",
    "De eigenaar moet het eigendom overdragen voordat die de club verlaat."
  ],
  "error.network": [
    "The connection failed. Try again.",
    "Forbindelsen svigtede. Prøv igen.",
    "Die Verbindung ist fehlgeschlagen. Erneut versuchen.",
    "Falló la conexión. Inténtalo de nuevo.",
    "Connessione non riuscita. Riprova.",
    "La connexion a échoué. Réessayez.",
    "De verbinding is mislukt. Probeer opnieuw."
  ],
  "error.access": [
    "Your access or role has changed. The server has not authorized this action.",
    "Din adgang eller rolle er ændret. Serveren har ikke godkendt handlingen.",
    "Dein Zugriff oder deine Rolle hat sich geändert. Die Aktion wurde nicht autorisiert.",
    "Tu acceso o rol ha cambiado. El servidor no autorizó la acción.",
    "Accesso o ruolo modificato. Il server non ha autorizzato l’azione.",
    "Votre accès ou rôle a changé. Le serveur n’a pas autorisé l’action.",
    "Je toegang of rol is gewijzigd. De server heeft de actie niet toegestaan."
  ],
  "error.expired": [
    "The invitation or proposal has expired. Refresh to see the current status.",
    "Invitationen eller forslaget er udløbet. Genindlæs for at se aktuel status.",
    "Die Einladung oder der Vorschlag ist abgelaufen. Aktualisiere den Status.",
    "La invitación o propuesta ha caducado. Actualiza el estado.",
    "L’invito o la proposta è scaduto. Aggiorna lo stato.",
    "L’invitation ou la proposition a expiré. Actualisez le statut.",
    "De uitnodiging of het voorstel is verlopen. Vernieuw de status."
  ],
  "error.closed": [
    "This item has already been processed or cancelled. The list has been refreshed.",
    "Dette er allerede behandlet eller annulleret. Oversigten er opdateret.",
    "Dieser Eintrag wurde bereits bearbeitet oder storniert. Die Liste wurde aktualisiert.",
    "Ya se ha procesado o cancelado. La lista se ha actualizado.",
    "Elemento già elaborato o annullato. Elenco aggiornato.",
    "Cet élément a déjà été traité ou annulé. La liste a été actualisée.",
    "Dit is al verwerkt of geannuleerd. De lijst is vernieuwd."
  ],
  "error.pending": [
    "An invitation, suggestion or ownership proposal is already pending.",
    "Der afventer allerede en invitation, et medlemsforslag eller et ejerskabsforslag.",
    "Eine Einladung, ein Mitglieder- oder Eigentumsvorschlag steht bereits aus.",
    "Ya hay una invitación o propuesta pendiente.",
    "Un invito o una proposta è già in attesa.",
    "Une invitation ou une proposition est déjà en attente.",
    "Er staat al een uitnodiging of voorstel open."
  ],
  "error.invalid": [
    "The details are invalid. Check your selection.",
    "Oplysningerne er ugyldige. Kontrollér dit valg.",
    "Die Angaben sind ungültig. Prüfe deine Auswahl.",
    "Los datos no son válidos. Revisa tu selección.",
    "Dati non validi. Controlla la selezione.",
    "Les données sont invalides. Vérifiez votre sélection.",
    "De gegevens zijn ongeldig. Controleer je keuze."
  ],
  "error.conflict": [
    "Another change occurred. Check the refreshed roles before trying again.",
    "Der er sket en anden ændring. Kontrollér de opdaterede roller før et nyt forsøg.",
    "Es gab eine weitere Änderung. Prüfe die aktualisierten Rollen.",
    "Se produjo otro cambio. Revisa los roles actualizados antes de reintentar.",
    "È avvenuta un’altra modifica. Controlla i ruoli aggiornati prima di riprovare.",
    "Une autre modification a eu lieu. Vérifiez les rôles actualisés avant de réessayer.",
    "Er is een andere wijziging geweest. Controleer de vernieuwde rollen voordat je opnieuw probeert."
  ],
  "error.admin": [
    "The new owner must be a current administrator.",
    "Den nye ejer skal være en nuværende administrator.",
    "Der neue Inhaber muss ein aktueller Admin sein.",
    "El nuevo propietario debe ser un administrador actual.",
    "Il nuovo proprietario deve essere un amministratore attuale.",
    "Le nouveau propriétaire doit être un administrateur actuel.",
    "De nieuwe eigenaar moet een huidige beheerder zijn."
  ],
  "error.unavailable": [
    "The club service is unavailable. Try again later.",
    "Klubtjenesten er utilgængelig. Prøv senere.",
    "Der Clubdienst ist nicht verfügbar. Versuche es später.",
    "El servicio no está disponible. Inténtalo más tarde.",
    "Il servizio club non è disponibile. Riprova più tardi.",
    "Le service des clubs est indisponible. Réessayez plus tard.",
    "De clubdienst is niet beschikbaar. Probeer later opnieuw."
  ],
  "from": [
    "From",
    "Fra",
    "Von",
    "De",
    "Da",
    "De",
    "Van"
  ],
  "to": [
    "To",
    "Til",
    "An",
    "A",
    "A",
    "À",
    "Aan"
  ]
} as const;
export type MembershipTextKey = keyof typeof membershipText;
const languages: readonly Locale[] = ["en","da","de","es","it","fr","nl"];
export function membershipDictionary(locale: Locale) { return (key: MembershipTextKey) => membershipText[key][languages.indexOf(locale)]; }
export function membershipErrorText(locale: Locale, kind: ClubErrorKind) {
  const t=membershipDictionary(locale);
  if(kind==="ownerMustTransfer")return t("ownerCannotLeave");
  if(kind==="alreadyMember")return t("alreadyMember");
  if(kind==="targetMustBeAdmin")return t("error.admin");
  if(["expired","proposalExpired","transferExpired"].includes(kind))return t("error.expired");
  if(["closed","proposalClosed","transferClosed","notMember"].includes(kind))return t("error.closed");
  if(["proposalPending","transferPending"].includes(kind))return t("error.pending");
  if(["auth","access"].includes(kind))return t("error.access");
  if(kind==="invalid"||kind==="conflict"||kind==="unavailable")return t(`error.${kind}`);
  return t("error.network");
}
