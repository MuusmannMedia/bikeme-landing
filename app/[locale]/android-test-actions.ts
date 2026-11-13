"use server";

import {
  getAndroidTestApplicationValues,
  parseAndroidTestApplicationLocale,
  validateAndroidTestApplication,
  type AndroidTestApplicationState
} from "@/lib/android-test-application";
import { createClient } from "@/lib/supabase/server";

function honeypotWasFilled(formData: FormData): boolean {
  const value = formData.get("companyWebsite");
  return typeof value === "string" && value.trim().length > 0;
}

export async function submitAndroidTestApplication(
  previousState: AndroidTestApplicationState,
  formData: FormData
): Promise<AndroidTestApplicationState> {
  const attempt = Number.isSafeInteger(previousState?.attempt)
    && previousState.attempt >= 0
    && previousState.attempt < Number.MAX_SAFE_INTEGER
    ? previousState.attempt + 1
    : 1;

  // Spam submissions receive the same neutral response as real submissions.
  if (honeypotWasFilled(formData)) return { status: "success", attempt };

  const values = getAndroidTestApplicationValues(formData);
  const validation = validateAndroidTestApplication(values);
  if (!validation.ok) {
    return { status: "field-error", attempt, fieldErrors: validation.fieldErrors };
  }

  const locale = parseAndroidTestApplicationLocale(formData.get("locale"));
  if (!locale) return { status: "technical-error", attempt };

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_android_test_application", {
      p_name: validation.data.name,
      p_google_play_email: validation.data.email,
      p_device_model: validation.data.deviceModel,
      p_android_version: validation.data.androidVersion,
      p_locale: locale,
      p_cycling_frequency: validation.data.cyclingFrequency,
      p_comment: validation.data.comment
    });

    // A repeated application is deliberately indistinguishable from a new one.
    if (!error || error.code === "23505") return { status: "success", attempt };
    return { status: "technical-error", attempt };
  } catch {
    return { status: "technical-error", attempt };
  }
}
