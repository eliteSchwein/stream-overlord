<template>
  <v-row class="audio-page-layout" dense no-gutters>
    <v-col cols="12" :lg="yoloboxAudioEnabled ? 8 : 12" class="bot-audio-panel">
      <v-card color="grey-darken-4" elevation="0">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Bot Audio Mixer</span>
        </v-card-title>

        <v-card-text>
          <div class="audio-table-wrap">
            <v-table density="compact" class="audio-table" hover>
              <thead>
              <tr>
                <th class="text-left audio-name-column">Name</th>
                <th class="text-left audio-volume-column">Volume Control</th>
                <th
                  v-for="output in audioOutputList"
                  :key="outputKey(output)"
                  class="text-center audio-output-column"
                >
                  <div
                    class="audio-output-header"
                    :class="{ 'audio-output-header-active': isDefaultOutputActive(output) }"
                    :title="outputTitle(output)"
                  >
                    <v-icon
                      v-if="isDefaultOutput(output)"
                      icon="mdi-star-circle"
                      size="small"
                      class="mr-1"
                    />
                    <span class="text-truncate">{{ outputNumberLabel(output) }}</span>
                  </div>
                </th>
              </tr>
              </thead>

              <tbody>
              <tr v-for="(device, key) in getAudioData" :key="key">
                <td class="audio-name-column">
                  <div class="font-weight-medium">{{ key }}</div>
                  <div v-if="isPipewireSink(device)" class="text-caption text-medium-emphasis">
                    Sink: {{ device.sink_name || `streambot_${key}` }}
                  </div>
                </td>

                <td class="audio-volume-column">
                  <div class="audio-control-row">
                    <v-btn
                      v-if="device.muted"
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-volume-variant-off"
                      color="red"
                      @click="unmute(String(key), device)"
                    />
                    <v-btn
                      v-else
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-volume-source"
                      @click="setVolume(String(key), 0)"
                    />

                    <v-btn
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-minus"
                      :disabled="device.muted"
                      @click="stepVolume(String(key), device, -1)"
                    />

                    <v-slider
                      class="audio-slider"
                      hide-details
                      :max="Number(device.max_range ?? 1)"
                      :min="Number(device.min_range ?? 0)"
                      :step="Number(device.steps_range ?? 0.01)"
                      :disabled="device.muted"
                      :model-value="getVolumeValue(String(key), device)"
                      density="compact"
                      @update:modelValue="queueVolume(String(key), Number($event))"
                      @end="flushVolume(String(key))"
                    />

                    <v-btn
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-plus"
                      :disabled="device.muted"
                      @click="stepVolume(String(key), device, 1)"
                    />
                  </div>
                </td>

                <td
                  v-for="output in audioOutputList"
                  :key="`${key}-${outputKey(output)}`"
                  class="text-center"
                >
                  <v-checkbox-btn
                    v-if="isPipewireSink(device)"
                    :model-value="isSinkLinked(device, output, String(key))"
                    density="compact"
                    class="justify-center"
                    @update:modelValue="toggleSinkLink(String(key), output, Boolean($event))"
                  />
                  <span v-else class="text-disabled">—</span>
                </td>
              </tr>

              <tr
                v-for="output in audioOutputList"
                :key="`output-volume-${outputKey(output)}`"
                class="audio-output-volume-row"
              >
                <td class="audio-name-column">
                  <div class="d-flex align-center ga-1 font-weight-medium">
                    <v-icon
                      v-if="isDefaultOutput(output)"
                      icon="mdi-star-circle"
                      size="small"
                    />
                    <span>{{ outputLabel(output) }}</span>
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ outputNumberLabel(output) }}
                  </div>
                </td>

                <td class="audio-volume-column">
                  <div class="audio-control-row">
                    <v-btn
                      v-if="isOutputMuted(output)"
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-volume-variant-off"
                      color="red"
                      @click="setOutputVolume(output, getOutputFallbackVolume(output))"
                    />
                    <v-btn
                      v-else
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-volume-source"
                      @click="setOutputVolume(output, 0)"
                    />

                    <v-btn
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-minus"
                      :disabled="isOutputMuted(output)"
                      @click="stepOutputVolume(output, -1)"
                    />

                    <v-slider
                      class="audio-slider"
                      hide-details
                      :max="1"
                      :min="0"
                      :step="0.01"
                      :disabled="isOutputMuted(output)"
                      :model-value="getOutputVolumeValue(output)"
                      density="compact"
                      @update:modelValue="queueOutputVolume(output, Number($event))"
                      @end="flushOutputVolume(output)"
                    />

                    <v-btn
                      density="compact"
                      elevation="0"
                      variant="text"
                      icon="mdi-plus"
                      :disabled="isOutputMuted(output)"
                      @click="stepOutputVolume(output, 1)"
                    />
                  </div>
                </td>

                <td
                  v-if="audioOutputList.length > 0"
                  :colspan="audioOutputList.length"
                  class="audio-output-route-cell"
                >
                  <svg
                    class="audio-output-route-svg"
                    :viewBox="`0 0 ${audioOutputList.length * 100} 48`"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <line
                      class="audio-output-route-line"
                      x1="0"
                      y1="24"
                      :x2="getRouteTargetX(output)"
                      y2="24"
                    />
                    <line
                      v-for="routeIndex in getRouteColumnIndexes(output)"
                      :key="`route-${outputKey(output)}-${routeIndex}`"
                      class="audio-output-route-line"
                      :x1="getRouteColumnX(routeIndex)"
                      :x2="getRouteColumnX(routeIndex)"
                      y1="0"
                      :y2="routeIndex === getOutputIndex(output) ? 24 : 48"
                    />
                  </svg>
                </td>
              </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col v-if="yoloboxAudioEnabled" cols="12" lg="4" class="yolobox-audio-panel">
      <YoloboxAudio />
    </v-col>
  </v-row>
