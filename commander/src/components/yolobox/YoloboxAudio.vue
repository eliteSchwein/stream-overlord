<template>
  <v-card color="grey-darken-4" elevation="0" rounded="0">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>{{ $t('yolobox.audioMixer.title') }}</span>
    </v-card-title>

    <v-card-text>
      <v-list density="compact" bg-color="transparent" class="audio-list">
        <v-list-item
          v-for="device in getYoloboxData.MixerList"
          :key="device.id"
          class="audio-list-item"
        >
          <template #prepend>
            <v-btn
              density="compact"
              elevation="0"
              variant="text"
              :color="device.isSelected ? undefined : 'red'"
              :icon="device.isSelected ? 'mdi-volume-source' : 'mdi-volume-variant-off'"
              @click="setYoloboxVolume(device.id, device.volume, !device.isSelected, device.delayTime, device.AFV ?? device.afv)"
            />
          </template>

          <div class="audio-row-content">
            <div class="audio-row-header">
              <div class="font-weight-medium text-truncate">{{ device.id }}</div>
              <div class="text-caption text-medium-emphasis">{{ Math.round(device.volume * 100) }}%</div>
            </div>

            <div class="audio-volume-control-row">
              <v-btn
                density="compact"
                elevation="0"
                variant="text"
                icon="mdi-minus"
                @click="stepYoloboxVolume(device, -1)"
              />

              <v-slider
                class="audio-slider"
                hide-details
                :max="1"
                :min="0"
                :step="getVolumeStep(device)"
                v-model="device.volume"
                density="compact"
                @update:modelValue="setYoloboxVolume(device.id, device.volume, device.isSelected, device.delayTime, device.AFV ?? device.afv)"
              />

              <v-btn
                density="compact"
                elevation="0"
                variant="text"
                icon="mdi-plus"
                @click="stepYoloboxVolume(device, 1)"
              />
            </div>

            <div v-if="device.delayTime !== undefined" class="audio-delay-row">
              <v-btn
                density="compact"
                elevation="0"
                variant="text"
                :icon="(device.AFV ?? device.afv) ? 'mdi-priority-high' : 'mdi-priority-low'"
                @click="setYoloboxVolume(device.id, device.volume, device.isSelected, device.delayTime, !(device.AFV ?? device.afv))"
              />

              <div class="audio-delay-slider">
                <div class="text-caption text-medium-emphasis">{{ $t('yolobox.audioMixer.delay', { delay: device.delayTime }) }}</div>
                <v-slider
                  hide-details
                  :max="device.maxDelay"
                  :min="0"
                  :step="1"
                  v-model="device.delayTime"
                  density="compact"
                  @update:modelValue="setYoloboxVolume(device.id, device.volume, device.isSelected, device.delayTime, device.AFV ?? device.afv)"
                />
              </div>
            </div>
          </div>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'

export default {
  computed: {
    ...mapState(useAppStore, ['getYoloboxData', 'getParsedBackendConfig']),
  },

  methods: {
    getVolumeStep(device: any): number {
      const step = Number(device.steps_range ?? device.step_range ?? 0.05)

      return Number.isFinite(step) && step > 0 ? step : 0.05
    },

    stepYoloboxVolume(device: any, direction: number) {
      const nextVolume = Math.max(0, Math.min(1, Number(device.volume ?? 0) + (this.getVolumeStep(device) * direction)))

      device.volume = nextVolume
      this.setYoloboxVolume(device.id, nextVolume, device.isSelected, device.delayTime, device.AFV ?? device.afv)
    },

    setYoloboxVolume(audioInterface: string, volume: number, isSelected: boolean, delay: number = 0, afv: boolean = false) {
      eventBus.$emit('websocket:send', {
        method: 'execute_yolobox',
        params: {
          data: {
            id: audioInterface,
            isSelected,
            volume,
            AFV: afv,
            delayTime: delay,
          },
          orderID: 'order_mixer_change',
        },
      })
    },
  },
}
</script>

<style scoped>
.audio-list {
  max-height: calc(100vh - 240px);
  overflow-y: auto;
}

.audio-list-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-top: 8px;
  padding-bottom: 8px;
}

.audio-row-content {
  width: 100%;
}

.audio-row-header,
.audio-delay-row,
.audio-volume-control-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.audio-row-header {
  justify-content: space-between;
}

.audio-delay-slider,
.audio-slider {
  flex: 1;
}
</style>
