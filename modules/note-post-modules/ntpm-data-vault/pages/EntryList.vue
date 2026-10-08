<template>
  <div>
    <!-- Cookies -->
    <div v-if="entries.cookies.length" class="q-pa-sm">
      <div class="text-caption text-grey-7">Cookies</div>
      <q-list dense>
        <q-item v-for="cookie in entries.cookies" :key="cookie.name">
          <q-item-section>
            <q-item-label>{{ cookie.name }}</q-item-label>
            <q-item-label caption class="monospace">{{ maskValue(cookie.value) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn flat dense icon="visibility" size="sm" @click="toggleReveal(cookie.name)" />
            <q-btn flat dense icon="content_copy" size="sm" @click="copy(cookie.value)" />
            <q-btn flat dense icon="delete" size="sm" color="negative" @click="emit('delete', cookie)" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Credentials -->
    <div v-if="entries.credentials.length" class="q-pa-sm">
      <div class="text-caption text-grey-7">Credentials</div>
      <q-list dense>
        <q-item v-for="cred in entries.credentials" :key="cred.username">
          <q-item-section>
            <q-item-label>{{ cred.username }}</q-item-label>
            <q-item-label caption>{{ cred.label || "—" }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn flat dense icon="visibility" size="sm" @click="toggleReveal(cred.username)" />
            <q-btn flat dense icon="content_copy" size="sm" @click="copy(cred.password)" />
            <q-btn flat dense icon="delete" size="sm" color="negative" @click="emit('delete', cred)" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import type { CookieEntry, CredentialEntry } from "../data-vault.shared";

defineProps<{
  entries: { cookies: CookieEntry[]; credentials: CredentialEntry[] };
}>();

const emit = defineEmits<{
  delete: [entry: CookieEntry | CredentialEntry];
}>();

const revealed = ref(new Set<string>());

function toggleReveal(key: string) {
  if (revealed.value.has(key)) revealed.value.delete(key);
  else revealed.value.add(key);
}

function maskValue(value: string): string {
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 3) + "•••" + value.slice(-3);
}

function copy(value: string) {
  navigator.clipboard.writeText(value);
}
</script>

<style scoped>
.monospace {
  font-family: monospace;
  font-size: 0.85em;
}
</style>
