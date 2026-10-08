# Production deployment

Target: **https://pw.socifi.io** (Ubuntu 24.04, shared with other projects).

| Item | Value |
| --- | --- |
| App directory | `/var/www/pw.socifi.io/app` |
| Runtime | Bun (`/root/.bun/bin/bun`) |
| Local port | `127.0.0.1:3075` (behind nginx) |
| PM2 app | `socifi` (`deploy/ecosystem.config.cjs`) |
| nginx site | `/etc/nginx/sites-available/pw.socifi.io.conf` (`deploy/nginx-pw.socifi.io.conf`) |
| Databases | `app/back/database/socifi.sqlite`, `app/back/database/ntpm-modules.db` |
| Environment | `app/back/.env` (mode `600`, created on first deploy) |

The domain is proxied through Cloudflare, which terminates TLS, so the origin only
serves plain HTTP on port 80. The server also hosts other sites — touch only the
`socifi` PM2 process and the `pw.socifi.io` nginx site.

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
`PORT=3075`, `FRONTEND_URL=https://pw.socifi.io` and `COOKIE_SECURE=true`. Rotating
`JWT_SECRET` signs everyone out.

## Schema changes

Change `back/src/db/schema.ts`, then `cd back && bunx drizzle-kit generate`, commit the
new file in `back/database/migrations/`, and deploy — migrations run automatically.

## nginx (first time or when the config changes)

```bash
scp deploy/nginx-pw.socifi.io.conf root@<server>:/etc/nginx/sites-available/pw.socifi.io.conf
ssh root@<server> 'ln -sfn /etc/nginx/sites-available/pw.socifi.io.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx'
```

The previous site on this domain (proxy to port 3068, files in `/var/www/pw.socifi.io`)
was left in place; its nginx config was saved as `/root/pw.socifi.io.conf.bak-*`.

## Operations

```bash
pm2 status socifi
pm2 logs socifi --lines 100
pm2 restart socifi --update-env
curl https://pw.socifi.io/api/health
```
