// Transient provider payload only; never persist or log message text.
export function messagePreview(body: unknown, limit = 120): string | null {
 if (typeof body !== "string") return null;
 const text = body.replace(/[\s\u200B\uFEFF]+/gu, " ").trim();
 if (!text) return null;
 // Intl.Segmenter uses extended grapheme clusters: ZWJ families, flags and combining marks stay intact.
 const Segmenter = (Intl as unknown as {Segmenter: new(locales?: string, options?: {granularity: string}) => {segment(s: string): Iterable<{segment: string}>}}).Segmenter;
 const clusters = Array.from(new Segmenter(undefined, {granularity: "grapheme"}).segment(text), x => x.segment);
 const encoder = new TextEncoder();
 if (clusters.length <= limit && encoder.encode(text).length <= 512) return text;
 let result = "";
 for (const cluster of clusters.slice(0, limit - 1)) {
  if (encoder.encode(result + cluster).length > 509) break;
  result += cluster;
 }
 return result ? result.trimEnd() + "…" : null;
}
