/**
 * useNtpmApi — Vue composable for NTPM module API calls.
 *
 * Provides a consistent interface for all modules to interact
 * with their server-side HTTP API.
 */

import { ref, computed, type Ref } from "vue";

export interface NtpmEntry<T = unknown> {
  id: string;
  moduleSlug: string;
  postId: number;
  payload: T;
  createdAt: string;
  updatedAt: string;
}

export interface NtpmStats {
  totalEntries: number;
  lastUpdated: string | null;
}

export function useNtpmApi<TPayload>(postId: number, moduleSlug: string) {
  const apiBase = `/api/post/${postId}/internal/${moduleSlug}`;
  const entries: Ref<NtpmEntry<TPayload>[]> = ref([]);
  const stats: Ref<NtpmStats> = ref({ totalEntries: 0, lastUpdated: null });
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── Fetchers ─────────────────────────────────────────────

  async function loadEntries(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await fetch(`${apiBase}/entries`).then((r) => r.json());
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function loadStats(): Promise<void> {
    try {
      stats.value = await fetch(`${apiBase}/stats`).then((r) => r.json());
    } catch (e) {
      error.value = String(e);
    }
  }

  async function loadAll(): Promise<void> {
    await Promise.all([loadEntries(), loadStats()]);
  }

  // ── CRUD ─────────────────────────────────────────────────

  async function createEntry(payload: TPayload): Promise<NtpmEntry<TPayload> | null> {
    try {
      const res = await fetch(`${apiBase}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        error.value = await res.text();
        return null;
      }
      const record = await res.json() as NtpmEntry<TPayload>;
      await loadAll();
      return record;
    } catch (e) {
      error.value = String(e);
      return null;
    }
  }

  async function updateEntry(id: string, payload: TPayload): Promise<boolean> {
    try {
      const res = await fetch(`${apiBase}/entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        error.value = await res.text();
        return false;
      }
      await loadAll();
      return true;
    } catch (e) {
      error.value = String(e);
      return false;
    }
  }

  async function deleteEntry(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${apiBase}/entries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        error.value = await res.text();
        return false;
      }
      await loadAll();
      return true;
    } catch (e) {
      error.value = String(e);
      return false;
    }
  }

  // ── Computed ─────────────────────────────────────────────

  const statsLabel = computed(() => `${stats.value.totalEntries} entries`);

  return {
    entries,
    stats,
    loading,
    error,
    statsLabel,
    loadEntries,
    loadStats,
    loadAll,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
