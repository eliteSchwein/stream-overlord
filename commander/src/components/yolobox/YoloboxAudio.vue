<template>
  <template v-if="getParsedBackendConfig.yolobox?.enable && getYoloboxData.MixerList">
    <v-row>
      <v-col>
        <v-card>
          <v-card-title>Yolobox Audio Mixer</v-card-title>
          <v-card-item>
            <v-row v-for="(device) in getYoloboxData.MixerList">
              <v-col>
                <v-card
                  :color="device.isSelected? 'black' : 'red-darken-4'"
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
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus";

export default {
  computed: {
    ...mapState(useAppStore, ['getYoloboxData', 'getParsedBackendConfig']),
  },
  methods: {
    setYoloboxVolume(audioInterface: string, volume: number, isSelected: boolean) {
      eventBus.$emit('websocket:send', {
        method: 'execute_yolobox',
        params: {"data": {"id": audioInterface, "isSelected": isSelected, "volume": volume, "AFV": null}, "orderID": "order_mixer_change"},
      })
    }
  }
}
</script>
