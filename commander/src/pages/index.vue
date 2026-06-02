<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    max-width="100%"
    elevation="0"
    color="transparent"
  >
    <div class="dashboard-layout mx-4">
      <div class="dashboard-layout__left">
        <giveaway class="mt-5" />

        <template v-if="getAlerts.length === 0">
          <v-alert
            class="mt-5"
            type="info"
            color="gray-darken-3"
            text="Es sind derzeit keine Alerts!"
          />
        </template>
        <template v-else>
          <div class="mt-5">
            <v-expansion-panels>
              <template v-for="alert in getAlerts" :key="alert.id">
                <activeAlert :alert="alert" />
              </template>
            </v-expansion-panels>
          </div>
        </template>

        <template v-if="getAutoMacros.length === 0">
          <v-alert
            class="mt-5"
            type="info"
            color="gray-darken-3"
            text="Es gibt aktuell keine automatischen Makros!"
          />
        </template>
        <template v-else>
          <div class="mt-5">
            <template v-for="autoMacro in getAutoMacros" :key="autoMacro.name">
              <autoMacro :autoMacro="autoMacro" />
            </template>
          </div>
        </template>
      </div>

      <div class="dashboard-layout__right">
        <MusicControls class="mt-5" />
      </div>
    </div>
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import Giveaway from '@/components/Giveaway.vue'
import MusicControls from "@/components/MusicControls.vue";

export default {
  components: {
    Giveaway,
    MusicControls,
  },
  computed: {
    ...mapState(useAppStore, ['getAlerts', 'getAutoMacros']),
  },
}
</script>

<style lang="scss">
.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 16px;
  align-items: start;
}

.dashboard-layout__left,
.dashboard-layout__right {
  min-width: 0;
}

@media (max-width: 959px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
}
</style>