</template>



<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'
import YoloboxAudio from "@/components/yolobox/YoloboxAudio.vue";

type AudioOutput = Record<string, any>

export default {
  components: {
    YoloboxAudio,
  },

  data() {
    return {
      volumeDebounceTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
      volumeDrafts: {} as Record<string, number>,
      outputVolumeDebounceTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
      outputVolumeDrafts: {} as Record<string, number>,
    }
  },

  computed: {
    ...mapState(useAppStore, [
      'getAudioData',
      'getAudioOutput',
      'getAudioOutputs',
      'getParsedBackendConfig',
      'getYoloboxData',
    ]),

    audioOutputList(): AudioOutput[] {
      const payload = this.getAudioOutputs ?? this.getAudioOutput ?? {}

      const outputs = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.outputs)
          ? payload.outputs
          : Array.isArray(payload?.sinks)
            ? payload.sinks
            : Array.isArray(payload?.data)
              ? payload.data
              : Object.entries(payload ?? {}).map(([key, value]: [string, any]) => ({
                id: key,
                ...(typeof value === 'object' && value !== null ? value : { name: String(value) }),
              }))

      return outputs
        .map((output: any, index: number) => ({
          id: output.id ?? output.index ?? output.name ?? output.node_name ?? output.nodeName ?? index,
          ...output,
        }))
        .filter((output: any) => this.outputIdentifier(output) !== '')
    },

    yoloboxAudioEnabled(): boolean {
      return Boolean(this.getParsedBackendConfig?.yolobox?.enable && this.getYoloboxData?.MixerList)
    },
  },

  methods: {
    clampVolume(volume: number, audioData: any): number {
      const min = Number(audioData.min_range ?? 0)
      const max = Number(audioData.max_range ?? 1)

      return Math.max(min, Math.min(max, volume))
    },

    getVolumeStep(audioData: any): number {
      const step = Number(audioData.steps_range ?? 0.01)

      return Number.isFinite(step) && step > 0 ? step : 0.01
    },

    getVolumeValue(audioInterface: string, audioData: any): number {
      if (this.volumeDrafts[audioInterface] !== undefined) {
        return this.volumeDrafts[audioInterface]
      }

      return Number(audioData.current_volume ?? audioData.default_volume ?? 0)
    },

    stepVolume(audioInterface: string, audioData: any, direction: number) {
      const current = this.getVolumeValue(audioInterface, audioData)
      const next = this.clampVolume(current + (this.getVolumeStep(audioData) * direction), audioData)

      this.volumeDrafts[audioInterface] = next
      this.flushVolume(audioInterface)
    },

    queueVolume(audioInterface: string, volume: number) {
      this.volumeDrafts[audioInterface] = volume

      if (this.volumeDebounceTimers[audioInterface]) {
        clearTimeout(this.volumeDebounceTimers[audioInterface])
      }

      this.volumeDebounceTimers[audioInterface] = setTimeout(() => {
        this.flushVolume(audioInterface)
      }, 200)
    },

    flushVolume(audioInterface: string) {
      const volume = this.volumeDrafts[audioInterface]

      if (volume === undefined) return

      if (this.volumeDebounceTimers[audioInterface]) {
        clearTimeout(this.volumeDebounceTimers[audioInterface])
        delete this.volumeDebounceTimers[audioInterface]
      }

      delete this.volumeDrafts[audioInterface]
      this.setVolume(audioInterface, volume)
    },

    setVolume(audioInterface: string, volume: number) {
      eventBus.$emit('websocket:send', {
        method: 'set_volume',
        params: { interface: audioInterface, volume },
      })
    },

    unmute(audioInterface: string, audioData: any) {
      this.setVolume(audioInterface, Number(audioData.current_volume ?? audioData.default_volume ?? audioData.min_range ?? 0))
    },

    outputVolumeKey(output: AudioOutput): string {
      return this.outputIdentifier(output)
    },

    getOutputIndex(output: AudioOutput): number {
      const key = this.outputKey(output)

      return this.audioOutputList.findIndex((item: AudioOutput) => this.outputKey(item) === key)
    },

    getRouteColumnX(index: number): number {
      return (index * 100) + 46
    },

    getRouteTargetX(output: AudioOutput): number {
      const index = Math.max(0, this.getOutputIndex(output))

      return this.getRouteColumnX(index)
    },

    getRouteColumnIndexes(output: AudioOutput): number[] {
      const start = this.getOutputIndex(output)

      if (start < 0) return []

      return this.audioOutputList
        .map((_output: AudioOutput, index: number) => index)
        .filter((index: number) => index >= start)
    },

    isOutputMuted(output: AudioOutput): boolean {
      return output.muted === true || Number(output.volume ?? 0) === 0
    },

    getOutputFallbackVolume(output: AudioOutput): number {
      const current = Number(output.volume)

      return Number.isFinite(current) && current > 0 ? current : 0.2
    },

    getOutputVolumeValue(output: AudioOutput): number {
      const key = this.outputVolumeKey(output)

      if (this.outputVolumeDrafts[key] !== undefined) {
        return this.outputVolumeDrafts[key]
      }

      const volume = Number(output.volume ?? 0)

      return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0
    },

    stepOutputVolume(output: AudioOutput, direction: number) {
      const current = this.getOutputVolumeValue(output)
      const next = Math.max(0, Math.min(1, current + (0.01 * direction)))

      this.outputVolumeDrafts[this.outputVolumeKey(output)] = next
      this.flushOutputVolume(output)
    },

    queueOutputVolume(output: AudioOutput, volume: number) {
      const key = this.outputVolumeKey(output)

      this.outputVolumeDrafts[key] = Math.max(0, Math.min(1, volume))

      if (this.outputVolumeDebounceTimers[key]) {
        clearTimeout(this.outputVolumeDebounceTimers[key])
      }

      this.outputVolumeDebounceTimers[key] = setTimeout(() => {
        this.flushOutputVolume(output)
      }, 200)
    },

    flushOutputVolume(output: AudioOutput) {
      const key = this.outputVolumeKey(output)
      const volume = this.outputVolumeDrafts[key]

      if (volume === undefined) return

      if (this.outputVolumeDebounceTimers[key]) {
        clearTimeout(this.outputVolumeDebounceTimers[key])
        delete this.outputVolumeDebounceTimers[key]
      }

      delete this.outputVolumeDrafts[key]
      this.setOutputVolume(output, volume)
    },

    setOutputVolume(output: AudioOutput, volume: number) {
      const outputName = this.outputIdentifier(output)

      if (!outputName) return

      eventBus.$emit('websocket:send', {
        method: 'set_audio_output_volume',
        params: { output: outputName, volume },
      })
    },

    isPipewireSink(device: any): boolean {
      return device?.pipewire_sink === true || device?.pipewire_sink === 'true'
    },

    outputIdentifier(output: AudioOutput): string {
      return String(
        output.name ??
        output.node_name ??
        output.nodeName ??
        output.description ??
        output.id ??
        output.index ??
        ''
      )
    },

    outputKey(output: AudioOutput): string {
      return this.outputIdentifier(output)
    },

    outputLabel(output: AudioOutput): string {
      return String(
        output.description ??
        output.display_name ??
        output.displayName ??
        output.name ??
        output.node_name ??
        output.nodeName ??
        output.id ??
        'Unknown output'
      )
    },


    outputNumberLabel(output: AudioOutput): string {
      const index = this.getOutputIndex(output)

      return `Output ${index >= 0 ? index + 1 : ''}`.trim()
    },

    outputTitle(output: AudioOutput): string {
      const parts = [this.outputLabel(output)]

      if (this.isDefaultOutput(output)) parts.push('Default sink')
      if (this.isDefaultOutputActive(output)) parts.push('Active')

      return parts.join(' · ')
    },

    isDefaultOutput(output: AudioOutput): boolean {
      return output.is_default === true || output.default === true || output.isDefault === true
    },

    isDefaultOutputActive(output: AudioOutput): boolean {
      const state = String(output.state ?? '').toUpperCase()
      return this.isDefaultOutput(output) && (output.active === true || state === 'RUNNING')
    },

    isSinkLinked(device: any, output: AudioOutput, audioInterface?: string): boolean {
      const outputName = this.outputIdentifier(output)

      if (!outputName) return false

      const interfaceName = audioInterface ? String(audioInterface) : ''
      const linkedOutput = device.linked_output ?? device.actual_linked_output ?? device.audio_output ?? device.output ?? null
      const linkedOutputs = device.linked_outputs ?? device.actual_linked_outputs ?? device.audio_outputs ?? []
      const outputLinkedInterfaces = output.linked_interfaces ?? output.active_interfaces ?? output.interfaces ?? []

      if (String(linkedOutput) === outputName) return true

      if (Array.isArray(linkedOutputs) && linkedOutputs.map(String).includes(outputName)) {
        return true
      }

      if (interfaceName && Array.isArray(outputLinkedInterfaces) && outputLinkedInterfaces.map(String).includes(interfaceName)) {
        return true
      }

      return false
    },

    toggleSinkLink(audioInterface: string, output: AudioOutput, linked: boolean) {
      const outputName = this.outputIdentifier(output)

      if (!outputName) return

      eventBus.$emit('websocket:send', {
        method: 'link_sink',
        params: {
          interface: audioInterface,
          output: outputName,
          linked,
        },
      })
    },
  },
}
</script>

