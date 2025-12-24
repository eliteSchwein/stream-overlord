<template>
  <template v-if="getParsedBackendConfig.yolobox?.enable && getYoloboxData.MixerList">
    <v-card class="mt-3" color="transparent" elevation="0">
      <v-toolbar
        flat
        density="compact"
      >
        <v-toolbar-title class="d-flex align-center">
          Yolobox Macros
        </v-toolbar-title>
      </v-toolbar>

      <v-card-text class="pa-0">
        <v-expansion-panels color="grey-darken-4">
          <v-expansion-panel>
            <v-expansion-panel-title>
              Video Sources
            </v-expansion-panel-title>
            <v-expansion-panel-text class="pa-0">
              <v-table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style="width: 100px">Actions</th>
                  </tr>
                </thead>
                <tbody>
                <tr v-for="director in getYoloboxData.DirectorList">
                  <td>{{director.directorName}}</td>
                  <td>
                    <div>
                      <v-btn
                        icon="mdi-video-check"
                        size="x-small"
                        @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_director_change', data:{id:director.id,isSelected:true}}))"
                        elevation="0"
                        v-tooltip="'Switch to this Video Source'"
                      />
                    </div>
                  </td>
                </tr>
                </tbody>
              </v-table>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel>
            <v-expansion-panel-title>
              Overlay Sources
            </v-expansion-panel-title>
            <v-expansion-panel-text class="pa-0">
              <v-alert text="The order of activation is important!" type="warning" variant="outlined" class="mb-2"></v-alert>
              <v-row>
                <v-col cols="4" v-for="material in getYoloboxData.MaterialList">
                  <div class="position-relative">
                    <v-img
                      class="rounded"
                      cover
                      :src="getYoloboxData.http+material.url"
                      :lazy-src="loading"
                    ></v-img>
                    <div class="position-absolute pa-1 yolobox-image-actions">
                      <v-btn
                        icon="mdi-power-on"
                        size="x-small"
                        @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_material_change', data:{id:material.id,isSelected:true}}))"
                        elevation="0"
                        v-tooltip="'Enable this Overlay Source'"
                      />
                      <v-btn
                        class="ml-1"
                        icon="mdi-power-off"
                        size="x-small"
                        @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_material_change', data:{id:material.id,isSelected:false}}))"
                        elevation="0"
                        v-tooltip="'Disable this Overlay Source'"
                      />
                    </div>
                  </div>
                </v-col>
                <v-col cols="12">
                  <v-btn
                    class="ml-1 mb-2"
                    size="small"
                    @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_material_change', data:{id:'all',isSelected:false}}))"
                    elevation="0"
                    v-tooltip="'Disable all Overlay Sources'"
                  >Disable all Overlay Sources<v-icon class="ml-2" icon="mdi-content-copy"/> </v-btn>
                </v-col>
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel>
            <v-expansion-panel-title>
              Audio Sources
            </v-expansion-panel-title>
            <v-expansion-panel-text class="pa-0">
              <v-alert text="Volume Range is from 0 to 1, 0.5 is for example 50%" type="warning" variant="outlined" class="mb-2"></v-alert>
              <v-table>
                <thead>
                <tr>
                  <th>Name</th>
                  <th style="width: 130px">Actions</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="mixer in getYoloboxData.MixerList">
                  <td>{{mixer.id}}</td>
                  <td>
                    <div>
                      <v-btn
                        icon="mdi-volume-variant-off"
                        size="x-small"
                        @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_mixer_change', data:{id:mixer.id,isSelected:false}}))"
                        elevation="0"
                        v-tooltip="'Mute this Audio Source'"
                      />
                      <v-btn
                        icon="mdi-volume-source"
                        size="x-small"
                        @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_mixer_change', data:{id:mixer.id,isSelected:true}}))"
                        elevation="0"
                        v-tooltip="'Unmute this Audio Source'"
                      />
                      <v-btn
                        icon="mdi-content-copy"
                        size="x-small"
                        @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_mixer_change', data:{id:mixer.id,volume:mixer.volume}}))"
                        elevation="0"
                        v-tooltip="'Copy the current Volume of this Audio Source'"
                      />
                    </div>
                  </td>
                </tr>
                </tbody>
              </v-table>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel>
            <v-expansion-panel-title>
              Generic
            </v-expansion-panel-title>
            <v-expansion-panel-text class="pa-0">

              <v-row
                align-content="center"
                justify="center"
                align="center"
                dense
                class="pa-3"
              >
                <v-col cols="12">
                  <v-btn
                    width="100%"
                    prepend-icon="mdi-play-circle-outline"
                    color="grey-darken-3"
                    variant="flat"
                    elevation="0"
                    @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_live_status', data:{status:'start'}}))"
                  >
                    Go Live
                  </v-btn>
                </v-col>
                <v-col cols="12">
                  <v-btn
                    width="100%"
                    prepend-icon="mdi-stop-circle-outline"
                    color="grey-darken-3"
                    variant="flat"
                    elevation="0"
                    @click="copyToClipboard('- ' +JSON.stringify({channel: 'yolobox', method: 'order_live_status', data:{status:'stop'}}))"
                  >
                    Stop Stream
                  </v-btn>
                </v-col>

              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>
  </template>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app.ts";
import noObs from "@/assets/no_obs.png"

export default {
  data() {
    return {
      noObs
    }
  },
  computed: {
    ...mapState(useAppStore, ['getYoloboxData', 'getParsedBackendConfig']),
  },
  methods: {
    copyToClipboard(text: string) {
      navigator.clipboard.writeText(text)
    }
  },
  mounted() {
    if(this.getYoloboxData?.MaterialList) {
      for(const material of this.getYoloboxData?.MaterialList) {
        if(material.previewUrl) continue;
        material.previewUrl = `${material.url}&resolution=411x231&time=${Date.now()}`
      }
    }
  }
}
</script>

<style scoped lang="scss">
.yolobox-image-actions {
  bottom: 0;
  left: 0;
  width: 100%;
}
</style>
