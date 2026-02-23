# Prompit MVP

Internal office hub for sharing and voting on AI prompts.

## MVP scope

Included now:
- Auth via PocketBase (`email/password` for local dev, `Google OAuth` for production).
- Prompt gallery with sorting by Noise (upvotes), Newest, and Most Echoed (copies).
- Real-time fuzzy search across title/content/category/tags.
- Prompt card actions: Copy, Noise, Echo, Edit/Delete (owner in UI).
- Composer modal with variable detection (`{{variable_name}}`) and max length 4000.

Deferred:
- Advanced moderation flows
- Analytics dashboards
- Notification system
- Full version history UI

## Stack

- Frontend: Next.js 15 (App Router), Tailwind CSS, Lucide React
- Backend/Auth/DB: PocketBase (self-hosted)
- Infra: AWS EC2 + Docker, ECR + GitHub Actions deploy

## 1) Local app setup

1. Install deps:
```bash
npm install
```
2. Place PocketBase binary in this repo:
```bash
mkdir -p bin pb_data
# Move your downloaded binary to:
#   bin/pocketbase
chmod +x bin/pocketbase
```
3. Create env:
```bash
cp .env.example .env
```
4. Fill in:
- `NEXT_PUBLIC_POCKETBASE_URL`
- `NEXT_PUBLIC_COMPANY_DOMAIN`
- `NEXT_PUBLIC_AUTH_MODE=email`
5. Run both PocketBase + Next.js:
```bash
npm run dev
```

## 2) PocketBase setup (minimum required schema)

Use the bootstrap script:

```bash
POCKETBASE_URL=http://127.0.0.1:8090 \
POCKETBASE_ADMIN_EMAIL=admin@example.com \
POCKETBASE_ADMIN_PASSWORD='your-admin-password' \
COMPANY_DOMAIN=mit.edu \
bash infra/pocketbase/bootstrap-collections.sh
```

This creates/updates required collections:
- `users` (auth collection)
- `prompts`
- `prompt_votes`
- `prompt_copies`

Recommended PocketBase API rules:
- `prompts` list/view/create/update/delete: authenticated users only
- `prompts` update/delete: `author = @request.auth.id`
- `prompt_votes` create: authenticated users only + unique index prevents duplicate votes
- `prompt_copies` create: authenticated users only

Optional domain restriction (recommended):
- Add rule fragments enforcing email domain (example `mit.edu`) in each collection rule:
  - `@request.auth.email ~ ".+@mit\\.edu$"`

## 3) Production Google OAuth setup

In PocketBase Admin:
- Enable Google OAuth provider for `users` auth collection.
- Set app URL/callback as required by PocketBase OAuth settings.

In Google Cloud OAuth app:
- Add PocketBase OAuth callback URL from your PocketBase provider setup.
- Add production app domain (`prompit.yourdomain.com`) to allowed origins where required.

In app runtime env:
- `NEXT_PUBLIC_AUTH_MODE=google`

## 4) Allowlist-only user management (no signup)

Current production-safe MVP pattern:
- Keep app in `NEXT_PUBLIC_AUTH_MODE=email`
- Do not expose signup in UI
- Superuser manually creates/removes users in PocketBase `users` collection

Create allowlisted user (PocketBase Admin UI):
1. Open PocketBase Admin -> `users` collection.
2. Click `New record`.
3. Fill `email` (must match your allowed domain, e.g. `@mit.edu`) and `password`.
4. Save and share credentials securely with the user.

Remove user access:
1. Open `users` collection.
2. Delete the user record.

Reset password:
1. Open user record.
2. Set a new password.
3. Save.

Notes:
- Do not use PocketBase superuser credentials in the app.
- App/domain restrictions still apply (for example `@mit.edu`).

## 5) Deploy app on EC2

App deploy is automated via `.github/workflows/deploy-ec2.yml`:
- Build image in GitHub Actions
- Push to ECR
- SSH to EC2, pull image, run container

Container host port defaults to `3001` and maps to app port `3001` inside container.

## 6) Required CI/CD configuration

GitHub secrets:
- `EC2_SSH_KEY`
- `EC2_HOST`
- Optional: `EC2_PORT`

GitHub variables:
- `AWS_ROLE_TO_ASSUME`
- `AWS_REGION`
- `ECR_REPOSITORY`
- `NEXT_PUBLIC_POCKETBASE_URL` (or `NEXT_PUBLIC_PB_URL`)
- `NEXT_PUBLIC_COMPANY_DOMAIN`
- `NEXT_PUBLIC_AUTH_MODE` (`email` or `google`)
- Optional: `APP_CONTAINER_NAME`, `APP_HOST_PORT`, `APP_CONTAINER_PORT`
