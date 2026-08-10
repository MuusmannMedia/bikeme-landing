import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  appleAuthCallbackPath,
  buildAppleCallbackUrl,
  exchangeAppleCallbackCode,
  getAppleCallbackContext,
  isAppleAuthCallbackPath,
  startAppleOAuth
} from "../lib/apple-auth";
import {
  buildLoginPath,
  getSafeLocale,
  getSafeReturnPath,
  isProtectedRoutePath
} from "../lib/auth";
import {
  authTranslationKeys,
  getAuthDictionary
} from "../lib/auth-i18n";
import { isLocale, locales } from "../lib/locales";

const projectFile = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

test("all seven supported locales are accepted and unknown locales are rejected", () => {
  assert.deepEqual(locales, ["en", "da", "de", "es", "it", "fr", "nl"]);

  locales.forEach((locale) => {
    assert.equal(isLocale(locale), true);
    assert.equal(getSafeLocale(locale), locale);
  });

  assert.equal(isLocale("sv"), false);
  assert.equal(getSafeLocale("sv"), "en");
});

test("safe return paths stay inside the active locale app route", () => {
  assert.equal(getSafeReturnPath("en", "/en/app"), "/en/app");
  assert.equal(getSafeReturnPath("en", "/en/app/settings?tab=profile"), "/en/app/settings?tab=profile");
  assert.equal(isProtectedRoutePath("en", "/en/app"), true);
  assert.equal(isProtectedRoutePath("en", "/en/app/settings"), true);
});

test("external, protocol-relative, cross-locale, and unrelated returns are rejected", () => {
  const fallback = "/en/app";

  [
    "https://attacker.example/en/app",
    "//attacker.example/en/app",
    "/da/app",
    "/en/privacy",
    "/en/app/../privacy",
    "javascript:alert(1)",
    "",
    null
  ].forEach((value) => {
    assert.equal(getSafeReturnPath("en", value), fallback);
  });
});

test("unknown authenticated app paths stay protected with localized safe returns", () => {
  const proxySource = projectFile("proxy.ts");

  locales.forEach((locale) => {
    const unknownPath = `/${locale}/app/unknown`;

    assert.equal(isProtectedRoutePath(locale, unknownPath), true);
    assert.equal(getSafeReturnPath(locale, unknownPath), unknownPath);
    assert.equal(
      buildLoginPath(locale, unknownPath),
      `/${locale}/login?returnTo=${encodeURIComponent(unknownPath)}`
    );
    assert.equal(getSafeReturnPath(locale, `/${locale === "da" ? "en" : "da"}/app/unknown`), `/${locale}/app`);
  });

  assert.ok(proxySource.includes("const isProtectedRoute = isProtectedRoutePath(locale, pathname)"));
  assert.ok(proxySource.includes("if (isProtectedRoute && !auth.user)"));
  assert.ok(proxySource.includes("buildLoginPath("));
});

test("login paths encode only validated local return targets", () => {
  assert.equal(
    buildLoginPath("fr", "/fr/app", "expired"),
    "/fr/login?returnTo=%2Ffr%2Fapp&error=expired"
  );
  assert.equal(
    buildLoginPath("fr", "https://attacker.example/fr/app"),
    "/fr/login?returnTo=%2Ffr%2Fapp"
  );
});

test("authentication translation keys are synchronized across all locales", () => {
  const expectedKeys = [...authTranslationKeys].sort();

  locales.forEach((locale) => {
    const dictionary = getAuthDictionary(locale);
    assert.deepEqual(Object.keys(dictionary).sort(), expectedKeys);

    authTranslationKeys.forEach((key) => {
      assert.equal(typeof dictionary[key], "string");
      assert.ok(dictionary[key].trim().length > 0);
    });
  });
});

test("the root Apple callback path bypasses locale rewriting", () => {
  assert.equal(appleAuthCallbackPath, "/auth/callback");
  assert.equal(isAppleAuthCallbackPath("/auth/callback"), true);
  assert.equal(isAppleAuthCallbackPath("/da/auth/callback"), false);

  const proxySource = projectFile("proxy.ts");
  assert.ok(proxySource.includes("isAppleAuthCallbackPath(pathname)"));
  assert.ok(
    proxySource.indexOf("isAppleAuthCallbackPath(pathname)") <
      proxySource.indexOf("const localeSegment")
  );
});

test("missing callback codes fail without invoking the exchanger", async () => {
  let exchangeCalls = 0;
  const exchanged = await exchangeAppleCallbackCode(null, async () => {
    exchangeCalls += 1;
    return { error: null };
  });

  assert.equal(exchanged, false);
  assert.equal(exchangeCalls, 0);
});

test("invalid callback codes fail safely", async () => {
  let exchangeCalls = 0;
  const exchanged = await exchangeAppleCallbackCode(
    "invalid-placeholder",
    async () => {
      exchangeCalls += 1;
      return { error: new Error("invalid") };
    }
  );

  assert.equal(exchanged, false);
  assert.equal(exchangeCalls, 1);
});

