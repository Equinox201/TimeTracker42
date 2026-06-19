export function functionsBaseUrl(): string {
  const explicitUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (typeof explicitUrl === "string" && explicitUrl.trim().length > 0) {
    return explicitUrl.replace(/\/+$/, "");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (typeof supabaseUrl === "string" && supabaseUrl.trim().length > 0) {
    const url = new URL(supabaseUrl);
    url.hostname = url.hostname.replace(".supabase.co", ".functions.supabase.co");
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  }

  throw new Error("Missing Supabase Functions URL.");
}
