# Self-hosted Supabase on EC2 (separate from Prompit app)

Run Supabase using the official self-hosted stack in its own directory/project.

## 1) Bootstrap

```bash
bash infra/supabase/bootstrap.sh /opt/supabase-self-hosted
```

Then:

```bash
cd /opt/supabase-self-hosted/docker
cp .env.example .env
# edit .env
docker compose up -d
```

## 2) Keep it always on

- The official stack defines restart policies per service.
- Start it with `-d` so it runs as background services.
- After reboot, Docker restores services automatically when Docker daemon starts.

## 3) Configure Prompit requirements

1. Configure Google OAuth in Supabase Auth and set callback URLs.
2. Apply `supabase/migrations/202602171730_init.sql` from this repo.
3. Set the company domain used by RLS:
   - `ALTER SYSTEM SET app.settings.company_domain = 'yourcompany.com';`
   - Restart Postgres container/service in the Supabase stack.

## 4) Networking

- Expose Supabase over your own domain + HTTPS reverse proxy.
- In Prompit `.env.production`, set:
  - `NEXT_PUBLIC_SUPABASE_URL=https://supabase.your-domain.com`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>`
  - `NEXT_PUBLIC_COMPANY_DOMAIN=yourcompany.com`
