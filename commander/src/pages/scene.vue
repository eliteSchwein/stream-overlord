<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    elevation="0"
    color="transparent"
    max-width="100%"
  >
    <v-row class="mx-3 my-2">
      <v-col cols="8">
        <v-img
          style="border-radius: 5px"
          aspect-ratio="16/9"
          cover
          :src="getScene?.background ?? noObs"
        />
      </v-col>

      <v-col>

        <v-card class="px-4 py-3">
          <v-row
            align-content="center"
            justify="center"
            align="center"
            dense
          >
            <v-col cols="12">
              <v-btn
                width="100%"
                prepend-icon="mdi-content-save"
                color="grey-darken-3"
                variant="flat"
                elevation="0"
                @click="saveItems"
              >
                Save Scene
              </v-btn>
            </v-col>
            <v-col cols="12">
              <v-btn
                width="100%"
                prepend-icon="mdi-reload"
                color="grey-darken-3"
                variant="flat"
                elevation="0"
                @click="refreshitems"
              >
                Reload Scene
              </v-btn>
            </v-col>
            <v-col cols="12">
              <v-btn
                width="100%"
                :prepend-icon="getTestMode ? 'mdi-test-tube' : 'mdi-test-tube-off'"
                :color="getTestMode ? 'orange-darken-2' : 'grey-darken-3'"
                variant="flat"
                elevation="0"
                @click="toggleTestMode"
              >
                Test Mode
              </v-btn>
            </v-col>
          </v-row>
        </v-card>

        <currentGame class="mt-5"></currentGame>
      </v-col>
    </v-row>
  </v-card>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus.ts";
import noObs from "@/assets/no_obs.png"

export default {
  data() {
    return {
      noObs,
    };
  },
  computed: {
    ...mapState(useAppStore, ['getScene', 'getCurrentGame', 'getTestMode']),
  },
  methods: {
    saveItems() {
      eventBus.$emit('websocket:send', {
        method: 'save_source',
        params: {}
      })
    },
    refreshitems() {
      eventBus.$emit('websocket:send', {
        method: 'refresh_source',
        params: {}
      })
    },
    toggleTestMode() {
      eventBus.$emit('websocket:send', {
        method: 'toggle_test_mode',
        params: { active: !this.getTestMode }
      })
    }
  }
}
</script>
