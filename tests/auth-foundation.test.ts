import assert from "node:assert/strict";
import test from "node:test";

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
