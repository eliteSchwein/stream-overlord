<template>
  <v-app>
    <v-card
      color="transparent"
      rounded="0"
    >
      <v-layout style="min-height: 100vh; max-height: 100vh">
        <Navigation></Navigation>
        <router-view />
      </v-layout>
    </v-card>
    <ConnectDialog></ConnectDialog>
  </v-app>
</template>

<script lang="ts" setup>
  import { useAppStore } from '@/stores/app';
  import WebsocketClient from "@/plugins/webSocketClient";
  import eventBus from "@/eventBus";

  const appOption = useAppStore()
  let websocket: WebsocketClient|undefined = undefined

  eventBus.$on('websocket:reconnect', (data) => {
    if(!websocket) {
      return
    }

    void websocket.connect()
  })

  eventBus.$on('websocket:send', (data) => {
    websocket?.send(data.method, data.params)
  })

  onMounted(async () => {
    await appOption.fetchConfig()
    await appOption.fetchGames()

    websocket = new WebsocketClient(appOption.getWebsocket, appOption)
    await websocket.connect()
  })
</script>

<style>
html {
  overflow: hidden;
}
</style>
