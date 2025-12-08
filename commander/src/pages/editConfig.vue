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
      <v-col cols="12" md="8" xl="10">
        <v-card class="sticky pa-0" color="transparent" elevation="0">
          <v-toolbar
            flat
            density="compact"
          >
            <v-toolbar-title class="d-flex align-center">
              Bot Configuration
            </v-toolbar-title>
            <v-btn
              prepend-icon="mdi-content-save"
              color="grey-darken-3"
              variant="flat"
              elevation="0"
              @click="saveConfig"
            >
              Save Config
            </v-btn>
          </v-toolbar>
          <v-card-text class="pa-0">
            <v-textarea class="my-0" style="min-height: calc(100vh - 110px);" v-model="backendConfigText" variant="outlined"></v-textarea>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col>
        <template v-if="getParsedBackendConfig?.obs?.ip">
          <OBSSettings/>
        </template>
        <v-card class="mt-3" color="transparent" elevation="0">
          <v-toolbar
            flat
            density="compact"
          >
            <v-toolbar-title class="d-flex align-center">
              Available Voices
            </v-toolbar-title>
          </v-toolbar>
          <v-card-text class="pa-0">
            <v-expansion-panels color="grey-darken-4">
              <v-expansion-panel
                v-for="(voices, voiceLanguage) in getVoices"
              >
                <v-expansion-panel-title>
                  {{ voiceLanguage }}
                </v-expansion-panel-title>

                <v-expansion-panel-text class="pa-0">
                  <v-table class="wrap-anywhere">
                    <tbody>
                    <tr v-for="voice in voices">
                      <td>{{ voice }} <CopyButton :content="voice"/></td>
                    </tr>
                    </tbody>
                  </v-table>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
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
      voiceFilter: '' as string
    }
  },
  mounted() {
    this.backendConfigText = this.getBackendConfig
    if(this.backendConfigText === '') {
      eventBus.$on('websocket:connected', () => {
        setTimeout(() => {
          this.backendConfigText = this.getBackendConfig
        }, 250)
      })
    }
  },
  computed: {
    ...mapState(useAppStore, ['getBackendConfig', 'getParsedBackendConfig', 'getObsSceneData', 'getVoices']),
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
