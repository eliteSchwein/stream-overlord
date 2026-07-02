<template>
  <v-card class="macro-wled-control-editor" color="grey-darken-3" variant="flat">
    <v-card-text>
      <v-row density="comfortable">
        <v-col cols="12" md="6">
          <MacroWledSelect
            v-model="control.name"
            :disabled="disabled"
            :label="wledLabel"
            @created="handleWledCreated"
            @update:model-value="onWledChanged"
          />

          <v-autocomplete
            class="mt-3"
            :model-value="control.preset"
            :items="wledPresetOptions(control.name)"
            item-title="title"
            item-value="value"
            :label="presetLabel"
            variant="outlined"
            density="compact"
            :disabled="disabled"
            hide-details="auto"
            clearable
            @focus="loadWledPresets(control.name, 'preset focus')"
            @update:model-value="setWledPreset($event)"
          />

          <v-autocomplete
            class="mt-3"
            :model-value="control.effect"
            :items="wledEffectOptions(control.name)"
            item-title="title"
            item-value="value"
            :label="effectLabel"
            variant="outlined"
            density="compact"
            :disabled="disabled || hasPreset"
            hide-details="auto"
            clearable
            @focus="loadWledEffects(control.name, 'effect focus')"
            @update:model-value="setWledEffect($event)"
          />

          <v-slider
            v-model="control.brightness"
            class="mt-3"
            :label="brightnessLabel"
            :disabled="disabled || hasPreset"
            :min="0"
            :max="255"
            :step="1"
            thumb-label
            hide-details
          />

          <v-alert
            v-if="hasPreset"
            class="mt-3"
            type="info"
            variant="tonal"
            density="compact"
          >
            {{ presetInfoLabel }}
          </v-alert>
        </v-col>

        <v-col cols="12" md="6">
          <v-card variant="tonal" class="pa-3 h-100">
            <div class="d-flex align-center ga-3 mb-3">
              <div
                class="wled-color-preview"
                :style="{ backgroundColor: previewColor }"
              />

              <div class="min-width-0">
                <div class="text-subtitle-2">
                  {{ colorLabel }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ previewColor }} · W={{ control.white ?? 0 }}
                </div>
              </div>
            </div>

            <div class="wled-slider-row">
              <div class="wled-slider-label">{{ redLabel }}</div>
              <v-slider v-model="control.red" :disabled="disabled || hasPreset" :min="0" :max="255" :step="1" thumb-label hide-details />
              <div class="wled-slider-value">{{ control.red ?? 0 }}</div>
            </div>

            <div class="wled-slider-row">
              <div class="wled-slider-label">{{ greenLabel }}</div>
              <v-slider v-model="control.green" :disabled="disabled || hasPreset" :min="0" :max="255" :step="1" thumb-label hide-details />
              <div class="wled-slider-value">{{ control.green ?? 0 }}</div>
            </div>

            <div class="wled-slider-row">
              <div class="wled-slider-label">{{ blueLabel }}</div>
              <v-slider v-model="control.blue" :disabled="disabled || hasPreset" :min="0" :max="255" :step="1" thumb-label hide-details />
              <div class="wled-slider-value">{{ control.blue ?? 0 }}</div>
            </div>

            <div class="wled-slider-row">
              <div class="wled-slider-label">{{ whiteLabel }}</div>
              <v-slider v-model="control.white" :disabled="disabled || hasPreset" :min="0" :max="255" :step="1" thumb-label hide-details />
              <div class="wled-slider-value">{{ control.white ?? 0 }}</div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <v-card-actions class="justify-end pt-0">
      <v-btn
        :disabled="disabled"
        color="error"
        prepend-icon="mdi-delete"
        variant="text"
        @click="$emit('remove')"
      >
        {{ $t('common.delete') || 'Delete' }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroWledSelect from './MacroWledSelect.vue'

export default {
  name: 'MacroWledControlEditor',

  components: {
    MacroWledSelect,
  },

  props: {
    modelValue: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
    wledLabel: { type: String, default: 'WLED' },
  },

  emits: ['remove', 'created'],

  data() {
    return {
      appStore: useAppStore(),
      wledEffectsByLamp: {} as Record<string, Array<{ title: string; value: number }>>,
      wledPresetsByLamp: {} as Record<string, Array<{ title: string; value: number | string }>>,
    }
  },

  computed: {
    control(): any {
      return this.modelValue as any
    },

    hasPreset(): boolean {
      return this.control.preset !== null &&
        this.control.preset !== undefined &&
        String(this.control.preset).trim() !== ''
    },

    presetLabel(): string {
      return String(this.$t?.('assets.preset') || 'Preset')
    },

    presetInfoLabel(): string {
      return String(this.$t?.('assets.wledPresetOverridesColor') || 'Preset selected. Color, effect and brightness values are ignored.')
    },

    effectLabel(): string {
      return String(this.$t?.('assets.effect') || 'Effect')
    },

    brightnessLabel(): string {
      return String(this.$t?.('assets.brightness') || 'Brightness')
    },

    colorLabel(): string {
      return String(this.$t?.('assets.targetColor') || 'Target color')
    },

    redLabel(): string {
      return String(this.$t?.('assets.red') || 'Red')
    },

    greenLabel(): string {
      return String(this.$t?.('assets.green') || 'Green')
    },

    blueLabel(): string {
      return String(this.$t?.('assets.blue') || 'Blue')
    },

    whiteLabel(): string {
      return String(this.$t?.('assets.white') || 'White')
    },

    previewColor(): string {
      return `rgb(${this.clampColor(this.control.red)}, ${this.clampColor(this.control.green)}, ${this.clampColor(this.control.blue)})`
    },
  },

  created() {
    this.ensureDefaults()
  },

  methods: {
    ensureDefaults() {
      this.control.name ??= ''
      this.control.red ??= 255
      this.control.green ??= 255
      this.control.blue ??= 255
      this.control.white ??= 0
      this.control.brightness ??= 255
      this.control.effect ??= null
      this.control.preset ??= null
    },

    handleWledCreated(name: string) {
      this.control.name = name
      this.$emit('created', name)
      void this.loadWledEffects(name, 'created')
      void this.loadWledPresets(name, 'created')
    },

    onWledChanged(name: string) {
      void this.loadWledEffects(name, 'lamp selected')
      void this.loadWledPresets(name, 'lamp selected')
    },

    getWledLampEntry(name: any): any {
      const normalizedName = String(name ?? '').trim().toLowerCase()
      const wled = this.appStore.getIntegrations?.wled ?? {}

      return Object.entries(wled)
        .map(([entryName, value]: [string, any]) => ({
          name: entryName,
          ip: value?.ip ?? value,
        }))
        .find((entry: any) => String(entry.name).trim().toLowerCase() === normalizedName)
    },

    getWledBaseUrl(lamp: any): string {
      const ip = String(lamp?.ip ?? '').trim()
      if (!ip) return ''

      return (/^https?:\/\//i.test(ip) ? ip : `http://${ip}`).replace(/\/+$/, '')
    },

    getWledCacheKey(name: any): string {
      return String(name ?? '').trim().toLowerCase()
    },

    wledEffectOptions(name: any): Array<{ title: string; value: number }> {
      const key = this.getWledCacheKey(name)
      return key ? this.wledEffectsByLamp[key] ?? [] : []
    },

    wledPresetOptions(name: any): Array<{ title: string; value: number | string }> {
      const key = this.getWledCacheKey(name)
      return key ? this.wledPresetsByLamp[key] ?? [] : []
    },

    async loadWledEffects(name: any, reason = 'unknown') {
      const cacheKey = this.getWledCacheKey(name)
      if (!cacheKey) return
      if (this.wledEffectsByLamp[cacheKey]?.length) return

      const lamp = this.getWledLampEntry(name)
      const baseUrl = this.getWledBaseUrl(lamp)
      if (!baseUrl) return

      try {
        const response = await fetch(`${baseUrl}/json/eff`, { cache: 'no-store' })
        const effects = await response.json()

        this.wledEffectsByLamp = {
          ...this.wledEffectsByLamp,
          [cacheKey]: Array.isArray(effects)
            ? effects.map((effect: any, index: number) => ({
              title: `${index} - ${String(effect)}`,
              value: index,
            }))
            : [],
        }
      } catch (error) {
        console.warn(`failed to load wled effects ${name}`, reason, error)
        this.wledEffectsByLamp = {
          ...this.wledEffectsByLamp,
          [cacheKey]: [],
        }
      }
    },

    async loadWledPresets(name: any, reason = 'unknown') {
      const cacheKey = this.getWledCacheKey(name)
      if (!cacheKey) return
      if (this.wledPresetsByLamp[cacheKey]?.length) return

      const lamp = this.getWledLampEntry(name)
      const baseUrl = this.getWledBaseUrl(lamp)
      if (!baseUrl) return

      try {
        const response = await fetch(`${baseUrl}/presets.json`, { cache: 'no-store' })
        const presets = await response.json()

        const options = Object.entries(presets ?? {})
          .filter(([id, preset]: [string, any]) => id !== '0' && preset && typeof preset === 'object')
          .map(([id, preset]: [string, any]) => ({
            title: `${id} - ${String(preset.n ?? preset.name ?? 'Preset')}`,
            value: Number(id),
          }))
          .sort((a, b) => Number(a.value) - Number(b.value))

        this.wledPresetsByLamp = {
          ...this.wledPresetsByLamp,
          [cacheKey]: options,
        }
      } catch (error) {
        console.warn(`failed to load wled presets ${name}`, reason, error)
        this.wledPresetsByLamp = {
          ...this.wledPresetsByLamp,
          [cacheKey]: [],
        }
      }
    },

    setWledEffect(value: any) {
      this.control.effect = value === null || value === undefined || value === ''
        ? null
        : Number(value)
    },

    setWledPreset(value: any) {
      this.control.preset = value === null || value === undefined || value === ''
        ? null
        : value
    },

    clampColor(value: any) {
      return Math.max(0, Math.min(255, Number(value ?? 0)))
    },
  },
}
</script>

<style scoped>
.wled-color-preview {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  flex: 0 0 auto;
}

.wled-slider-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 12px;
}

.wled-slider-label {
  font-size: 0.8rem;
  opacity: 0.75;
}

.wled-slider-value {
  font-variant-numeric: tabular-nums;
  text-align: right;
  opacity: 0.75;
}
</style>
