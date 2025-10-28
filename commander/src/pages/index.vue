<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    max-width="100%"
    elevation="0"
    color="transparent"
  >
    <giveaway class="mt-5 mx-5"/>
    <template v-if="getAlerts.length === 0">
      <v-alert
        class="mt-5 mx-5"
        type="info"
        color="gray-darken-3"
        text="There are currently no alerts in the Query!"
      ></v-alert>
    </template>
    <template v-else>
      <div
        class="mt-5 mx-5">
        <v-expansion-panels
        >
          <template v-for="(alert) in getAlerts">
            <activeAlert :alert="alert"/>
          </template>
        </v-expansion-panels>
      </div>
    </template>
    <template v-if="getAutoMacros.length === 0">
      <v-alert
        class="mt-5 mx-5"
        type="info"
        color="gray-darken-3"
        text="There are currently no auto macros!"
      ></v-alert>
    </template>
    <template v-else>
      <div
        class="mt-5 mx-5">
        <template v-for="(autoMacro) in getAutoMacros">
          <autoMacro :autoMacro="autoMacro"/>
        </template>
      </div>
    </template>
  </v-card>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus";
import Giveaway from "@/components/Giveaway.vue";

export default {
  components: {Giveaway},
  computed: {
    ...mapState(useAppStore, ['getAlerts', 'getAutoMacros']),
  },
  methods: {
  }
}
</script>

<style lang="scss">
</style>
