import { isLocale, type Locale } from "./locales";

export const androidVersionValues = ["16", "15", "14", "13", "12", "11_or_earlier", "other", "unknown"] as const;
export const cyclingFrequencyValues = ["daily", "several_weekly", "weekly", "monthly", "rarely"] as const;

export type AndroidVersionValue = (typeof androidVersionValues)[number];
export type CyclingFrequencyValue = (typeof cyclingFrequencyValues)[number];
export type AndroidTestApplicationField =
  | "name"
  | "email"
  | "deviceModel"
  | "androidVersion"
  | "cyclingFrequency"
  | "comment"
  | "commitment"
  | "privacy";
export type AndroidTestValidationError =
  | "required"
  | "invalidName"
  | "invalidEmail"
  | "invalidDevice"
  | "invalidSelection"
  | "commentTooLong"
  | "commitmentRequired"
  | "privacyRequired";

export type AndroidTestApplicationValues = {
  name: string;
  email: string;
  deviceModel: string;
  androidVersion: string;
  cyclingFrequency: string;
  comment: string;
  commitment: boolean;
  privacy: boolean;
};

export type AndroidTestApplicationState = {
  status: "idle" | "field-error" | "technical-error" | "success";
  attempt: number;
  fieldErrors?: Partial<Record<AndroidTestApplicationField, AndroidTestValidationError>>;
};

export type ValidAndroidTestApplication = {
  name: string;
  email: string;
  deviceModel: string;
  androidVersion: AndroidVersionValue;
  cyclingFrequency: CyclingFrequencyValue | null;
  comment: string | null;
};

export const emptyAndroidTestApplicationValues: AndroidTestApplicationValues = {
  name: "",
  email: "",
  deviceModel: "",
  androidVersion: "",
  cyclingFrequency: "",
  comment: "",
  commitment: false,
  privacy: false
};

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeGooglePlayEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getAndroidTestApplicationValues(formData: FormData): AndroidTestApplicationValues {
  return {
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    deviceModel: stringValue(formData, "deviceModel"),
    androidVersion: stringValue(formData, "androidVersion"),
    cyclingFrequency: stringValue(formData, "cyclingFrequency"),
    comment: stringValue(formData, "comment"),
    commitment: formData.has("commitment"),
    privacy: formData.has("privacy")
  };
}

export function validateAndroidTestApplication(values: AndroidTestApplicationValues):
  | { ok: true; data: ValidAndroidTestApplication }
  | { ok: false; fieldErrors: Partial<Record<AndroidTestApplicationField, AndroidTestValidationError>> } {
  const name = normalizeText(values.name);
  const email = normalizeGooglePlayEmail(values.email);
  const deviceModel = normalizeText(values.deviceModel);
  const comment = values.comment.trim().replace(/\r\n/gu, "\n");
  const fieldErrors: Partial<Record<AndroidTestApplicationField, AndroidTestValidationError>> = {};

  if (!name) fieldErrors.name = "required";
  else if (name.length < 2 || name.length > 100) fieldErrors.name = "invalidName";

  if (!email) fieldErrors.email = "required";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fieldErrors.email = "invalidEmail";

  if (!deviceModel) fieldErrors.deviceModel = "required";
  else if (deviceModel.length < 2 || deviceModel.length > 120) fieldErrors.deviceModel = "invalidDevice";

  if (!values.androidVersion) fieldErrors.androidVersion = "required";
  else if (!(androidVersionValues as readonly string[]).includes(values.androidVersion)) {
    fieldErrors.androidVersion = "invalidSelection";
  }

  if (values.cyclingFrequency && !(cyclingFrequencyValues as readonly string[]).includes(values.cyclingFrequency)) {
    fieldErrors.cyclingFrequency = "invalidSelection";
  }

  if (comment.length > 1000) fieldErrors.comment = "commentTooLong";
  if (!values.commitment) fieldErrors.commitment = "commitmentRequired";
  if (!values.privacy) fieldErrors.privacy = "privacyRequired";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    data: {
      name,
      email,
      deviceModel,
      androidVersion: values.androidVersion as AndroidVersionValue,
      cyclingFrequency: values.cyclingFrequency
        ? values.cyclingFrequency as CyclingFrequencyValue
        : null,
      comment: comment || null
    }
  };
}

export function parseAndroidTestApplicationLocale(value: FormDataEntryValue | null): Locale | null {
  return typeof value === "string" && isLocale(value) ? value : null;
}
