<template>
  <div class="data-vault">
    <!-- Header -->
    <div class="data-vault__header">
      <h3>Data Vault</h3>
      <q-badge :color="stats.totalEntries ? 'positive' : 'grey'" :label="statsLabel" />
      <q-btn flat dense icon="refresh" size="sm" @click="refresh" />
    </div>

    <!-- Stats -->
    <div v-if="detailStats" class="row q-gutter-sm q-mb-md">
      <q-chip icon="cookie" color="orange-2">{{ detailStats.totalCookies }} cookies</q-chip>
      <q-chip icon="key" color="blue-2">{{ detailStats.totalCredentials }} credentials</q-chip>
      <q-chip icon="language" color="green-2">{{ detailStats.domains.length }} domains</q-chip>
    </div>

    <!-- Search -->
    <q-input
      v-model="searchDomain"
      dense outlined
      placeholder="Filter by domain..."
      class="q-mb-md"
      clearable
    >
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <!-- Domain groups -->
    <div v-if="domains.length">
      <q-list bordered separator>
        <q-expansion-item
          v-for="domain in domains"
          :key="domain"
          :label="domain"
          :caption="domainCaption(domain)"
          icon="language"
        >
          <EntryList :entries="grouped[domain]" @delete="handleDelete" />
        </q-expansion-item>
      </q-list>
    </div>

    <!-- Empty -->
    <div v-else class="text-center q-pa-xl">
      <q-icon name="lock" size="48px" color="grey-5" />
      <div class="text-grey-6 q-mt-sm">No data stored yet</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from "vue";
import { useNtpmApi } from "../../core/useNtpmApi";
import { useNtpmWs } from "../../core/useNtpmWs";
import type { DataVaultPayload, CookieEntry, CredentialEntry } from "../NtpmDataVaultModule";
import { NtpmDataVaultModule } from "../NtpmDataVaultModule";
import EntryList from "./EntryList.vue";

interface DetailStats {
  totalEntries: number;
  totalCookies: number;
  totalCredentials: number;
  domains: string[];
  lastUpdated: string | null;
}

const props = defineProps<{ postId: number }>();

const { entries, stats, statsLabel, loadAll, deleteEntry } =
  useNtpmApi<DataVaultPayload>(props.postId, "data-vault");

// WebSocket for real-time updates
// Token should come from auth store or cookie
const token = localStorage.getItem("access_token") ?? "";
const ws = useNtpmWs({ postId: props.postId, moduleSlug: "data-vault", token });

ws.onChannel("vault:new", () => refresh());
ws.onChannel("vault:deleted", () => refresh());

const detailStats = ref<DetailStats | null>(null);
const searchDomain = ref("");

const filteredEntries = computed(() => {
  if (!searchDomain.value) return entries.value;
  const lower = searchDomain.value.toLowerCase();
  return entries.value.filter((r) => {
    const p = r.payload;
    return (
      p.cookies.some((c) => c.domain.toLowerCase().includes(lower)) ||
      p.credentials.some((c) => c.domain.toLowerCase().includes(lower))
    );
  });
});

const grouped = computed(() => {
  const all = filteredEntries.value.map((r) => r.payload);
  const merged: DataVaultPayload = {
    cookies: all.flatMap((p) => p.cookies),
    credentials: all.flatMap((p) => p.credentials),
    meta: all[0]?.meta ?? { userAgent: "", platform: "", language: "", timestamp: "" },
  };
  return NtpmDataVaultModule.groupByDomain(merged);
});

const domains = computed(() => Object.keys(grouped.value).sort());

async function loadDetailStats() {
  try {
    const res = await fetch(`/api/post/${props.postId}/internal/data-vault/stats-detail`);
    detailStats.value = await res.json();
  } catch { /* ignore */ }
}

async function refresh() {
  await loadAll();
  await loadDetailStats();
}

function handleDelete(entry: CookieEntry | CredentialEntry) {
  const record = entries.value.find((r) =>
    r.payload.cookies.includes(entry) || r.payload.credentials.includes(entry)
  );
  if (record) deleteEntry(record.id);
}

function domainCaption(domain: string): string {
  const g = grouped.value[domain];
  const parts: string[] = [];
  if (g.cookies.length) parts.push(`${g.cookies.length} cookies`);
  if (g.credentials.length) parts.push(`${g.credentials.length} credentials`);
  return parts.join(", ");
}

onMounted(refresh);
</script>

<style scoped>
.data-vault__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
