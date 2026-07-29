"use server";

import { redirect } from "next/navigation";

import {
  buildLoginPath,
  getSafeLocale,
  getSafeReturnPath,
  type AuthErrorCode
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function loginAction(formData: FormData): Promise<void> {
  const locale = getSafeLocale(formData.get("locale"));
  const returnTo = getSafeReturnPath(locale, formData.get("returnTo"));
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  let errorCode: AuthErrorCode | null = null;

  if (!isValidEmail(email) || password.length === 0) {
    errorCode = "invalid";
  } else {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        errorCode =
          error.code === "invalid_credentials" || error.status === 400
            ? "invalid"
            : "generic";
      }
    } catch {
      errorCode = "generic";
    }
  }

  if (errorCode) {
    redirect(buildLoginPath(locale, returnTo, errorCode));
  }

  redirect(returnTo);
}
