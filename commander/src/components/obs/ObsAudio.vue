<template>
  <v-card v-if="Object.keys(getObsAudioData).length > 0" color="grey-darken-4" elevation="0" rounded="0">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>OBS Audio Mixer</span>
    </v-card-title>

    <v-card-text>
      <v-list density="compact" bg-color="transparent" class="audio-list">
        <v-list-item
          v-for="device in getObsAudioData"
          :key="device.inputUuid"
          class="audio-list-item"
        >
          <template #prepend>
            <v-btn
              density="compact"
              elevation="0"
              variant="text"
              :color="device.muted ? 'red' : undefined"
              :icon="device.muted ? 'mdi-volume-variant-off' : 'mdi-volume-source'"
              @click="toggleInputMute(device.inputUuid)"
            />
          </template>

          <div class="audio-row-content">
            <div class="audio-row-header">
              <div class="font-weight-medium text-truncate">{{ device.inputName }}</div>
              <div class="text-caption text-medium-emphasis">{{ Math.round(device.volume.inputVolumeMul * 100) }}%</div>
            </div>

            <div class="audio-volume-control-row">
              <v-btn
                density="compact"
                elevation="0"
                variant="text"
                icon="mdi-minus"
                @click="stepInputVolume(device, -1)"
              />

              <v-slider
                class="audio-slider"
                hide-details
                :max="0"
                :min="-100"
                :step="getVolumeStep(device)"
                v-model="device.volume.inputVolumeDb"
                density="compact"
                @update:modelValue="setInputVolume(device.inputUuid, device.volume.inputVolumeDb)"
              />

              <v-btn
                density="compact"
                elevation="0"
                variant="text"
                icon="mdi-plus"
                @click="stepInputVolume(device, 1)"
              />
            </div>

            <div class="audio-balance-row">
              <div class="text-caption text-medium-emphasis audio-balance-label">Balance</div>
              <v-slider
                hide-details
                :max="1"
                :min="0"
                :step="0.01"
                v-model="device.balance"
                density="compact"
                @update:modelValue="setAudioBalance(device.inputUuid, device.balance)"
              />
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
    ...mapState(useAppStore, ['getParsedBackendConfig', 'getObsAudioData']),
  },

  methods: {
    getVolumeStep(device: any): number {
      const step = Number(device.steps_range ?? device.step_range ?? 0.05)

      return Number.isFinite(step) && step > 0 ? step : 0.05
    },

    stepInputVolume(device: any, direction: number) {
      const current = Number(device.volume?.inputVolumeDb ?? -100)
      const nextVolume = Math.max(-100, Math.min(0, current + (this.getVolumeStep(device) * direction)))

      device.volume.inputVolumeDb = nextVolume
      this.setInputVolume(device.inputUuid, nextVolume)
    },

    setInputVolume(inputUuid: string, volume: number) {
      eventBus.$emit('websocket:send', {
        method: 'obs_trigger_command',
        params: {
          method: 'SetInputVolume',
          data: { inputUuid, inputVolumeDb: volume },
        },
      })
    },

    toggleInputMute(inputUuid: string) {
      eventBus.$emit('websocket:send', {
        method: 'obs_trigger_command',
        params: {
          method: 'ToggleInputMute',
          data: { inputUuid },
        },
      })
    },

    setAudioBalance(inputUuid: string, balance: number) {
      eventBus.$emit('websocket:send', {
        method: 'obs_trigger_command',
        params: {
          method: 'SetInputAudioBalance',
          data: { inputUuid, inputAudioBalance: balance },
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
.audio-balance-row,
.audio-volume-control-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.audio-row-header {
  justify-content: space-between;
}

.audio-slider {
  flex: 1;
}

.audio-balance-label {
  min-width: 56px;
}
</style>
