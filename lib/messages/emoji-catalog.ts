import catalog from "./emoji/catalog.json";
import license from "./emoji/license.json";
import da from "./emoji/da.json";
import en from "./emoji/en.json";
import de from "./emoji/de.json";
import es from "./emoji/es.json";
import it from "./emoji/it.json";
import fr from "./emoji/fr.json";
import nl from "./emoji/nl.json";
export type EmojiLanguage = "da" | "en" | "de" | "es" | "it" | "fr" | "nl";
export type EmojiEntry = { emoji: string; category: number; label: string; search: string };
// Retain the Unicode notice in the distributed JS bundle as well as the source tree.
export const unicodeEmojiLicense: string = license;
const cache = new Map<string, EmojiEntry[]>();
export const emojiCategoryCount = 9;
function names(language: string): string[][] {
 switch(language) {
  case "da": return da;
  case "de": return de;
  case "es": return es;
  case "it": return it;
  case "fr": return fr;
  case "nl": return nl;
  default: return en;
 }
}
export function emojiSearchKey(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim(); }
export function emojiCatalog(language: string): EmojiEntry[] {
 const known=cache.get(language); if(known)return known;
 const rows: [string, number][]=catalog as [string, number][], labels=names(language);
 const entries=rows.map(([emoji,category],i)=>({emoji,category,label:labels[i][0],search:emojiSearchKey(labels[i].join(" ")+" "+emoji)}));
 cache.set(language,entries);return entries;
}
export function searchEmoji(entries: EmojiEntry[], query: string, category: number | null): EmojiEntry[] {
 const words=emojiSearchKey(query).split(/\s+/).filter(Boolean);
 return entries.filter(entry=>(category===null||entry.category===category)&&words.every(word=>entry.search.includes(word)||entry.emoji===word));
}
