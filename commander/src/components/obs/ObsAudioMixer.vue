<template>
  <v-card color="grey-darken-4 pt-2" elevation="0" rounded="0">
    <v-card-title class="d-flex align-center justify-space-between ga-3">
      <span>{{ $t('obs.audioMixer.title') }}</span>
      <v-chip size="small" variant="tonal">
        {{ filteredAudioList.length }} / {{ audioList.length }}
      </v-chip>
      <v-spacer></v-spacer>
      <v-text-field
        v-if="audioList.length > 0"
        v-model="search"
        class="mb-3"
        density="compact"
        hide-details
        clearable
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        :label="$t('obs.audioMixer.search')"
      />
    </v-card-title>

    <v-card-text class="obs-audio-content">
      <v-alert
        v-if="filteredAudioList.length === 0"
        type="info"
        variant="tonal"
        density="compact"
        :text="$t('obs.audioMixer.empty')"
      />

      <div v-else class="obs-audio-table-wrap">
        <v-table density="compact" class="obs-audio-table" hover>
          <thead>
          <tr>
            <th class="text-left obs-audio-name-column">{{ $t('obs.audioMixer.name') }}</th>
            <th class="text-left obs-audio-control-column">{{ $t('obs.audioMixer.volumeControl') }}</th>
          </tr>
          </thead>

          <tbody>
          <tr v-for="device in filteredAudioList" :key="device.inputUuid">
            <td class="obs-audio-name-column">
              <div class="font-weight-medium text-truncate">{{ device.inputName }}</div>
              <div class="text-caption text-medium-emphasis text-truncate">
                {{ device.inputKind || device.inputUuid }}
              </div>
            </td>

            <td class="obs-audio-control-column">
              <div class="obs-audio-control-stack">
                <div class="obs-audio-control-row">
                  <v-btn
                    density="compact"
                    elevation="0"
                    variant="text"
                    :color="device.muted ? 'red' : undefined"
                    :icon="device.muted ? 'mdi-volume-variant-off' : 'mdi-volume-source'"
                    @click="toggleInputMute(device.inputUuid)"
                  />

                  <v-btn
                    density="compact"
                    elevation="0"
                    variant="text"
                    icon="mdi-minus"
                    :disabled="device.muted"
                    @click="stepInputVolume(device, -1)"
                  />

                  <v-slider
                    class="obs-audio-slider"
                    hide-details
                    :max="0"
                    :min="-100"
                    :step="getVolumeStep(device)"
                    :disabled="device.muted"
                    :model-value="getVolumeValue(device)"
                    density="compact"
                    @update:modelValue="queueInputVolume(device.inputUuid, Number($event))"
                    @end="flushInputVolume(device.inputUuid)"
                  />

                  <v-btn
                    density="compact"
                    elevation="0"
                    variant="text"
                    icon="mdi-plus"
                    :disabled="device.muted"
                    @click="stepInputVolume(device, 1)"
                  />

                  <div class="text-caption text-medium-emphasis obs-audio-percent">
                    {{ getVolumePercent(device) }}%
                  </div>
                </div>

                <div class="obs-audio-balance-row">
                  <div class="text-caption text-medium-emphasis obs-audio-balance-label">
                    {{ $t('obs.audioMixer.balance') }}
                  </div>
                  <v-slider
                    class="obs-audio-slider"
                    hide-details
                    :max="1"
                    :min="0"
                    :step="0.01"
                    :model-value="getBalanceValue(device)"
                    density="compact"
                    @update:modelValue="queueAudioBalance(device.inputUuid, Number($event))"
                    @end="flushAudioBalance(device.inputUuid)"
                  />
                  <div class="text-caption text-medium-emphasis obs-audio-percent">
                    {{ Math.round(getBalanceValue(device) * 100) }}%
                  </div>
                </div>
              </div>
            </td>
          </tr>
          </tbody>
        </v-table>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import eventBus from '@/eventBus'

