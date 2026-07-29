"use server";

import { redirect } from "next/navigation";

import { getSafeLocale } from "@/lib/auth";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = getSafeLocale(formData.get("locale"));

  if (getSupabaseEnvironment()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Keep the response generic and return to the public localized page.
    }
  }

  redirect(`/${locale}`);
}
