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
      <v-col cols="8">
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
        <v-card class="mt-3" color="transparent" elevation="0">
          <v-toolbar
            flat
            density="compact"
          >
            <v-toolbar-title class="d-flex align-center">
              OBS Scenes
            </v-toolbar-title>
          </v-toolbar>

          <v-card-text class="pa-0">
            <div>
              <v-expansion-panels color="grey-darken-4">
                <v-expansion-panel
                  v-for="obsScene in getObsSceneData"
                  :key="obsScene.uuid || obsScene.index"
                >
                  <v-expansion-panel-title>
                    {{ obsScene.name }}
                  </v-expansion-panel-title>

                  <v-expansion-panel-text class="pa-0">
                    <v-table>
                      <tbody>
                      <tr>
                        <td>UUID</td>
                        <td>{{ obsScene.uuid }}</td>
                      </tr>
                      <tr>
                        <td>Index</td>
                        <td>{{ obsScene.index }}</td>
                      </tr>
                      </tbody>
                    </v-table>


                    <template v-if="obsScene.items === 0">

                    </template>
                    <template v-else>
                      <!-- nested panels for items -->
                      <v-expansion-panels multiple class="mt-2">
                        <v-expansion-panel
                          color="grey-darken-3"
                          v-for="obsItem in obsScene.items"
                          :key="obsItem.uuid || obsItem.id"
                        >
                          <v-expansion-panel-title>
                            {{ obsItem.name }}
                          </v-expansion-panel-title>

                          <v-expansion-panel-text class="pa-0">
                            <v-table>
                              <tbody>
                              <tr>
                                <td>UUID</td>
                                <td>{{ obsItem.uuid }}</td>
                              </tr>
                              <tr>
                                <td>ID</td>
                                <td>{{ obsItem.id }}</td>
                              </tr>
                              </tbody>
                            </v-table>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                      </v-expansion-panels>
                    </template>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
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
    }
  },
  mounted() {
    this.backendConfigText = this.getBackendConfig
  },
  computed: {
    ...mapState(useAppStore, ['getBackendConfig', 'getObsSceneData']),
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
.v-expansion-panel-text {
  &.pa-0 {
    .v-expansion-panel-text__wrapper {
      padding: 0 !important;
    }
  }
}
</style>
