<template>
  <v-card
    class="overflow-auto mx-auto px-5 py-5"
    max-height="100%"
    min-height="100%"
    elevation="0"
    color="transparent"
    max-width="100%"
  >
    <v-row>
      <v-col>
        <v-card>
          <v-card-title>Bot Audio Mixer</v-card-title>
          <v-card-item>
            <v-row v-for="(device, key) in getAudioData" :key="key">
              <v-col>
                <v-card
                  color="grey-darken-3"
                >
                  <v-card-title></v-card-title>
                  <v-card-subtitle class="px-2 pt-2">
                    {{ key }}
                  </v-card-subtitle>
                  <v-card-item>
                    <v-row align="center">
                      <v-col cols="auto">
                        <v-btn
                          density="compact"
                          elevation="0"
                          color="transparent"
                          icon="mdi-volume-variant-off"
                          v-if="device.muted"
                          @click="unmute(key, device)"
                          style="color: #EF5350!important;"
                        >
                        </v-btn>
                        <v-btn
                          density="compact"
                          elevation="0"
                          color="transparent"
                          icon="mdi-volume-source"
                          @click="setVolume(key, 0)"
                          v-else>
                        </v-btn>
                      </v-col>
                      <v-col>
                        <v-slider
                          hide-details
                          :max="device.max_range"
                          :min="device.min_range"
                          :step="device.steps_range"
                          :disabled="device.muted"
                          v-model="device.current_volume"
                          density="compact"
                          @update:modelValue="setVolume(key, device.current_volume)"
                        ></v-slider>
                      </v-col>
                    </v-row>
                  </v-card-item>
                </v-card>
              </v-col>
            </v-row>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <template v-if="getParsedBackendConfig.yolobox?.enable && getYoloboxData.MixerList">
      <v-row>
        <v-col>
          <v-card>
            <v-card-title>Yolobox Audio Mixer</v-card-title>
            <v-card-item>
              <v-row v-for="(device) in getYoloboxData.MixerList" :key="key">
                <v-col>
                  <v-card
                    color="grey-darken-3"
                  >
                    <v-card-title></v-card-title>
                    <v-card-subtitle class="px-2 pt-2">
                      {{ device.id }}
                    </v-card-subtitle>
                    <v-card-item>
                      <v-row align="center">
                        <v-col cols="auto">
                          <v-btn
                            density="compact"
                            elevation="0"
                            color="transparent"
                            icon="mdi-volume-variant-off"
                            v-if="!device.isSelected"
                            @click="setYoloboxVolume(device.id, device.volume, !device.isSelected)"
                            style="color: #EF5350!important;"
                          >
                          </v-btn>
                          <v-btn
                            density="compact"
                            elevation="0"
                            color="transparent"
                            icon="mdi-volume-source"
                            @click="setYoloboxVolume(device.id, device.volume, !device.isSelected)"
                            v-else>
                          </v-btn>
                        </v-col>
                        <v-col>
                          <v-slider
                            hide-details
                            :max="1"
                            :min="0"
                            :step="0.05"
                            v-model="device.volume"
                            density="compact"
                            @update:modelValue="setYoloboxVolume(device.id, device.volume, device.isSelected)"
                          ></v-slider>
                        </v-col>
                      </v-row>
                    </v-card-item>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-item>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-card>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus";
export default {
  computed: {
    ...mapState(useAppStore, ['getAudioData', 'getYoloboxData', 'getParsedBackendConfig']),
  },
  methods: {
    setVolume(audioInterface: string, volume: number) {
      eventBus.$emit('websocket:send', {
        method: 'set_volume',
        params: {'interface': audioInterface, 'volume': volume},
      })
    },
    setYoloboxVolume(audioInterface: string, volume: number, isSelected: boolean) {
      eventBus.$emit('websocket:send', {
        method: 'execute_yolobox',
        params: {"data": {"id": audioInterface, "isSelected": isSelected, "volume": volume, "AFV": null}, "orderID": "order_mixer_change"},
      })
    },
    unmute(audioInterface: string, audioData: any) {
      this.setVolume(audioInterface, audioData.current_volume);
    }
  }
}
</script>