test("valid callbacks exchange the PKCE code", async () => {
  let exchangedValue: string | null = null;
  const exchanged = await exchangeAppleCallbackCode(
    "valid-placeholder",
    async (value) => {
      exchangedValue = value;
      return { error: null };
    }
  );

  assert.equal(exchanged, true);
  assert.equal(exchangedValue, "valid-placeholder");
});

test("a valid Danish callback ends at the Danish protected page", () => {
  const context = getAppleCallbackContext(
    new URLSearchParams({
      code: "valid-placeholder",
      locale: "da",
      returnTo: "/da/app"
    })
  );

  assert.equal(context.locale, "da");
  assert.equal(context.returnTo, "/da/app");
});

test("callbacks accept all seven supported locales", () => {
  locales.forEach((locale) => {
    const context = getAppleCallbackContext(
      new URLSearchParams({
        code: "valid-placeholder",
        locale,
        returnTo: `/${locale}/app`
      })
    );

    assert.equal(context.locale, locale);
    assert.equal(context.returnTo, `/${locale}/app`);
  });
});

test("an invalid callback locale falls back safely", () => {
  const context = getAppleCallbackContext(
    new URLSearchParams({
      code: "valid-placeholder",
      locale: "sv",
      returnTo: "/sv/app"
    })
  );

  assert.equal(context.locale, "en");
  assert.equal(context.returnTo, "/en/app");
});

test("callback return targets reject external, protocol-relative, and cross-locale URLs", () => {
  [
    "https://attacker.example/da/app",
    "//attacker.example/da/app",
    "/en/app"
  ].forEach((returnTo) => {
    const context = getAppleCallbackContext(
      new URLSearchParams({
        code: "valid-placeholder",
        locale: "da",
        returnTo
      })
    );

    assert.equal(context.returnTo, "/da/app");
  });
});

test("Apple initiation uses the provider and current-origin root callback", async () => {
  const receivedInputs: {
    provider: "apple";
    options: {
      redirectTo: string;
    };
  }[] = [];
  const client = {
    auth: {
      async signInWithOAuth(input: {
        provider: "apple";
        options: {
          redirectTo: string;
        };
      }) {
        receivedInputs.push(input);
        return { error: null };
      }
    }
  };

  const started = await startAppleOAuth(
    client,
    "http://localhost:3000",
    "da",
    "/da/app"
  );
  const receivedInput = receivedInputs[0];

  assert.equal(started, true);
  assert.ok(receivedInput);
  const redirectTo = new URL(receivedInput.options.redirectTo);
  assert.equal(receivedInput.provider, "apple");
  assert.equal(redirectTo.origin, "http://localhost:3000");
  assert.equal(redirectTo.pathname, "/auth/callback");
  assert.equal(redirectTo.searchParams.get("locale"), "da");
  assert.equal(redirectTo.searchParams.get("returnTo"), "/da/app");
});

test("Apple callback URL construction validates the browser origin and return target", () => {
  assert.equal(
    new URL(
      buildAppleCallbackUrl(
        "https://www.bikeme.one",
        "fr",
        "https://attacker.example/fr/app"
      )
    ).searchParams.get("returnTo"),
    "/fr/app"
  );
  assert.throws(() =>
    buildAppleCallbackUrl("javascript://attacker.example", "fr", "/fr/app")
  );
  assert.throws(() =>
    buildAppleCallbackUrl("https://www.bikeme.one/path", "fr", "/fr/app")
  );
});

test("email login and local-scope logout remain behaviorally isolated", () => {
  const emailActionSource = projectFile("app/[locale]/login/actions.ts");
  const logoutActionSource = projectFile("app/[locale]/app/actions.ts");

  assert.ok(emailActionSource.includes("signInWithPassword"));
  assert.equal(emailActionSource.includes("signInWithOAuth"), false);
  assert.ok(logoutActionSource.includes('signOut({ scope: "local" })'));
});

test("the callback establishes SSR cookies without profile or identity mutations", () => {
  const callbackSource = projectFile("app/auth/callback/route.ts");

  assert.ok(callbackSource.includes("createServerClient"));
  assert.ok(callbackSource.includes("exchangeCodeForSession"));
  assert.ok(callbackSource.includes("response.cookies.set"));
  assert.ok(callbackSource.includes("preventAuthCaching"));
  assert.equal(callbackSource.includes(".from("), false);
});

test("web auth code contains no linking, admin, service-role, or sensitive logging", () => {
  const authSources = [
    "app/auth/callback/route.ts",
    "app/[locale]/login/apple-login-button.tsx",
    "app/[locale]/login/actions.ts",
    "app/[locale]/app/actions.ts",
    "lib/apple-auth.ts",
    "lib/supabase/client.ts",
    "lib/supabase/server.ts"
  ]
    .map(projectFile)
    .join("\n");

  [
    "linkIdentity",
    "unlinkIdentity",
    "auth.admin",
    "service_role",
    "service-role"
  ].forEach((forbiddenReference) => {
    assert.equal(authSources.includes(forbiddenReference), false);
  });
  assert.equal(/\bconsole\.(?:log|info|warn|error|debug)\b/.test(authSources), false);
});

