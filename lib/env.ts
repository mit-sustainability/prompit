const pocketbaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? process.env.NEXT_PUBLIC_PB_URL;
const companyDomain = process.env.NEXT_PUBLIC_COMPANY_DOMAIN;
const authModeRaw = process.env.NEXT_PUBLIC_AUTH_MODE;

const missing: string[] = [];
if (!pocketbaseUrl || pocketbaseUrl.trim().length === 0) {
  missing.push("NEXT_PUBLIC_POCKETBASE_URL (or NEXT_PUBLIC_PB_URL)");
}
if (!companyDomain || companyDomain.trim().length === 0) {
  missing.push("NEXT_PUBLIC_COMPANY_DOMAIN");
}
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(
      ", "
    )}. Set them in .env and restart Next.js dev server.`
  );
}

const authMode = authModeRaw === "email" ? "email" : "google";

export const env = {
  pocketbaseUrl,
  companyDomain,
  authMode
};
