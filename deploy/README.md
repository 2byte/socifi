# Production deployment

Target: **https://pw.oopz.pro** (Ubuntu 24.04, shared with other projects). The app was first deployed as `pw.socifi.io`; the app directory still carries that name.

| Item | Value |
| --- | --- |
| App directory | `/var/www/pw.socifi.io/app` |
| Runtime | Bun (`/root/.bun/bin/bun`) |
| Local port | `127.0.0.1:3075` (behind nginx) |
| PM2 app | `socifi` (`deploy/ecosystem.config.cjs`) |
| nginx site | `/etc/nginx/sites-available/pw.oopz.pro.conf` (`deploy/nginx-pw.oopz.pro.conf`) |
| Databases | `app/back/database/socifi.sqlite`, `app/back/database/ntpm-modules.db` |
| Environment | `app/back/.env` (mode `600`, created on first deploy) |

The domain is proxied through Cloudflare in "Full (strict)" SSL mode, applied by a Configuration
Rule for the `pw.oopz.pro` hostname only (the zone default and `jobmail.oopz.pro` stay on Flexible).
nginx serves 443 with a Cloudflare Origin CA certificate (`/etc/ssl/cloudflare/oopz.pro.{pem,key}`, a wildcard for `*.oopz.pro`, shared with the other sites)
and still answers on port 80 without a redirect. The server also hosts other sites — touch only the
`socifi` PM2 process and the `pw.oopz.pro` nginx site.

### Enabling Full (strict)

1. Cloudflare → `oopz.pro` → SSL/TLS → Origin Server → Create Certificate (RSA, hostname
   `*.oopz.pro` + `oopz.pro`, 15 years). Save the certificate and the private key.
2. On the server:
   ```bash
   mkdir -p /etc/ssl/cloudflare
   # paste the certificate into oopz.pro.pem and the key into oopz.pro.key
   chmod 600 /etc/ssl/cloudflare/oopz.pro.key
   ```
3. Install the nginx config (see below) and `nginx -t && systemctl reload nginx`.
4. Cloudflare → Rules → Configuration Rules → hostname equals `pw.oopz.pro` → SSL: Full (strict).
5. Check `curl -I https://pw.oopz.pro/api/health`.

The backend serves both the API and the built SPA. The SPA calls `/api/...`, which
nginx forwards with the prefix removed (the dev server does the same); that location
also upgrades to WebSocket for the note-post modules.

## Redeploy

```bash
bash deploy/deploy.sh
```

Connection settings are read from `deploy/.env` (`PROD_SERVER_IP`, `PROD_SERVER_USER`,
`PROD_SERVER_KEY_PATH`; git-ignored). The script builds the SPA, uploads `back/`,
`modules/`, `shared/` and `front/dist/spa`, runs `bun install --production` in `back/`
and `modules/`, applies the migrations (`bun run db:migrate`) and runs
`pm2 startOrReload`. It never touches the databases or `back/.env`.

`back/.env` is generated once with random `JWT_SECRET` / `JWT_REFRESH_SECRET`,
`PORT=3075`, `FRONTEND_URL=https://pw.oopz.pro` (re-synced on every deploy) and `COOKIE_SECURE=true`. Rotating
`JWT_SECRET` signs everyone out.

## Schema changes

Change `back/src/db/schema.ts`, then `cd back && bunx drizzle-kit generate`, commit the
new file in `back/database/migrations/`, and deploy — migrations run automatically.

## nginx (first time or when the config changes)

```bash
scp deploy/nginx-pw.oopz.pro.conf root@<server>:/etc/nginx/sites-available/pw.oopz.pro.conf
ssh root@<server> 'ln -sfn /etc/nginx/sites-available/pw.oopz.pro.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx'
```

The earlier `pw.socifi.io` site config was disabled (its file remains in `sites-available`, and
backups are in `/root/pw.socifi.io.conf.bak-*`). Files left in `/var/www/pw.socifi.io` by an older
project are untouched.

## Operations

```bash
pm2 status socifi
pm2 logs socifi --lines 100
pm2 restart socifi --update-env
curl https://pw.oopz.pro/api/health
```

## Attachments and shared links

Files attached to notes and posts are stored on disk in `app/back/database/uploads` (override with
`UPLOADS_DIR`), next to the databases: `deploy.sh` excludes that folder and never deletes it. The size
limit is `MAX_UPLOAD_BYTES` (25 MB by default); nginx `client_max_body_size` is 30m to match, so after
changing the limit update the nginx site too (see "nginx" above). Back up `database/uploads` together with
`socifi.sqlite`. Public links open `/#/s/<token>` and read through `/api/public/<token>`; turning a link off
deletes its row, so the old URL stops working at once.
