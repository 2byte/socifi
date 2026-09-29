/**
 * Data Vault Repository
 *
 * Storage layer for vault entries. Stores data in module's own storage
 * (file-based JSON or in-memory, depending on environment).
 */

import type { DataVaultPayload, CookieEntry, CredentialEntry } from "../NtpmDataVaultModule";

export interface VaultRecord {
  id: string;
  postId: number;
  createdAt: string;
  updatedAt: string;
  payload: DataVaultPayload;
}

export interface VaultStats {
  totalRecords: number;
  totalCookies: number;
  totalCredentials: number;
  domains: string[];
  lastUpdated: string | null;
}

export class DataVaultRepository {
  private records: Map<string, VaultRecord> = new Map();
  private nextId = 1;

  /**
   * Store a new vault entry.
   */
  create(postId: number, payload: DataVaultPayload): VaultRecord {
    const id = String(this.nextId++);
    const now = new Date().toISOString();
    const record: VaultRecord = { id, postId, createdAt: now, updatedAt: now, payload };
    this.records.set(id, record);
    return record;
  }

  /**
   * Get all records for a post.
   */
  findByPostId(postId: number): VaultRecord[] {
    return [...this.records.values()].filter((r) => r.postId === postId);
  }

  /**
   * Get single record by id.
   */
  findById(id: string): VaultRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Update an existing record.
   */
  update(id: string, payload: DataVaultPayload): VaultRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    record.payload = payload;
    record.updatedAt = new Date().toISOString();
    return record;
  }

  /**
   * Delete a record.
   */
  delete(id: string): boolean {
    return this.records.delete(id);
  }

  /**
   * Get aggregated stats for a post.
   */
  stats(postId: number): VaultStats {
    const records = this.findByPostId(postId);
    const allCookies = records.flatMap((r) => r.payload.cookies);
    const allCredentials = records.flatMap((r) => r.payload.credentials);
    const domains = new Set([
      ...allCookies.map((c) => c.domain),
      ...allCredentials.map((c) => c.domain),
    ]);
    const lastUpdated = records.length
      ? records.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt
      : null;

    return {
      totalRecords: records.length,
      totalCookies: allCookies.length,
      totalCredentials: allCredentials.length,
      domains: [...domains].sort(),
      lastUpdated,
    };
  }

  /**
   * Search entries by domain.
   */
  findByDomain(postId: number, domain: string): VaultRecord[] {
    const lower = domain.toLowerCase();
    return this.findByPostId(postId).filter((r) =>
      r.payload.cookies.some((c) => c.domain.toLowerCase().includes(lower)) ||
      r.payload.credentials.some((c) => c.domain.toLowerCase().includes(lower))
    );
  }
}
