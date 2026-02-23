# PocketBase on EC2 (lightweight)

PocketBase is a single binary service and much lighter than a full Supabase stack.

## Local dev pattern (no Docker)

From project root:

```bash
mkdir -p bin pb_data
# Move downloaded PocketBase binary to:
#   bin/pocketbase
chmod +x bin/pocketbase
```

Set local env (`.env`):

```env
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8091
NEXT_PUBLIC_COMPANY_DOMAIN=mit.edu
NEXT_PUBLIC_AUTH_MODE=email
```

Run local app + PocketBase together:

```bash
npm run dev
```

This starts:
- Next.js at `http://localhost:3000`
- PocketBase at `http://127.0.0.1:8091`

## Run with Docker

```bash
docker run -d \
  --name pocketbase \
  --restart unless-stopped \
  -p 8090:8090 \
  -v /opt/pocketbase/pb_data:/pb/pb_data \
  ghcr.io/muchobien/pocketbase:latest \
  --http=0.0.0.0:8090
```

## First-time admin setup

1. Open `http://<ec2-host>:8090/_/`.
2. Create admin user.
3. Bootstrap Prompit collections with script:

```bash
POCKETBASE_URL=http://127.0.0.1:8090 \
POCKETBASE_ADMIN_EMAIL=admin@example.com \
POCKETBASE_ADMIN_PASSWORD='your-admin-password' \
COMPANY_DOMAIN=mit.edu \
bash infra/pocketbase/bootstrap-collections.sh
```

4. Configure auth providers (Google for production).

## Connect Next.js app to the right PocketBase

- Local dev (`.env`):
  - `NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090`
  - `NEXT_PUBLIC_AUTH_MODE=email`
- Production (AWS Secrets Manager env used by CI deploy):
  - `NEXT_PUBLIC_POCKETBASE_URL=https://pocketbase.your-domain.com`
  - `NEXT_PUBLIC_AUTH_MODE=google`
  - `NEXT_PUBLIC_COMPANY_DOMAIN=mit.edu`

The app only reads `NEXT_PUBLIC_POCKETBASE_URL` for backend connection, so this value must point to the target PocketBase instance.

## Recommended production setup

- Put PocketBase behind ALB or reverse proxy and HTTPS.
- Restrict inbound EC2 security group to proxy/ALB only.
- Back up `/opt/pocketbase/pb_data` regularly.
- Use a dedicated systemd service or separate container for production runtime.
