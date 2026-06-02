<script lang="ts">
import { mapState } from "pinia";
import { useAppStore } from "@/stores/app";
import eventBus from "@/eventBus";

export default {
  computed: {
    ...mapState(useAppStore, ["isWebsocketConnecting", "isWebsocketConnected"]),
  },
  methods: {
    connectWebsocket() {
      eventBus.$emit("websocket:reconnect", {});
    },
  },
};
</script>

<template>
  <v-dialog
    width="500"
    :model-value="!isWebsocketConnected"
    persistent
  >
    <v-card
      v-if="!isWebsocketConnected"
      :loading="isWebsocketConnecting"
    >
      <v-toolbar
        flat
        density="compact"
        color="warning"
      >
        <v-toolbar-title
          v-if="isWebsocketConnecting"
          class="d-flex align-center"
        >
          {{ $t('connectDialog.reconnecting') }}
        </v-toolbar-title>

        <v-toolbar-title
          v-else
          class="d-flex align-center"
        >
          {{ $t('connectDialog.connectionLost') }}
        </v-toolbar-title>
      </v-toolbar>

      <v-card-text v-if="!isWebsocketConnecting">
        {{ $t('connectDialog.connectionLostText') }}
      </v-card-text>

      <v-card-actions v-if="!isWebsocketConnecting">
        <v-btn @click="connectWebsocket">
          {{ $t('connectDialog.reconnect') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
</style>
