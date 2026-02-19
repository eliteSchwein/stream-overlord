<script setup lang="ts">

import eventBus from "@/eventBus.ts";

defineProps(['content'])

function copyToClipboard(text: string) {
  eventBus.$emit('config:write', text)
}
</script>

<template>
  <v-btn icon="mdi-content-copy" size="x-small" @click="copyToClipboard(content)"></v-btn>
</template>

<style scoped lang="scss">

</style>