<style scoped>

.audio-page-layout {
  width: 100%;
}

.bot-audio-panel,
.yolobox-audio-panel {
  min-width: 0;
  padding-left: 2px;
}

.yolobox-audio-panel :deep(.v-row) {
  margin: 0;
}

.yolobox-audio-panel :deep(.v-col) {
  padding: 0;
}

.yolobox-audio-panel :deep(.v-card) {
  width: 100%;
  height: 100%;
}

.audio-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.audio-table {
  min-width: 900px;
  background: transparent;
}

.audio-table :deep(table) {
  background: transparent;
}

.audio-table :deep(th) {
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.audio-name-column {
  min-width: 240px;
  width: 280px;
}

.audio-volume-column {
  min-width: 320px;
  width: 420px;
}

.audio-output-column {
  min-width: 96px;
  width: 112px;
  max-width: 128px;
}

.audio-control-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.audio-slider {
  flex: 1;
}

.audio-output-header {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  border-radius: 999px;
  padding: 2px 10px;
}

.audio-output-header-active {
  outline: 1px solid currentColor;
  font-weight: 700;
}
.audio-output-route-cell {
  position: relative;
  height: 48px;
  padding: 0 !important;
  overflow: visible;
}

.audio-output-route-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 48px;
  overflow: visible;
  pointer-events: none;
}

.audio-output-route-line {
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 3;
  stroke-linecap: square;
  vector-effect: non-scaling-stroke;
}

.audio-output-volume-row :deep(td) {
  overflow: visible;
}

</style>
