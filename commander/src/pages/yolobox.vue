<template>
  <v-sheet height="100%">

    <v-toolbar
      density="compact"
      color="grey-darken-4"
    >
      <v-tabs
        v-model="tab"
        color="primary"
        @update:model-value="setTab"
      >
        <v-tab value="source">Source</v-tab>
        <v-tab value="overlay">Overlay</v-tab>
        <v-tab value="audio">Audio</v-tab>
      </v-tabs>
      <template v-slot:append>
        <v-switch
          label="Auto Refresh"
          class="mt-6 mr-5"
          density="compact"
          :model-value="autoRefresh"
          @click="toggleAutoRefresh()"
        ></v-switch>
      </template>
    </v-toolbar>

    <v-divider></v-divider>

    <v-tabs-window v-model="tab" class="h-100">
      <v-tabs-window-item value="source" class="h-100">
        <v-sheet class="pa-5 h-100" color="black">
          <v-row>
            <template v-for="(source) in getYoloboxData.DirectorList">
              <v-col cols="12" sm="6" md="4" xl="3" xxl="2">
                <v-card class="cursor-pointer" @click="toggleSource(source.id)">
                  <div class="position-relative rounded pa-0">
                    <YoloboxPreview
                      :class="{'rounded': true, 'yolo-overlay-active-border': source.isSelected, 'yolo-overlay-inactive-border': !source.isSelected}"
                      cover
                      :src="source.previewUrl"
                      :lazy-src="loading"
                    ></YoloboxPreview>
                    <div class="position-absolute bg-red-darken-1 pr-2 yolo-overlay-active" v-if="source.isSelected">
                      <v-icon icon="mdi-check" size="sm"></v-icon>
                    </div>
                  </div>
                  <v-card-text align="center">
                    {{source.directorName}}
                  </v-card-text>
                </v-card>
              </v-col>
            </template>
          </v-row>
        </v-sheet>
      </v-tabs-window-item>
      <v-tabs-window-item value="overlay" class="h-100">
        <v-sheet class="pa-5 h-100" color="black">
          <v-row>
            <template v-for="(material) in getYoloboxData.MaterialList">
              <v-col cols="12" sm="6" md="4" xl="3" xxl="2">
                <v-card class="cursor-pointer" @click="toggleOverlay(material.id)">
                  <div class="position-relative">
                    <YoloboxPreview
                      class="rounded"
                      cover
                      :src="material.previewUrl"
                      :lazy-src="loading"
                    ></YoloboxPreview>
                    <div class="position-absolute bg-red-darken-1 pr-2 yolo-overlay-active" v-if="material.isSelected">
                      <v-icon icon="mdi-check" size="sm"></v-icon>
                    </div>
                  </div>
                </v-card>
              </v-col>
            </template>
          </v-row>
        </v-sheet>
      </v-tabs-window-item>
      <v-tabs-window-item value="audio" class="h-100">
        <v-sheet class="pa-5 h-100" color="black">
          <YoloboxAudio/>
        </v-sheet>
      </v-tabs-window-item>
    </v-tabs-window>
  </v-sheet>
</template>

<script lang="ts">
import {useAppStore} from "@/stores/app.ts";
import {mapState} from "pinia";
import eventBus from "@/eventBus";
import loading from "@/assets/loading.webp"

export default {
  computed: {
    ...mapState(useAppStore, ['getYoloboxData'])
  },
  data() {
    return {
      autoRefreshInterval: null as any,
      loading,
      autoRefresh: false as boolean,
      tab: 'source' as string,
      tabMap: {'audio': 4, 'overlay': 1, 'source': 2} as any,
    }
  },
  methods: {
    setTab(value: string) {
      const tabId = this.tabMap[value]

      if(!tabId) return

      eventBus.$emit('websocket:send', {
        method: 'execute_yolobox',
        params: {"data": {"id": tabId}, "orderID": "order_tab_change"},
      })
    },
    toggleOverlay(id: string) {
      console.log(id)
      eventBus.$emit('websocket:send', {
        method: 'execute_yolobox',
        params: {"data": {"id": id, "isSelected": false}, "orderID": "order_material_change"},
      })
    },
    toggleSource(id: string) {
      console.log(id)
      eventBus.$emit('websocket:send', {
        method: 'execute_yolobox',
        params: {"data": {"id": id, "isSelected": true}, "orderID": "order_director_change"},
      })
    },
    toggleAutoRefresh() {
      this.autoRefresh = !this.autoRefresh
    }
  },
  mounted() {
    this.setTab(this.tab)
    this.autoRefreshInterval = setInterval(() => {
      if(!this.getYoloboxData.DirectorList) return
      if(!this.autoRefresh) {
        for(const source of this.getYoloboxData.DirectorList) {
          if(source.previewUrl === source.url) continue;
          source.previewUrl = `${source.url}`
        }
        for(const material of this.getYoloboxData.MaterialList) {
          if(material.previewUrl) continue;
          material.previewUrl = `${material.url}`
        }
        return
      }
      for(const source of this.getYoloboxData.DirectorList) {
        source.previewUrl = `${source.url}&resolution=411x231&time=${Date.now()}`
      }
      for(const material of this.getYoloboxData.MaterialList) {
        material.previewUrl = `${material.url}&resolution=411x231&time=${Date.now()}`
      }
    },1_000)
  },
  unmounted() {
    clearInterval(this.autoRefreshInterval)
  }
}
</script>

<style scoped lang="scss">
.yolo-overlay-active {
  top: 0;
  right: 0;
  width: 48px;
  height: 48px;
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  text-align: end;
}
.yolo-overlay-active-border {
  border: 3px solid #E53935;
}
.yolo-overlay-inactive-border {
  border: 3px solid rgb(var(--v-theme-surface));
}
</style>
