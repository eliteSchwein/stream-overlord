<template>
  <v-img
    v-bind="$attrs"
    :src="imgUrl"
    :lazy-src="lazySrc"
    :cover="cover"
  >
    <template #placeholder>
      <div class="d-flex align-center justify-center h-100">
        <v-progress-circular indeterminate />
      </div>
    </template>
  </v-img>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import {useAppStore} from "@/stores/app.ts";

const appOption = useAppStore();

const props = defineProps<{
  src: string;
  lazySrc?: string;
  cover?: boolean;
  debounceMs?: number;
}>();

const imgUrl = ref<string>("");

let debounceTimer: any = null;
let abortController: AbortController | null = null;
let lastObjectUrl: string | null = null;

function setObjectUrl(url: string) {
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = url;
  imgUrl.value = url;
}

async function fetchPreview(target: string) {
  abortController?.abort();
  abortController = new AbortController();

  const resp = await fetch(`${appOption.getRestApi}/api/yolobox/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target }),
    signal: abortController.signal,
  });

  if (!resp.ok) {
    // optional: you can handle errors more explicitly
    // const j = await resp.json().catch(() => null);
    // throw new Error(j?.error || `Request failed (${resp.status})`);
    throw new Error(`Preview request failed (${resp.status})`);
  }

  const blob = await resp.blob();
  setObjectUrl(URL.createObjectURL(blob));
}

watch(
  () => props.src,
  (t) => {
    if (!t) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchPreview(t).catch((e) => {
        // ignore aborts / keep previous image on transient failures
        if ((e as any)?.name !== "AbortError") {
          // console.warn("preview error:", e);
        }
      });
    }, props.debounceMs ?? 120);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
  abortController?.abort();
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
});
</script>
