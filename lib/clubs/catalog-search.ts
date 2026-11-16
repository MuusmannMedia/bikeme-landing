import type { ClubCatalogEntry } from './types';
const normalized = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
// Filter only the authorized catalog's names; never infer private club details.
export function searchClubCatalog<T extends ClubCatalogEntry>(clubs:readonly T[],query:string):T[]{
 const terms=normalized(query).split(/\s+/).filter(Boolean);
 return clubs.filter(club=>terms.every(term=>normalized(club.name).includes(term)));
}
