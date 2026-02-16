<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    max-width="100%"
    elevation="0"
    color="transparent"
  >
    <div
      class="mt-5 mx-5">
      <v-alert
        text="Hier gibt es keine Abfrage ob du diese Aktion auslösen willst, bitte nur auslösen wenn du dir ABSOLUT sicher bist was du machst."
        type="warning"
        icon="mdi-alert-circle"
        class="mb-5"
      ></v-alert>
      <v-card text="Twitch Verknüpfung löschen, danach bitte oben rechts den Bot neustarten." class="mb-2">
        <v-card-actions>
          <v-btn @click="triggerRecoveryApi('delete_auth')">AUTH RESET</v-btn>
        </v-card-actions>
      </v-card>
      <v-card text="Hier kannst du den Bot intern neuladen, das sollte in der Regel nichts kaputt machen." class="mb-2">
        <v-card-actions>
          <v-btn @click="triggerRecoveryApi('reload')">BOT RELOAD</v-btn>
        </v-card-actions>
      </v-card>
      <v-card text="Hier kannst du die Assets (Bilder/Videos) manuell komprimieren, das komprimiert alle Assets nochmal neu. Hier bitte Geduld, das dauert ein bisschen." class="mb-2">
        <v-card-actions>
          <v-btn @click="triggerRecoveryApi('compress_assets')">COMPRESS ASSETS</v-btn>
        </v-card-actions>
      </v-card>
    </div>
  </v-card>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";

export default {
  computed: {
    ...mapState(useAppStore, ['getRestApi']),
  },
  methods: {
    async triggerRecoveryApi(endpoint: string) {
      await fetch(`${this.getRestApi}/api/recovery/${endpoint}`)
    }
  }
}
</script>

<style lang="scss">
</style>