export default {
  props: {
    connection: {
      type: String,
      default: 'default',
    },
    audioData: {
      type: Object,
      default: () => ({}),
    },
  },

  data() {
    return {
      volumeDebounceTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
      volumeDrafts: {} as Record<string, number>,
      balanceDebounceTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
      balanceDrafts: {} as Record<string, number>,
      search: '',
    }
  },

  computed: {
    audioList(): any[] {
      return Object.values(this.audioData ?? {})
        .filter((device: any) => device?.inputUuid)
        .sort((a: any, b: any) => String(a.inputName ?? '').localeCompare(String(b.inputName ?? '')))
    },

    filteredAudioList(): any[] {
      const query = String(this.search ?? '').trim().toLowerCase()

      if(!query) {
        return this.audioList
      }

      return this.audioList.filter((device: any) => {
        return [device.inputName, device.inputKind, device.inputUuid]
          .some(value => String(value ?? '').toLowerCase().includes(query))
      })
    },
  },

  methods: {
    getVolumeStep(device: any): number {
      const step = Number(device.steps_range ?? device.step_range ?? 1)
      return Number.isFinite(step) && step > 0 ? step : 1
    },

    getVolumeValue(device: any): number {
      const inputUuid = String(device.inputUuid)

      if(this.volumeDrafts[inputUuid] !== undefined) {
        return this.volumeDrafts[inputUuid]
      }

      return Number(device.volume?.inputVolumeDb ?? -100)
    },

    getVolumePercent(device: any): number {
      const mul = Number(device.volume?.inputVolumeMul)

      if(Number.isFinite(mul)) {
        return Math.round(mul * 100)
      }

      const db = this.getVolumeValue(device)
      return Math.round(Math.pow(10, db / 20) * 100)
    },

    getBalanceValue(device: any): number {
      const inputUuid = String(device.inputUuid)

      if(this.balanceDrafts[inputUuid] !== undefined) {
        return this.balanceDrafts[inputUuid]
      }

      const balance = Number(device.balance ?? 0.5)
      return Number.isFinite(balance) ? Math.max(0, Math.min(1, balance)) : 0.5
    },

    stepInputVolume(device: any, direction: number) {
      const inputUuid = String(device.inputUuid)
      const current = this.getVolumeValue(device)
      const next = Math.max(-100, Math.min(0, current + (this.getVolumeStep(device) * direction)))

      this.volumeDrafts[inputUuid] = next
      this.flushInputVolume(inputUuid)
    },

    queueInputVolume(inputUuid: string, volume: number) {
      this.volumeDrafts[inputUuid] = Math.max(-100, Math.min(0, volume))

      if(this.volumeDebounceTimers[inputUuid]) {
        clearTimeout(this.volumeDebounceTimers[inputUuid])
      }

      this.volumeDebounceTimers[inputUuid] = setTimeout(() => {
        this.flushInputVolume(inputUuid)
      }, 200)
    },

    flushInputVolume(inputUuid: string) {
      const volume = this.volumeDrafts[inputUuid]
      if(volume === undefined) return

      if(this.volumeDebounceTimers[inputUuid]) {
        clearTimeout(this.volumeDebounceTimers[inputUuid])
        delete this.volumeDebounceTimers[inputUuid]
      }

      delete this.volumeDrafts[inputUuid]
      this.setInputVolume(inputUuid, volume)
    },

    queueAudioBalance(inputUuid: string, balance: number) {
      this.balanceDrafts[inputUuid] = Math.max(0, Math.min(1, balance))

      if(this.balanceDebounceTimers[inputUuid]) {
        clearTimeout(this.balanceDebounceTimers[inputUuid])
      }

      this.balanceDebounceTimers[inputUuid] = setTimeout(() => {
        this.flushAudioBalance(inputUuid)
      }, 200)
    },

    flushAudioBalance(inputUuid: string) {
      const balance = this.balanceDrafts[inputUuid]
      if(balance === undefined) return

      if(this.balanceDebounceTimers[inputUuid]) {
        clearTimeout(this.balanceDebounceTimers[inputUuid])
        delete this.balanceDebounceTimers[inputUuid]
      }

      delete this.balanceDrafts[inputUuid]
      this.setAudioBalance(inputUuid, balance)
    },

    sendObsCommand(method: string, data: any) {
      eventBus.$emit('websocket:send', {
        method: 'obs_trigger_command',
        params: {
          connection: this.connection,
          obs_id: this.connection,
          method,
          data,
        },
      })
    },

    setInputVolume(inputUuid: string, volume: number) {
      this.sendObsCommand('SetInputVolume', { inputUuid, inputVolumeDb: volume })
    },

    toggleInputMute(inputUuid: string) {
      this.sendObsCommand('ToggleInputMute', { inputUuid })
    },

    setAudioBalance(inputUuid: string, balance: number) {
      this.sendObsCommand('SetInputAudioBalance', { inputUuid, inputAudioBalance: balance })
    },
  },
}
</script>

<style scoped>
.obs-audio-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.obs-audio-table {
  min-width: 720px;
  background: transparent;
}

.obs-audio-table :deep(table) {
  background: transparent;
}

.obs-audio-table :deep(th) {
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.obs-audio-name-column {
  min-width: 260px;
  width: 320px;
}

.obs-audio-control-column {
  min-width: 420px;
}

.obs-audio-control-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
}

.obs-audio-control-row,
.obs-audio-balance-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.obs-audio-balance-row {
  padding-left: 96px;
}

.obs-audio-balance-label {
  min-width: 56px;
}

.obs-audio-slider {
  flex: 1;
}

.obs-audio-percent {
  min-width: 44px;
  text-align: right;
}

.obs-audio-content {
  max-height: calc(100vh - 130px);
  overflow-y: auto;
}
</style>
