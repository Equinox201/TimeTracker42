import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error("Missing Supabase environment variables");
    }

    client = createClient(supabaseUrl, supabasePublishableKey);
  }

  return client;
}

// Created on first use rather than at import time. Demo mode never touches Supabase, so the
// app (and any deploy preview without the variables) still renders; a real call without
// configuration fails with a clear error instead of a blank page.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  }
});
