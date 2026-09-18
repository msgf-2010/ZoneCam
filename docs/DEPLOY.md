# Run ZoneCam on the internet (Cloudflare + cloud database + R2)

This app is a Node.js server (Next.js). It will **not** run as a Cloudflare Worker or Pages static site. Cloudflare sits in **front** of the app: DNS, HTTPS, and photo storage (R2). A host like Railway, Render, or Fly.io runs the Node process.

## What you create (three pieces)

1. **A Postgres database** — all jobs, users, notes. Not the SQLite file on your PC.
2. **A Cloudflare R2 bucket** — photos and videos.
3. **A Node host** — the website, pointed at by your domain through Cloudflare DNS.

## 1. Postgres

Create a free/paid Postgres database (Neon, Supabase, Railway Postgres, or Render Postgres). Copy the connection string. It should start with `postgresql://`.

Enable SSL if the host requires it (`?sslmode=require` is common).

## 2. Cloudflare R2

In Cloudflare: **R2** → Create bucket (e.g. `zonecam-media`).

**Manage R2 API Tokens** → create a token with Object Read & Write on that bucket. Save:

- Account ID (on the R2 overview page)
- Bucket name
- Access key ID
- Secret access key

## 3. Node host env vars

Set these on Railway/Render/Fly (not in git):

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
AUTH_SECRET=at-least-32-random-characters
APP_URL=https://your-domain.com
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=your-account-id
R2_BUCKET=zonecam-media
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
TRUST_CLOUDFLARE=true
EMAIL_DRIVER=console
JOBS_DRIVER=inline
AI_DRIVER=internal
PAYMENTS_DRIVER=internal
```

Generate `AUTH_SECRET` with a password manager or:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`APP_URL` must be the public HTTPS URL (your domain), not localhost.

## 4. Deploy the app

Build/start (the Dockerfile already does this):

```
npm ci
npx prisma generate
npx prisma db push
npx next build
node scripts/start.mjs
```

`prisma db push` creates tables on the **empty** Postgres database. Do not point `DATABASE_URL` at a database you care about unless you intend to apply this schema.

Health check after deploy: `https://your-domain.com/api/v1/health` should return `"ok": true` and `"db": "up"`.

## 5. Domain on Cloudflare

1. Add the domain to Cloudflare (nameservers at your registrar).
2. DNS **A** or **CNAME** to the Node host (Railway/Render/Fly). Proxy status: **Proxied** (orange cloud).
3. SSL/TLS mode: **Full (strict)** once the host has a valid cert, or **Full** if the host uses a shared cert. Avoid **Flexible** (HTTP to origin).
4. Set `APP_URL` to `https://your-domain.com` and redeploy if you created the DNS record after the first deploy.

## What this does not do

- It does not copy your local `dev.db` or `./storage` folder to the cloud. New companies and photos live in Postgres + R2.
- QuickBooks/Jobber/Google are still not connected.
- Email still prints to the **server log** until you add SMTP.
- Cloudflare Pages/Workers cannot host this process.

Local `npm run dev` can stay on SQLite + local disk. Production uses Postgres + R2 when those env vars are set.
