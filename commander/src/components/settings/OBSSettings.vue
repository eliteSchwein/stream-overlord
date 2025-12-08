<template>
  <v-card color="transparent" elevation="0">
    <v-toolbar
      flat
      density="compact"
    >
      <v-toolbar-title class="d-flex align-center">
        OBS Scenes
      </v-toolbar-title>
    </v-toolbar>

    <v-card-text class="pa-0">
      <template v-if="getScene?.background">
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
                    <td>{{ obsScene.uuid }} <CopyButton :content="obsScene.uuid"/> </td>
                  </tr>
                  <tr>
                    <td>Index</td>
                    <td>{{ obsScene.index }} <CopyButton :content="obsScene.index"/> </td>
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
                        <v-table class="wrap-anywhere">
                          <tbody>
                          <tr>
                            <td>UUID</td>
                            <td>{{ obsItem.uuid }} <CopyButton :content="obsItem.uuid"/></td>
                          </tr>
                          <tr>
                            <td>ID</td>
                            <td>{{ obsItem.id }} <CopyButton :content="obsItem.id"/></td>
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
      </template>
      <template v-else>
        <v-img
          aspect-ratio="16/9"
          cover
          :src="noObs"
        />
      </template>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus";
import noObs from "@/assets/no_obs.png"

export default {
  data() {
    return {
      noObs
    }
  },
  computed: {
    ...mapState(useAppStore, ['getObsSceneData', 'getScene']),
  },
  methods: {
  },
}
</script>

<style scoped lang="scss">

</style>
