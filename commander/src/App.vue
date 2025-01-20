<template>
  <v-app>
    <v-card>
      <v-layout style="min-height: 100vh; max-height: 100vh">
        <Navigation></Navigation>
        <router-view />
      </v-layout>
    </v-card>
  </v-app>
</template>

<script lang="ts" setup>
  import { useAppStore } from '@/stores/app';

  const appOption = useAppStore();

  onMounted(async () => {
    await appOption.fetchConfig()
    await appOption.fetchGames()

    console.log(appOption.getGames)
  })
</script>

<style>
html {
  overflow: hidden;
}
</style>
