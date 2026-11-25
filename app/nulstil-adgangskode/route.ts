import { createHash } from "node:crypto";
import { BRAND_PURPLE } from "../../lib/site-config";
import recoveryCopy from "../../lib/password-recovery-copy.json";

const pageCopy = Object.fromEntries(
  Object.entries(recoveryCopy).map(([locale, copy]) => [locale, copy.page])
);

export const dynamic = "force-static";

const script = String.raw`
(() => {
  const verifyEndpoint = "https://zawilafvdwlnwsdeufts.supabase.co/auth/v1/verify";
  const copy = ${JSON.stringify(pageCopy)};
  const expectedCallback = "bikeme-clubs-beta://auth/callback?flow=password-recovery&project=zawilafvdwlnwsdeufts.supabase.co";
  const button = document.getElementById("continue");
  const message = document.getElementById("message");
  const heading = document.querySelector("h1");
  let destination;

  function showLanguage(locale, valid) {
    const [title, help, continueHelp, action] = copy[locale];
    document.documentElement.lang = locale;
    document.title = title + " – Bike Me";
    heading.textContent = title;
    message.textContent = valid ? continueHelp : help;
    button.textContent = action;
  }

  function readLink() {
    const fragment = window.location.hash;
    const hasQuery = window.location.search !== "";
    // The email carries the link in the fragment, which never reaches this web server.
    window.history.replaceState(null, "", window.location.pathname);
    destination = undefined;
    button.hidden = true;
    button.disabled = false;
    showLanguage("da", false);

    const payload = new URLSearchParams(fragment.slice(1));
    const link = payload.get("confirmation_url");
    const locales = payload.getAll("lang");
    const locale = locales[0] ?? "da";
    if (hasQuery || payload.getAll("confirmation_url").length !== 1 ||
        locales.length > 1 || [...payload].length !== 1 + locales.length ||
        !Object.hasOwn(copy, locale) || !link || link.length > 2048 ||
        !link.startsWith(verifyEndpoint + "?")) return;

    let url;
    try {
      url = new URL(link);
    } catch {
      return;
    }
    const params = url.searchParams;
    if (url.hash || [...params].length !== 3 ||
        params.get("type") !== "recovery" || params.get("redirect_to") !== expectedCallback ||
        !/^pkce_[0-9a-f]{56}$/.test(params.get("token") || "")) return;

    destination = url.href;
    showLanguage(locale, true);
    button.hidden = false;
  }

  window.addEventListener("hashchange", readLink);
  button.addEventListener("click", (event) => {
    if (!event.isTrusted || !destination || button.disabled) return;
    button.disabled = true;
    window.location.replace(destination);
  });
  readLink();
})();`;

const style = `
:root { --brand-purple: ${BRAND_PURPLE}; --brand-purple-light: color-mix(in srgb, var(--brand-purple) 55%, white); color-scheme: dark; font: 100% system-ui, sans-serif; background: #10172a; color: #f8fafc; }
body { margin: 0; min-height: 100svh; display: grid; place-items: center; }
main { box-sizing: border-box; width: min(100%, 32rem); padding: 2rem; }
.brand { color: var(--brand-purple-light); font-weight: 700; }
h1 { line-height: 1.15; }
p { line-height: 1.55; }
button { min-height: 44px; padding: .75rem 1.25rem; border: 1px solid var(--brand-purple-light); border-radius: .65rem; background: var(--brand-purple); color: #fff; font: inherit; font-weight: 700; }
button:focus-visible { outline: 3px solid var(--brand-purple-light); outline-offset: 3px; }
button:disabled { opacity: .65; }
`;

function hashSource(source: string) {
  return `'sha256-${createHash("sha256").update(source).digest("base64")}'`;
}

export function GET() {
  return new Response(`<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nulstil adgangskode – Bike Me</title>
  <style>${style}</style>
</head>
<body>
  <main>
    <p class="brand">Bike Me</p>
    <h1>Nulstil adgangskode</h1>
    <p id="message" role="status">Åbn det seneste nulstillingslink fra din Bike Me-mail.</p>
    <button id="continue" type="button" hidden>Fortsæt til Bike Me</button>
    <noscript><p>Slå JavaScript til for at bruge nulstillingslinket.</p></noscript>
  </main>
  <script>${script}</script>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src ${hashSource(script)}; style-src ${hashSource(style)}; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
