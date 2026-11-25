"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";

import { submitAndroidTestApplication } from "@/app/[locale]/android-test-actions";
import {
  emptyAndroidTestApplicationValues,
  getAndroidTestApplicationValues,
  validateAndroidTestApplication,
  type AndroidTestApplicationField,
  type AndroidTestApplicationState,
  type AndroidTestApplicationValues
} from "@/lib/android-test-application";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";

type AndroidTesterCopy = Dictionary["androidTester"];
type FieldErrors = NonNullable<AndroidTestApplicationState["fieldErrors"]>;

const initialState: AndroidTestApplicationState = { status: "idle", attempt: 0 };
const fieldNames: Record<AndroidTestApplicationField, string> = {
  name: "name",
  email: "email",
  deviceModel: "deviceModel",
  androidVersion: "androidVersion",
  cyclingFrequency: "cyclingFrequency",
  comment: "comment",
  commitment: "commitment",
  privacy: "privacy"
};

function SubmitButton({ copy }: { copy: AndroidTesterCopy }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--brand-purple-light)_68%,transparent)] bg-[linear-gradient(135deg,#5e7fff,var(--brand-purple))] px-6 py-3 text-sm font-bold text-white shadow-[0_18px_45px_-22px_rgb(var(--brand-purple-rgb)/0.95)] transition hover:scale-[1.01] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1226] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? copy.submitting : copy.submit}
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-sm leading-snug text-[#ffb4b4]">{message}</p> : null;
}

export function AndroidTesterSection({ locale, copy }: { locale: Locale; copy: AndroidTesterCopy }) {
  const [state, formAction] = useActionState(submitAndroidTestApplication, initialState);
  const [values, setValues] = useState<AndroidTestApplicationValues>(emptyAndroidTestApplicationValues);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const submissionStartedRef = useRef(false);

  useEffect(() => {
    submissionStartedRef.current = false;
    const frame = requestAnimationFrame(() => {
      // React resets native form controls after a server action. A fresh object
      // makes the controlled values render again without returning personal data
      // from the server action.
      if (state.status !== "idle" && state.status !== "success") {
        setValues((current) => ({ ...current }));
      }
      if (state.status === "field-error") {
        const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0] as AndroidTestApplicationField | undefined;
        if (firstInvalidField) {
          formRef.current?.querySelector<HTMLElement>(`[name="${fieldNames[firstInvalidField]}"]`)?.focus();
        }
      }
      if (state.status === "success" || state.status === "technical-error") resultRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [state.attempt, state.fieldErrors, state.status]);

  const displayedErrors = clientErrors ?? state.fieldErrors ?? {};
  const errorMessage = (field: AndroidTestApplicationField) => {
    const code = displayedErrors[field];
    return code ? copy.validation[code] : undefined;
  };
  const updateValue = <Key extends keyof AndroidTestApplicationValues>(
    key: Key,
    value: AndroidTestApplicationValues[Key]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    const field = key as AndroidTestApplicationField;
    setClientErrors((current) => {
      const next = { ...(current ?? state.fieldErrors ?? {}) };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const validation = validateAndroidTestApplication(getAndroidTestApplicationValues(new FormData(event.currentTarget)));
    if (validation.ok) {
      if (submissionStartedRef.current) {
        event.preventDefault();
        return;
      }
      submissionStartedRef.current = true;
      setClientErrors(null);
      return;
    }

    event.preventDefault();
    setClientErrors(validation.fieldErrors);
    const firstInvalidField = Object.keys(validation.fieldErrors)[0] as AndroidTestApplicationField | undefined;
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>(`[name="${fieldNames[firstInvalidField]}"]`)?.focus();
      });
    }
  };

  const fieldClass = (field: AndroidTestApplicationField) =>
    `min-h-12 w-full rounded-xl border bg-[#070e1d]/90 px-3.5 py-3 text-base text-white outline-none transition placeholder:text-[#8391b0] focus:ring-2 focus:ring-brand-purple-light focus:ring-offset-2 focus:ring-offset-[#0a1226] ${
      displayedErrors[field] ? "border-[#ff8f8f]" : "border-white/20 hover:border-white/35"
    }`;

  return (
    <section id="android-test" className="section-shell scroll-mt-28 pb-20 md:pb-24" aria-labelledby="android-test-title">
      <div className="relative overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--brand-purple-light)_35%,transparent)] bg-[linear-gradient(145deg,rgba(16,28,60,0.97),var(--brand-purple-surface))] shadow-[0_42px_100px_-52px_rgb(var(--brand-purple-rgb)/0.95)]">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#5e7fff]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-brand-purple/20 blur-3xl" />

        <div className="bike-inset bike-layout-grid relative grid gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(30rem,1.1fr)] lg:gap-12 lg:px-10 lg:py-12">
          <div className="flex flex-col lg:py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[rgb(164,185,255)]">{copy.eyebrow}</p>
            <h1 id="android-test-title" className="mt-4 max-w-[17ch] font-display text-3xl font-semibold leading-tight text-white [text-wrap:balance] md:text-5xl">
              {copy.formTitle}
            </h1>
            <p className="mt-4 max-w-[22ch] font-display text-2xl font-semibold leading-tight text-brand-purple-light [text-wrap:balance] md:text-3xl">
              {copy.title}
            </p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--ink-soft)]">{copy.body}</p>

            <div className="bike-card mt-8 rounded-3xl border border-[color-mix(in_srgb,var(--brand-purple-light)_42%,transparent)] bg-[linear-gradient(135deg,rgba(94,127,255,0.16),rgb(var(--brand-purple-rgb)/0.32))] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[rgb(184,200,255)]">{copy.rewardEyebrow}</p>
              <p className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">{copy.rewardBadge}</p>
              <p className="mt-3 leading-relaxed text-[rgb(205,214,238)]">{copy.rewardNote}</p>
            </div>
          </div>

          <div className="bike-card rounded-3xl border border-white/15 bg-[#0a1226]/90 p-5 shadow-[0_28px_70px_-44px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-7">
            {state.status === "success" ? (
              <div ref={resultRef} tabIndex={-1} role="status" className="flex min-h-[26rem] flex-col items-center justify-center text-center outline-none">
                <span className="grid h-16 w-16 place-items-center rounded-full border border-emerald-300/40 bg-emerald-400/15 text-3xl text-emerald-200" aria-hidden="true">✓</span>
                <h2 className="mt-6 font-display text-2xl font-semibold text-white">{copy.successTitle}</h2>
                <p className="mt-3 max-w-md leading-relaxed text-[var(--ink-soft)]">{copy.success}</p>
              </div>
            ) : (
              <>
                <h2 id="android-test-form-title" className="font-display text-2xl font-semibold text-white sm:text-3xl">{copy.page.formHeading}</h2>
                <p className="mt-2 leading-relaxed text-[var(--ink-soft)]">{copy.formText}</p>
                <p className="mt-2 text-sm text-[rgb(163,178,214)]">{copy.requiredNote}</p>

                <form ref={formRef} action={formAction} onSubmit={handleSubmit} noValidate className="bike-public-form grid gap-5" aria-labelledby="android-test-form-title" aria-describedby="android-test-submission-note">
                  <input type="hidden" name="locale" value={locale} />
                  <div className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden opacity-0" aria-hidden="true" role="presentation">
                    <label htmlFor="android-company-website">{copy.honeypotLabel}</label>
                    <input id="android-company-website" name="companyWebsite" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  </div>

                  <div className="bike-layout-grid grid gap-5">
                    <div className="bike-public-field grid gap-2">
                      <label className="text-sm font-semibold text-white" htmlFor="android-name">{copy.nameLabel} *</label>
                      <input id="android-name" name="name" value={values.name} onChange={(event) => updateValue("name", event.target.value)} className={fieldClass("name")} placeholder={copy.namePlaceholder} autoComplete="name" minLength={2} maxLength={100} required aria-invalid={Boolean(displayedErrors.name)} aria-describedby={displayedErrors.name ? "android-name-error" : undefined} />
                      <FieldError id="android-name-error" message={errorMessage("name")} />
                    </div>

                    <div className="bike-public-field grid gap-2">
                      <label className="text-sm font-semibold text-white" htmlFor="android-email">{copy.emailLabel} *</label>
                      <input id="android-email" name="email" type="email" inputMode="email" value={values.email} onChange={(event) => updateValue("email", event.target.value)} className={fieldClass("email")} placeholder={copy.emailPlaceholder} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required aria-invalid={Boolean(displayedErrors.email)} aria-describedby={`android-email-hint${displayedErrors.email ? " android-email-error" : ""}`} />
                      <p id="android-email-hint" className="text-sm leading-relaxed text-[rgb(158,173,207)]">{copy.emailHint}</p>
                      <FieldError id="android-email-error" message={errorMessage("email")} />
                    </div>

                    <div className="bike-public-field grid gap-2">
                      <label className="text-sm font-semibold text-white" htmlFor="android-device-model">{copy.deviceLabel} *</label>
                      <input id="android-device-model" name="deviceModel" value={values.deviceModel} onChange={(event) => updateValue("deviceModel", event.target.value)} className={fieldClass("deviceModel")} placeholder={copy.devicePlaceholder} minLength={2} maxLength={120} required aria-invalid={Boolean(displayedErrors.deviceModel)} aria-describedby={displayedErrors.deviceModel ? "android-device-error" : undefined} />
                      <FieldError id="android-device-error" message={errorMessage("deviceModel")} />
                    </div>

                    <div className="bike-public-field grid gap-2">
                      <label className="text-sm font-semibold text-white" htmlFor="android-version">{copy.versionLabel} *</label>
                      <select id="android-version" name="androidVersion" value={values.androidVersion} onChange={(event) => updateValue("androidVersion", event.target.value)} className={fieldClass("androidVersion")} required aria-invalid={Boolean(displayedErrors.androidVersion)} aria-describedby={displayedErrors.androidVersion ? "android-version-error" : undefined}>
                        <option value="">{copy.selectPrompt}</option>
                        {["16", "15", "14", "13", "12"].map((version) => <option key={version} value={version}>Android {version}</option>)}
                        <option value="11_or_earlier">{copy.versionEarlier}</option>
                        <option value="other">{copy.versionOther}</option>
                        <option value="unknown">{copy.versionUnknown}</option>
                      </select>
                      <FieldError id="android-version-error" message={errorMessage("androidVersion")} />
                    </div>
                  </div>

                  <div className="bike-public-field grid gap-2">
                    <label className="text-sm font-semibold text-white" htmlFor="android-frequency">{copy.frequencyLabel}</label>
                    <select id="android-frequency" name="cyclingFrequency" value={values.cyclingFrequency} onChange={(event) => updateValue("cyclingFrequency", event.target.value)} className={fieldClass("cyclingFrequency")} aria-invalid={Boolean(displayedErrors.cyclingFrequency)} aria-describedby={displayedErrors.cyclingFrequency ? "android-frequency-error" : undefined}>
                      <option value="">{copy.frequencyPrompt}</option>
                      <option value="daily">{copy.frequencyOptions.daily}</option>
                      <option value="several_weekly">{copy.frequencyOptions.severalWeekly}</option>
                      <option value="weekly">{copy.frequencyOptions.weekly}</option>
                      <option value="monthly">{copy.frequencyOptions.monthly}</option>
                      <option value="rarely">{copy.frequencyOptions.rarely}</option>
                    </select>
                    <FieldError id="android-frequency-error" message={errorMessage("cyclingFrequency")} />
                  </div>

                  <div className="bike-public-field grid gap-2">
                    <label className="text-sm font-semibold text-white" htmlFor="android-comment">{copy.commentLabel}</label>
                    <textarea id="android-comment" name="comment" value={values.comment} onChange={(event) => updateValue("comment", event.target.value)} className={`${fieldClass("comment")} min-h-28 resize-y`} placeholder={copy.commentPlaceholder} maxLength={1000} aria-invalid={Boolean(displayedErrors.comment)} aria-describedby={displayedErrors.comment ? "android-comment-error" : undefined} />
                    <FieldError id="android-comment-error" message={errorMessage("comment")} />
                  </div>

                  <div className="bike-layout-grid grid gap-3">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${displayedErrors.commitment ? "border-[#ff8f8f] bg-red-950/15" : "border-white/15 bg-white/[0.035] hover:border-white/30"}`}>
                      <input name="commitment" type="checkbox" checked={values.commitment} onChange={(event) => updateValue("commitment", event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light" required aria-invalid={Boolean(displayedErrors.commitment)} aria-describedby={displayedErrors.commitment ? "android-commitment-error" : undefined} />
                      <span className="text-sm leading-relaxed text-[rgb(218,226,245)]">{copy.commitmentLabel}</span>
                    </label>
                    <FieldError id="android-commitment-error" message={errorMessage("commitment")} />

                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${displayedErrors.privacy ? "border-[#ff8f8f] bg-red-950/15" : "border-white/15 bg-white/[0.035] hover:border-white/30"}`}>
                      <input name="privacy" type="checkbox" checked={values.privacy} onChange={(event) => updateValue("privacy", event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light" required aria-invalid={Boolean(displayedErrors.privacy)} aria-describedby={displayedErrors.privacy ? "android-privacy-error" : undefined} />
                      <span className="text-sm leading-relaxed text-[rgb(218,226,245)]">{copy.privacyPrefix}<Link href={`/${locale}/privacy`} className="font-semibold text-[rgb(190,204,255)] underline decoration-white/35 underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light">{copy.privacyLink}</Link>{copy.privacySuffix}</span>
                    </label>
                    <FieldError id="android-privacy-error" message={errorMessage("privacy")} />
                  </div>

                  {state.status === "technical-error" ? (
                    <div ref={resultRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-300/30 bg-red-950/30 p-4 text-sm leading-relaxed text-red-100 outline-none">{copy.technicalError}</div>
                  ) : null}

                  <p id="android-test-submission-note" className="text-sm leading-relaxed text-[rgb(158,173,207)]">{copy.submissionNote}</p>
                  <SubmitButton copy={copy} />
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
