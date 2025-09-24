<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    max-width="100%"
    elevation="0"
    color="transparent"
    min-height="100%"
  >
    <v-row class="mx-3 my-2 mb-0 pb-0">
      <v-col cols="9">
        <v-textarea  style="min-height: calc(100vh - 90px)" v-model="backendConfigText" variant="outlined"></v-textarea>
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
                @click="saveConfig"
              >
                Save Config
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
import eventBus from "@/eventBus";

export default {
  data() {
    return {
      backendConfigText: '' as string,
    }
  },
  mounted() {
    this.backendConfigText = this.getBackendConfig
  },
  computed: {
    ...mapState(useAppStore, ['getBackendConfig']),
  },
  methods: {
    saveConfig() {
      eventBus.$emit('websocket:send', {
        method: 'update_config',
        params: {'data': this.backendConfigText}
      })
    }
  },
}
</script>

<style lang="scss">
</style>
