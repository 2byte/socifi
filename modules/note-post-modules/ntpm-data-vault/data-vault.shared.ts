/**
 * Data Vault types and helpers that are safe to load in the browser.
 *
 * The module class (`NtpmDataVaultModule.ts`) extends the server base class and
 * pulls in SQLite, so a UI page must never import a value from it — only from
 * this file.
 */

export interface DeviceMeta {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution?: string;
  timezone?: string;
  timestamp: string;
}

export interface CookieEntry {
  domain: string;
  name: string;
  value: string;
  path: string;
  expires?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface CredentialEntry {
  domain: string;
  username: string;
  password: string;
  label?: string;
  lastUsed?: string;
}

export interface DataVaultPayload {
  cookies: CookieEntry[];
  credentials: CredentialEntry[];
  meta: DeviceMeta;
}

export type DomainGroups = Record<
  string,
  { cookies: CookieEntry[]; credentials: CredentialEntry[] }
>;

export function groupByDomain(payload: DataVaultPayload): DomainGroups {
  const groups: DomainGroups = {};

  for (const cookie of payload.cookies) {
    if (!groups[cookie.domain]) groups[cookie.domain] = { cookies: [], credentials: [] };
    groups[cookie.domain].cookies.push(cookie);
  }

  for (const cred of payload.credentials) {
    if (!groups[cred.domain]) groups[cred.domain] = { cookies: [], credentials: [] };
    groups[cred.domain].credentials.push(cred);
  }

  return groups;
}