test("Apple UI strings exist in exactly the seven supported locales", () => {
  assert.equal(locales.length, 7);
  const english = getAuthDictionary("en");
  const danish = getAuthDictionary("da");
  const appleKeys = [
    "appleLogin",
    "authDivider",
    "appleLoginLoading",
    "appleLoginError"
  ] as const;

  locales.forEach((locale) => {
    const dictionary = getAuthDictionary(locale);

    appleKeys.map((key) => dictionary[key]).forEach((value) => {
      assert.ok(value.trim().length > 0);
    });

    if (locale !== "en" && locale !== "da") {
      appleKeys.forEach((key) => {
        assert.notEqual(dictionary[key], english[key]);
        assert.notEqual(dictionary[key], danish[key]);
      });
    }
  });
});

test("the Apple button uses the verified official white-style artwork accessibly", () => {
  const buttonSource = projectFile(
    "app/[locale]/login/apple-login-button.tsx"
  );
  const artwork = readFileSync(
    join(process.cwd(), "public/apple-sign-in-logo-white-52@2x.png")
  );

  assert.equal(
    createHash("sha256").update(artwork).digest("hex"),
    "f81336a271b872b2fe24483c2d1813eef4727a254ace7fd8e8eb71cc92abaa8b"
  );
  assert.ok(
    buttonSource.includes('src="/apple-sign-in-logo-white-52@2x.png"')
  );
  assert.ok(buttonSource.includes('alt=""'));
  assert.ok(buttonSource.includes('aria-hidden="true"'));
  assert.ok(buttonSource.includes("aria-busy={isStarting}"));
  assert.ok(buttonSource.includes("translations.appleLoginLoading"));
  assert.ok(buttonSource.includes("animate-spin"));
  assert.ok(buttonSource.includes("bg-white"));
  assert.ok(buttonSource.includes("text-black"));
  assert.ok(buttonSource.includes("text-[19px]"));
  assert.ok(buttonSource.includes("sm:text-[22px]"));
  assert.ok(buttonSource.includes("h-[52px]"));
  assert.ok(buttonSource.includes("whitespace-nowrap"));
});

test("the login card is responsive and does not reserve empty error space", () => {
  const loginPage = projectFile("app/[locale]/login/page.tsx");
  const loginForm = projectFile("app/[locale]/login/login-form.tsx");
  const appleButton = projectFile("app/[locale]/login/apple-login-button.tsx");

  assert.ok(loginPage.includes('className="bike-auth-page section-shell'));
  assert.ok(loginPage.includes("min-h-[100svh]"));
  assert.ok(loginPage.includes("items-start"));
  assert.ok(loginPage.includes("sm:items-center"));
  assert.ok(loginPage.includes("py-4"));
  assert.ok(loginPage.includes("mb-3"));
  assert.ok(loginPage.includes("h-24 w-24"));
  assert.ok(loginForm.includes('className="grid gap-4"'));
  assert.ok(loginForm.includes('aria-describedby={errorMessage ? "login-error" : undefined}'));
  assert.equal(loginForm.includes("min-h-24"), false);
  assert.equal(loginForm.includes("sm:min-h-[72px]"), false);
  assert.ok(appleButton.includes('<div className="mt-4">'));
  assert.ok(appleButton.includes('className="relative mt-4 inline-flex'));
  assert.equal(appleButton.includes("min-h-5"), false);
});

test("auth routes stay private and noindex while public landing stays static", () => {
  const loginPageSource = projectFile("app/[locale]/login/page.tsx");
  const protectedPageSource = projectFile("app/[locale]/app/page.tsx");
  const protectedLayoutSource = projectFile("app/[locale]/app/layout.tsx");
  const callbackSource = projectFile("app/auth/callback/route.ts");
  const publicPageSource = projectFile("app/[locale]/page.tsx");

  [loginPageSource, protectedPageSource].forEach((source) => {
    assert.ok(source.includes('dynamic = "force-dynamic"'));
    assert.ok(source.includes("revalidate = 0"));
  });
  assert.ok(protectedLayoutSource.includes('dynamic = "force-dynamic"'));
  assert.ok(protectedLayoutSource.includes("revalidate = 0"));
  assert.ok(protectedLayoutSource.includes("index: false"));
  assert.ok(callbackSource.includes("preventAuthCaching"));
  assert.ok(callbackSource.includes("X-Robots-Tag"));
  assert.ok(publicPageSource.includes("generateStaticParams"));
  assert.equal(publicPageSource.includes('dynamic = "force-dynamic"'), false);
});
