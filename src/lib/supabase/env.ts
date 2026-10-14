// Read lazily so a missing key fails with a clear message at the call site,
// not at import time during the build.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = () =>
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
