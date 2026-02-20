# Prompit MVP

Internal office hub for sharing and voting on AI prompts.

## MVP scope (minimum usable prototype)

Included now:
- Google OAuth login via Supabase (domain hinting + DB-level company-domain enforcement).
- Prompt gallery grid with sorting by Noise (upvotes), Newest, and Most Echoed (copies).
- Real-time fuzzy search across title, content, category, and tags.
- Prompt card actions: Copy, Noise (one vote per user), Echo (fork into composer).
- Composer modal with title/category/content, variable detection (`{{variable_name}}`), and max length (4000).
- Owner-only edit/delete at the RLS policy layer.

Deferred (non-MVP):
- Rich moderation workflow.
- Team analytics dashboards.
- Notification system.
- Version diff history UI.

## Stack

- Frontend: Next.js 14 (App Router), Tailwind CSS, Lucide React
- Backend/Auth/DB: Self-hosted Supabase (Postgres)
- Infra: AWS EC2 + Docker, optional S3 for future file assets

## 1) Local app setup

1. Install dependencies:
```bash
npm install
```
2. Create env file:
```bash
cp .env.example .env.local
```
3. Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_COMPANY_DOMAIN`
- `NEXT_PUBLIC_AUTH_MODE=email` for local email/password login (set `google` in production)
4. Run:
```bash
npm run dev
```

## 2) Database setup (Supabase)

Apply `supabase/migrations/202602171730_init.sql` in your Supabase Postgres.

Important: set your company domain in Postgres settings:
```sql
ALTER SYSTEM SET app.settings.company_domain = 'yourcompany.com';
```
Then restart Postgres.

This powers RLS function `public.is_allowed_company_user()`.

## 3) Google OAuth config

In Supabase Auth:
- Enable Google provider.
- Add redirect URL: `https://YOUR_APP_DOMAIN/auth/callback`.
- In Google Cloud OAuth consent/app settings, restrict authorized domain as needed.

App-side OAuth uses `hd=<company_domain>` for domain hinting.

## 4) EC2 deployment (Prompit app only, no compose)

1. Copy project to EC2 (example `/opt/prompit`).
2. Create runtime env:
```bash
cp .env.production.example .env.production
# edit values
```
3. Build image:
```bash
docker build -t prompit-web:latest -f Dockerfile .
```
4. Run container:
```bash
docker run -d \
  --name prompit-web \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  prompit-web:latest
```
5. For updates, run:
```bash
bash scripts/deploy.sh
```

## 5) Self-hosted Supabase on EC2

See `infra/supabase/README.md`.

Use official open-source Supabase self-hosting Docker Compose stack on EC2 and point this app to that URL.
Keep Supabase as a separate deployment from the Prompit app.

## 6) GitHub Actions CI/CD to EC2

A scoped deployment workflow is included at `.github/workflows/deploy-ec2.yml`.

It only auto-deploys on pushes to `main` when app/deploy-relevant files change, and also supports manual deploy via `workflow_dispatch`.

Set these GitHub repository secrets:
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY` (private key for SSH auth)

Optional secrets:
- `EC2_PORT` (defaults to `22`)
- `EC2_APP_DIR` (defaults to `/opt/prompit`)

Expected EC2 host state:
- Repo checked out at `/opt/prompit` (or `EC2_APP_DIR`).
- Docker installed and available to the deployment user.
- Runtime env file (`.env.production`) present in app dir.

## Notes

- No paid third-party dependencies are required beyond AWS infrastructure.
- Duplicate upvotes are blocked by primary key `(prompt_id, user_id)`.
- Owner permissions are enforced by RLS, not just UI.
