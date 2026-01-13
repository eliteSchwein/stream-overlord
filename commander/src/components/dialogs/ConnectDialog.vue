<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus";

export default {
  computed: {
    ...mapState(useAppStore, ['isWebsocketConnecting', 'isWebsocketConnected']),
  },
  methods: {
    connectWebsocket() {
      eventBus.$emit('websocket:reconnect', {})
    }
  }
}
</script>

<template>
  <v-dialog
    width="500"
    :model-value="!isWebsocketConnected"
    persistent
  >
    <v-card
      v-if="!isWebsocketConnected"
      :loading="isWebsocketConnecting">
      <v-toolbar
          flat
          density="compact"
          color="warning"
        >
        <v-toolbar-title class="d-flex align-center" v-if="isWebsocketConnecting">
          Verbinde neu...
        </v-toolbar-title>
        <v-toolbar-title class="d-flex align-center" v-else>
          Verbindung verloren
        </v-toolbar-title>
      </v-toolbar>
      <v-card-text v-if="!isWebsocketConnecting">
        Die Verbindung mit dem Bot Backend wurde verloren, neuverbinden?
      </v-card-text>
      <v-card-actions v-if="!isWebsocketConnecting">
        <v-btn color="" @click="connectWebsocket">Neu verbinden</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">

</style>
