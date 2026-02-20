const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const companyDomain = process.env.NEXT_PUBLIC_COMPANY_DOMAIN;
const authModeRaw = process.env.NEXT_PUBLIC_AUTH_MODE;

const missing: string[] = [];
if (!supabaseUrl || supabaseUrl.trim().length === 0) {
  missing.push("NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey || supabaseAnonKey.trim().length === 0) {
  missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
if (!companyDomain || companyDomain.trim().length === 0) {
  missing.push("NEXT_PUBLIC_COMPANY_DOMAIN");
}
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(
      ", "
    )}. Set them in .env.local (preferred) and restart Next.js dev server.`
  );
}

const authMode = authModeRaw === "email" ? "email" : "google";

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  companyDomain,
  authMode
};
