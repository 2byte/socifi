# NTPM Data Vault

Personal browser data storage module. Receives browser data (cookies, credentials, device meta) via HTTP API, stores it server-side in SQLite, and displays statistics + CRUD via frontend component.

Extends `NtpmBaseModule` from `modules/note-post-modules/core/`.

## Architecture

```
ntpm-data-vault/
├── NtpmDataVaultModule.ts   — extends NtpmBaseModule, defines types + validation + custom routes
└── pages/
    ├── ntpm-main.vue         — main component (uses useNtpmApi composable)
    └── EntryList.vue         — reusable entry list (cookies + credentials)
```

**Server** — inherited from `NtpmBaseModule.createServer()`: standard CRUD routes + custom `/search` and `/stats-detail`.  
**Storage** — shared `ntpm_entries` SQLite table via `NtpmModuleStorage` (core).  
**Frontend** — uses `useNtpmApi` composable for API calls, `EntryList` for display.

## Features

- Receive data via HTTP API (`POST /entries`)
- Server-side validation and normalization
- Aggregated stats (cookies count, credentials count, domains)
- Domain search/filter
- Group data by domain
- Mask sensitive values with reveal/copy actions
- Delete individual entries
- Real-time updates via WS (`vault:new` channel)

## Data Types

| Type | Fields |
|------|--------|
| `CookieEntry` | domain, name, value, path, expires, httpOnly, secure, sameSite |
| `CredentialEntry` | domain, username, password, label, lastUsed |
| `DeviceMeta` | userAgent, platform, language, screenResolution, timezone, timestamp |

## HTTP API

All routes prefixed with `/api/post/:post_id/internal/data-vault`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stats` | Aggregated statistics |
| `GET` | `/entries` | All entries for the post |
| `GET` | `/entries/:id` | Single entry by ID |
| `POST` | `/entries` | Create new entry (accept incoming data) |
| `PUT` | `/entries/:id` | Update an existing entry |
| `DELETE` | `/entries/:id` | Delete an entry |
| `GET` | `/search?domain=x` | Search entries by domain |

## WS Channels

| Channel | Direction | Payload |
|---------|-----------|---------|
| `vault:new` | ← server | notification that new data was stored |

## Usage

```ts
import { NtpmDataVaultModule } from "./NtpmDataVaultModule";
import { createDataVaultServer } from "./servers/http-server";

// Create server for a post
const app = createDataVaultServer(postId);

// Validate incoming payload
const errors = NtpmDataVaultModule.validate(payload);
if (errors.length) throw new Error(errors.join(", "));

// Normalize
const clean = NtpmDataVaultModule.normalize(payload);

// Group by domain
const grouped = NtpmDataVaultModule.groupByDomain(clean);
```
