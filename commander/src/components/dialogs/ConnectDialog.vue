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
    },
    reloadCommander() {
      window.location.reload()
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
          Reconnecting...
        </v-toolbar-title>
        <v-toolbar-title class="d-flex align-center" v-else>
          Connection Lost
        </v-toolbar-title>
      </v-toolbar>
      <v-card-text v-if="!isWebsocketConnecting">
        The Connection to the Stream Controller got lost, please reconnect.
      </v-card-text>
      <v-card-actions v-if="!isWebsocketConnecting">
        <v-btn color="warning" @click="reloadCommander">Reload</v-btn>
        <v-btn color="" @click="connectWebsocket">Reconnect</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">

</style>
