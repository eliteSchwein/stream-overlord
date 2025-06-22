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
          style="border-radius: 10px"
          aspect-ratio="16/9"
          cover
          :src="getScene.background"
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
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-card>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus.ts";
export default {
  computed: {
    ...mapState(useAppStore, ['getScene']),
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
    }
  }
}
</script>
