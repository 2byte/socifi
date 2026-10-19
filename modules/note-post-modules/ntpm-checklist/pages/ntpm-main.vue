<template>
  <div class="checklist">
    <form v-if="!readonly" class="checklist__add" @submit.prevent="add">
      <q-input
        v-model="draft"
        dense
        outlined
        placeholder="Add an item"
        class="col"
        :disable="busy"
      />
      <q-btn type="submit" color="primary" icon="add" label="Add" :loading="busy" :disable="!draft.trim()" />
    </form>

    <q-banner v-if="error" class="checklist__error">{{ error }}</q-banner>

    <q-list v-if="items.length" class="checklist__list">
      <q-item
        v-for="item in items"
        :key="item.id"
        tag="label"
        class="checklist__item"
        :class="{ 'checklist__item--done': item.payload.done }"
      >
        <q-item-section side>
          <q-checkbox
            :model-value="item.payload.done"
            :disable="readonly"
            @update:model-value="toggle(item.id, item.payload.text, $event)"
          />
        </q-item-section>
        <q-item-section class="checklist__text">{{ item.payload.text }}</q-item-section>
        <q-item-section v-if="!readonly" side>
          <q-btn flat dense round icon="close" aria-label="Delete" @click.prevent="remove(item.id)" />
        </q-item-section>
      </q-item>
    </q-list>
    <div v-else-if="!loading" class="checklist__empty">Nothing here yet.</div>

    <div class="checklist__foot">
      <span>{{ doneCount }} / {{ items.length }} done</span>
      <span :class="ws.connected.value ? 'checklist__live' : ''">
        {{ ws.connected.value ? "live" : "offline" }}
      </span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useNtpmApi } from "../../core/useNtpmApi";
import { useNtpmWs } from "../../core/useNtpmWs";
import type { ChecklistItem } from "../NtpmChecklistModule";

const props = defineProps<{
  postId: number;
  token: string;
  apiRoot?: string;
  /** Set by the host for a guest who may look but not change anything. */
  readonly?: boolean;
}>();

const api = useNtpmApi<ChecklistItem>(props.postId, "checklist", {
  token: props.token,
  apiRoot: props.apiRoot,
});
const ws = useNtpmWs({
  postId: props.postId,
  moduleSlug: "checklist",
  token: props.token,
  apiRoot: props.apiRoot,
});

const draft = ref("");
const busy = ref(false);
const { loading, error } = api;

// Oldest first, so a new item lands at the bottom like on paper.
const items = computed(() =>
  [...api.entries.value].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
);
const doneCount = computed(() => items.value.filter((i) => i.payload.done).length);

async function add() {
  const text = draft.value.trim();
  if (!text) return;
  busy.value = true;
  const created = await api.createEntry({ text, done: false });
  busy.value = false;
  if (created) draft.value = "";
}

function toggle(id: string, text: string, done: boolean) {
  return api.updateEntry(id, { text, done });
}

function remove(id: string) {
  return api.deleteEntry(id);
}

// The socket opens right away; the subscription is sent once it is up.
ws.socket.value?.addEventListener("open", () => ws.subscribe("checklist:changed"));
ws.onChannel("checklist:changed", () => api.loadEntries());

onMounted(() => api.loadEntries());
</script>

<style scoped>
.checklist__add {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.checklist__list {
  padding: 0;
}

.checklist__item {
  min-height: 40px;
}

.checklist__item--done .checklist__text {
  opacity: 0.55;
  text-decoration: line-through;
}

.checklist__empty,
.checklist__foot {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.checklist__empty {
  padding: 12px 0;
}

.checklist__foot {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
}

.checklist__live {
  color: var(--color-success-fg);
}

.checklist__error {
  margin-bottom: 8px;
  background: var(--color-danger-bg);
  color: var(--color-danger-fg);
}
</style>
