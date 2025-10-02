<script setup lang="ts">

defineProps(['content'])

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}
</script>

<template>
  <v-btn icon="mdi-content-copy" size="x-small" @click="copyToClipboard(content)"></v-btn>
</template>

<style scoped lang="scss">

</style>
