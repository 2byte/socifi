/**
 * PM2 process definition for pw.oopz.pro (the app directory keeps the name of
 * the domain it was first deployed under).
 *
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * The backend (Elysia on Bun) serves both the API and the built SPA, and is
 * exposed on the loopback interface only; nginx proxies public traffic to it.
 * Configuration (JWT secrets, port, ...) comes from back/.env, which Bun loads
 * from the working directory.
 */
module.exports = {
  apps: [
    {
      name: "socifi",
      cwd: "/var/www/pw.socifi.io/app/back",
      script: "/root/.bun/bin/bun",
      args: "run src/index.ts",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
