<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-cog" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('settings.title') || 'Settings' }}</div>
        </div>
      </div>

      <v-btn
        prepend-icon="mdi-content-save"
        color="primary"
        variant="tonal"
        :loading="saving"
        :disabled="saving"
        @click="saveSettings"
      >
        {{ $t('common.save') || 'Save' }}
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-alert
        v-if="successMessage"
        type="success"
        color="green-darken-3"
        class="mb-4"
        :text="successMessage"
      />

      <v-alert
        v-if="errorMessage"
        type="error"
        color="red-darken-3"
        class="mb-4"
        :text="errorMessage"
      />

      <v-row density="compact" align="start">
        <v-col cols="12" md="6" lg="4" class="d-flex flex-column">
          <v-card color="grey-darken-4" elevation="0" class="mb-2">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-translate" />
              <span>{{ $t('settings.language') || 'Language' }}</span>
            </v-card-title>

            <v-card-text>
              <v-select
                v-model="form.language"
                :items="languageItems"
                item-title="title"
                item-value="value"
                :label="$t('settings.language') || 'Language'"
                variant="outlined"
                density="comfortable"
                hide-details
              />
            </v-card-text>
          </v-card>

          <v-card color="grey-darken-4" elevation="0" class="mb-2">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-palette" />
              <span>{{ $t('settings.theme') || 'Theme' }}</span>
            </v-card-title>

            <v-card-text>
              <v-sheet color="grey-darken-3" rounded class="pa-3 mb-3">
                <div class="text-caption text-grey-lighten-1 mb-1">
                  {{ $t('settings.themeDefaultPrimaryColor') || 'Default primary color' }}
                </div>

                <div class="d-flex align-center ga-3 min-width-0">
                  <div
                    class="settings-color-preview settings-color-preview--large"
                    :style="{ backgroundColor: normalizedDefaultColorPreview }"
                  />

                  <div class="min-width-0">
                    <div class="text-body-2 text-truncate">{{ normalizedDefaultColorPreview }}</div>
                    <div class="text-caption text-grey-lighten-1">
                      {{ $t('settings.themeDefaultPrimaryColorHint') || 'Used as primary color for the whole bot system.' }}
                    </div>
                  </div>
                </div>
              </v-sheet>

              <v-menu
                v-model="showThemeColorPicker"
                :close-on-content-click="false"
                location="bottom"
              >
                <template #activator="{ props }">
                  <v-text-field
                    v-model="form.theme.default_color"
                    :label="$t('settings.themeHexColor') || 'Hex color'"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    prepend-inner-icon="mdi-palette"
                    prefix="#"
                    v-bind="props"
                    @blur="form.theme.default_color = normalizeHexColor(form.theme.default_color)"
                  >
                    <template #append-inner>
                      <div
                        class="settings-color-preview"
                        :style="{ backgroundColor: normalizedDefaultColorPreview }"
                      />
                    </template>
                  </v-text-field>
                </template>

                <v-card color="grey-darken-3">
                  <v-color-picker
                    v-model="defaultColorPickerValue"
                    hide-inputs
                    mode="hex"
                  />
                </v-card>
              </v-menu>
            </v-card-text>
          </v-card>

          <v-card color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-account-voice" />
              <span>{{ $t('settings.tts') || 'Text to Speech' }}</span>
            </v-card-title>

            <v-card-text>
              <v-alert
                type="warning"
                variant="tonal"
                density="comfortable"
                class="mb-4"
                :text="$t('settings.ttsWarning') || 'Avoid too high quality voice models on small systems. Medium models are usually the best balance for stream alerts.'"
              />

              <v-sheet color="grey-darken-3" rounded class="pa-3 mb-3">
                <div class="text-caption text-grey-lighten-1 mb-1">{{ $t('settings.selectedVoiceModel') || 'Selected voice model' }}</div>
                <div class="d-flex align-center ga-2 min-width-0">
                  <v-icon icon="mdi-check-circle" color="success" size="small" />
                  <span class="text-body-2 text-truncate">{{ form.tts.model || 'de_DE-thorsten-medium' }}</span>
                </div>
              </v-sheet>

              <v-text-field
                v-model="voiceSearch"
                :label="$t('settings.searchVoiceModel') || 'Search / change voice model'"
                prepend-inner-icon="mdi-magnify"
                :append-inner-icon="showVoicePicker ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                variant="outlined"
                density="comfortable"
                clearable
                hide-details
                class="mb-3"
                @focus="showVoicePicker = true"
                @click="showVoicePicker = true"
                @click:append-inner="showVoicePicker = !showVoicePicker"
              />

              <v-expand-transition>
                <div v-show="showVoicePicker">
                  <div class="d-flex justify-end mb-2">
                    <v-btn
                      size="small"
                      variant="text"
                      prepend-icon="mdi-chevron-up"
                      @click="showVoicePicker = false"
                    >
                      {{ $t('settings.hideVoices') || 'Hide voices' }}
                    </v-btn>
                  </div>

                  <v-expansion-panels
                    v-if="filteredVoiceLanguages.length"
                    variant="accordion"
                    color="grey-darken-3"
                  >
                    <v-expansion-panel
                      v-for="language in filteredVoiceLanguages"
                      :key="language"
                    >
                      <v-expansion-panel-title>
                        <div class="d-flex align-center justify-space-between w-100 pr-3">
                          <span>{{ language }}</span>
                          <v-chip size="x-small" variant="tonal">
                            {{ filteredVoicesByLanguage[language].length }}
                          </v-chip>
                        </div>
                      </v-expansion-panel-title>

                      <v-expansion-panel-text class="pa-0">
                        <v-list bg-color="grey-darken-4" density="compact" class="py-0">
                          <v-list-item
                            v-for="voice in filteredVoicesByLanguage[language]"
                            :key="voice"
                            :active="form.tts.model === voice"
                            rounded="0"
                            @click="selectVoice(voice)"
                          >
                            <template #prepend>
                              <v-icon
                                :icon="form.tts.model === voice ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                                :color="form.tts.model === voice ? 'primary' : undefined"
                              />
                            </template>

                            <v-list-item-title class="text-truncate">
                              {{ voice }}
                            </v-list-item-title>
                          </v-list-item>
                        </v-list>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>

                  <v-alert
                    v-else
                    type="info"
                    variant="tonal"
                    density="comfortable"
                    :text="$t('settings.noVoiceModelsFound') || 'No voice models found. The current/default voice will still be saved.'"
                  />
                </div>
              </v-expand-transition>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" lg="8">
          <v-card color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-tune" />
              <span>{{ $t('settings.assetTune') || 'Asset Tune' }}</span>
            </v-card-title>

            <v-card-text>
              <v-row density="compact">
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.asset_tune.codec"
                    :items="codecItems"
                    :label="$t('settings.videoCodec') || 'Video codec'"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.asset_tune.image_compress_level"
                    :label="$t('settings.imageCompressionLevel') || 'Image compression level'"
                    type="number"
                    min="0"
                    max="6"
                    step="1"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.asset_tune.image_compress_percent"
                    :label="$t('settings.imageQualityPercent') || 'Image quality percent'"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <v-card color="grey-darken-4" elevation="0" class="mt-2">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-chart-bar" />
              <span>{{ $t('settings.cava') || 'CAVA' }}</span>
            </v-card-title>

            <v-card-text>
              <v-row density="compact">
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.cava.bars"
                    :label="$t('settings.cavaBars') || 'Default bars'"
                    type="number"
                    min="1"
                    max="512"
                    step="1"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>
              </v-row>

              <v-divider class="my-4" />

              <div class="d-flex align-center justify-space-between ga-2 mb-3">
                <div>
                  <div class="text-subtitle-2">{{ $t('settings.cavaTargets') || 'CAVA targets' }}</div>
                  <div class="text-caption text-grey-lighten-1">
                    {{ $t('settings.cavaTargetsHint') || 'Add optional extra CAVA outputs like jukebox. These are not created by default.' }}
                  </div>
                </div>
              </div>

              <v-sheet color="grey-darken-3" rounded class="pa-3 mb-3">
                <v-row density="compact" align="center">
                  <v-col cols="12" md="5">
                    <v-text-field
                      v-model="newCavaTargetName"
                      :label="$t('settings.cavaTargetName') || 'Target name'"
                      placeholder="jukebox"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                    />
                  </v-col>

                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model.number="newCavaTargetBars"
                      :label="$t('settings.cavaBars') || 'Bars'"
                      type="number"
                      min="1"
                      max="512"
                      step="1"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                    />
                  </v-col>

                  <v-col cols="12" md="3">
                    <v-btn
                      block
                      prepend-icon="mdi-plus"
                      color="primary"
                      variant="tonal"
                      @click="addCavaTarget"
                    >
                      {{ $t('common.add') || 'Add' }}
                    </v-btn>
                  </v-col>
                </v-row>
              </v-sheet>

              <v-expansion-panels
                v-if="cavaTargetNames.length"
                variant="accordion"
                class="mb-3"
              >
                <v-expansion-panel
                  v-for="targetName in cavaTargetNames"
                  :key="targetName"
                  color="grey-darken-3"
                >
                  <v-expansion-panel-title>
                    <div class="d-flex align-center ga-2 min-width-0 w-100">
                      <v-icon icon="mdi-chart-bar" size="small" />
                      <span class="text-truncate">cava {{ targetName }}</span>
                      <v-spacer />
                      <v-chip size="small" variant="tonal">
                        {{ form.cava.targets[targetName]?.bars || 36 }} bars
                      </v-chip>
                    </div>
                  </v-expansion-panel-title>

                  <v-expansion-panel-text>
                    <v-row density="compact">
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="form.cava.targets[targetName].bars"
                          :label="$t('settings.cavaBars') || 'Bars'"
                          type="number"
                          min="1"
                          max="512"
                          step="1"
                          variant="outlined"
                          density="comfortable"
                          hide-details="auto"
                        />
                      </v-col>

                      <v-col cols="12" md="6">
                        <v-switch
                          v-model="form.cava.targets[targetName].enabled"
                          :label="$t('common.enabled') || 'Enabled'"
                          color="primary"
                          inset
                          hide-details
                        />
                      </v-col>
                    </v-row>

                    <v-table density="compact" class="bg-transparent mt-2">
                      <tbody>
                      <tr
                        v-for="settingKey in cavaTargetSettingKeys(targetName)"
                        :key="`${targetName}-${settingKey}`"
                      >
                        <td class="text-caption text-grey-lighten-1" style="width: 38%">{{ settingKey }}</td>
                        <td>
                          <v-text-field
                            v-model="form.cava.targets[targetName][settingKey]"
                            variant="outlined"
                            density="compact"
                            hide-details
                          />
                        </td>
                        <td class="text-right" style="width: 48px">
                          <v-btn
                            icon="mdi-delete"
                            size="small"
                            variant="text"
                            color="red-lighten-2"
                            @click="removeCavaTargetSetting(targetName, settingKey)"
                          />
                        </td>
                      </tr>
                      </tbody>
                    </v-table>

                    <v-row density="compact" align="center" class="mt-2">
                      <v-col cols="12" md="5">
                        <v-text-field
                          v-model="newCavaTargetSettings[targetName].key"
                          :label="$t('settings.cavaSettingKey')"
                          placeholder="framerate"
                          variant="outlined"
                          density="comfortable"
                          hide-details="auto"
                        />
                      </v-col>

                      <v-col cols="12" md="5">
                        <v-text-field
                          v-model="newCavaTargetSettings[targetName].value"
                          :label="$t('settings.cavaSettingValue')"
                          placeholder="60"
                          variant="outlined"
                          density="comfortable"
                          hide-details="auto"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-btn
                          block
                          prepend-icon="mdi-plus"
                          variant="tonal"
                          @click="addCavaTargetSetting(targetName)"
                        >
                          {{ $t('common.add') || 'Add' }}
                        </v-btn>
                      </v-col>
                    </v-row>

                    <div class="d-flex justify-end mt-3">
                      <v-btn
                        prepend-icon="mdi-delete"
                        color="red-lighten-2"
                        variant="text"
                        @click="removeCavaTarget(targetName)"
                      >
                        {{ $t('common.delete') }}
                      </v-btn>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mapActions, mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'

type SettingsForm = {
  language: string
  asset_tune: {
    codec: string
    image_compress_level: number
    image_compress_percent: number
  }
  tts: {
    model: string
  }
  theme: {
    default_color: string
  }
  cava: {
    bars: number
    input: {
      source: string
    }
    output: {
      channels: string
    }
    targets: Record<string, Record<string, any>>
  }
}

const defaultForm = (): SettingsForm => ({
  language: 'en',
  asset_tune: {
    codec: 'vp9',
    image_compress_level: 6,
    image_compress_percent: 80,
  },
  tts: {
    model: 'de_DE-thorsten-medium',
  },
  theme: {
    default_color: 'ff9800',
  },
  cava: {
    bars: 36,
    input: {
      source: 'streambot_cava.monitor',
    },
    output: {
      channels: 'mono',
    },
    targets: {},
  },
})

export default {
  name: 'Settings',

  data() {
    return {
      saving: false,
      errorMessage: '',
      successMessage: '',
      form: defaultForm(),
      voiceSearch: '',
      showVoicePicker: false,
      showThemeColorPicker: false,
      newCavaTargetName: '',
      newCavaTargetBars: 63,
      newCavaTargetSettings: {} as Record<string, { key: string, value: string }>,
      languageItems: [
        { title: 'English', value: 'en' },
        { title: 'Deutsch', value: 'de' },
      ],
      codecItems: [
        { title: 'VP9', value: 'vp9' },
        { title: 'AV1', value: 'av1' },
      ],
    }
  },

  computed: {
    ...mapState(useAppStore, ['systemConfig', 'getVoices']),

    defaultColorPickerValue: {
      get(): string {
        return (this as any).normalizedDefaultColorPreview
      },
      set(value: string) {
        ;(this as any).form.theme.default_color = (this as any).normalizeHexColor(value)
      },
    },

    normalizedDefaultColorPreview(): string {
      return `#${(this as any).normalizeHexColor((this as any).form?.theme?.default_color || 'ff9800')}`
    },

    normalizedVoicesByLanguage(): Record<string, string[]> {
      const voices: Record<string, string[]> = (this as any).getVoices || {}
      const normalized: Record<string, string[]> = {}

      for (const language of Object.keys(voices).sort()) {
        const voiceList = Array.from(new Set([...(voices[language] || [])]))
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b)))

        if (voiceList.length) {
          normalized[language] = voiceList
        }
      }

      if (!Object.values(normalized).some(voices => voices.includes('de_DE-thorsten-medium'))) {
        normalized.de_DE = Array.from(new Set([
          'de_DE-thorsten-medium',
          ...(normalized.de_DE || []),
        ])).sort((a, b) => String(a).localeCompare(String(b)))
      }

      const selectedModel = String((this as any).form?.tts?.model || '').trim()

      if (selectedModel && !Object.values(normalized).some(voices => voices.includes(selectedModel))) {
        const language = selectedModel.split('-')[0] || 'custom'

        normalized[language] = Array.from(new Set([
          selectedModel,
          ...(normalized[language] || []),
        ])).sort((a, b) => String(a).localeCompare(String(b)))
      }

      return normalized
    },

    filteredVoicesByLanguage(): Record<string, string[]> {
      const query = String((this as any).voiceSearch || '').trim().toLowerCase()
      const grouped: Record<string, string[]> = {}

      for (const language of Object.keys((this as any).normalizedVoicesByLanguage).sort()) {
        const voices = (this as any).normalizedVoicesByLanguage[language] || []
        const filteredVoices = query
          ? voices.filter((voice: string) => `${language} ${voice}`.toLowerCase().includes(query))
          : voices

        if (filteredVoices.length) {
          grouped[language] = filteredVoices
        }
      }

      return grouped
    },

    cavaTargetNames(): string[] {
      return Object.keys((this as any).form?.cava?.targets || {}).sort()
    },

    filteredVoiceLanguages(): string[] {
      return Object.keys((this as any).filteredVoicesByLanguage).sort()
    },
  },

  watch: {
    systemConfig: {
      immediate: true,
      deep: true,
      handler() {
        this.syncFromStore()
      },
    },
  },

  methods: {
    ...mapActions(useAppStore, ['setSystemConfig']),

    selectVoice(voice: string) {
      this.form.tts.model = voice
      this.voiceSearch = ''
      this.showVoicePicker = false
    },

    syncFromStore() {
      const defaults = defaultForm()
      const settings: any = this.systemConfig || {}
      const assetTune = settings.asset_tune || {}
      const tts = settings.tts || {}
      const theme = settings.theme || {}
      const cava = settings.cava || {}

      this.form = {
        ...defaults,
        ...settings,
        language: settings.language || defaults.language,
        asset_tune: {
          ...defaults.asset_tune,
          ...assetTune,
        },
        tts: {
          ...defaults.tts,
          ...tts,
          model: tts.model || defaults.tts.model,
        },
        theme: {
          ...defaults.theme,
          ...theme,
          default_color: this.normalizeHexColor(theme.default_color || defaults.theme.default_color),
        },
        cava: {
          ...defaults.cava,
          ...cava,
          bars: this.normalizeNumber(cava.bars, defaults.cava.bars),
          input: {
            ...defaults.cava.input,
            ...(cava.input || {}),
          },
          output: {
            ...defaults.cava.output,
            ...(cava.output || {}),
          },
          targets: {
            ...defaults.cava.targets,
            ...(cava.targets || {}),
          },
        },
      }

      this.ensureCavaTargetSettingDrafts()
    },


    normalizeCavaValue(value: any) {
      if (typeof value === 'boolean' || typeof value === 'number') return value

      const raw = String(value ?? '').trim()
      const normalized = raw.toLowerCase()

      if (['true', '1', 'yes', 'on'].includes(normalized)) return true
      if (['false', '0', 'no', 'off'].includes(normalized)) return false

      const numericValue = Number(raw)

      return raw !== '' && Number.isFinite(numericValue) ? numericValue : raw
    },

    normalizeCavaTargetName(value: string) {
      return String(value || '')
        .replace(/^cava\s+/i, '')
        .trim()
        .replace(/\s+/g, '_')
    },

    ensureCavaTargetSettingDrafts() {
      for (const targetName of Object.keys(this.form.cava.targets || {})) {
        if (!this.newCavaTargetSettings[targetName]) {
          this.newCavaTargetSettings[targetName] = { key: '', value: '' }
        }
      }
    },

    addCavaTarget() {
      const targetName = this.normalizeCavaTargetName(this.newCavaTargetName)

      if (!targetName || targetName === 'default') return

      this.form.cava.targets = {
        ...(this.form.cava.targets || {}),
        [targetName]: {
          bars: this.normalizeNumber(this.newCavaTargetBars, 63),
          enabled: true,
          ...(this.form.cava.targets?.[targetName] || {}),
        },
      }

      this.newCavaTargetSettings[targetName] = { key: '', value: '' }
      this.newCavaTargetName = ''
      this.newCavaTargetBars = 63
    },

    removeCavaTarget(targetName: string) {
      const targets = { ...(this.form.cava.targets || {}) }
      delete targets[targetName]
      this.form.cava.targets = targets
      delete this.newCavaTargetSettings[targetName]
    },

    cavaTargetSettingKeys(targetName: string) {
      return Object.keys(this.form.cava.targets?.[targetName] || {})
        .filter(key => !['bars', 'enabled'].includes(key))
        .sort()
    },

    addCavaTargetSetting(targetName: string) {
      const draft = this.newCavaTargetSettings[targetName] || { key: '', value: '' }
      const key = String(draft.key || '').trim()

      if (!key || ['bars', 'enabled'].includes(key)) return

      this.form.cava.targets[targetName] = {
        ...(this.form.cava.targets[targetName] || {}),
        [key]: this.normalizeCavaValue(draft.value),
      }

      this.newCavaTargetSettings[targetName] = { key: '', value: '' }
    },

    removeCavaTargetSetting(targetName: string, settingKey: string) {
      const target = { ...(this.form.cava.targets?.[targetName] || {}) }
      delete target[settingKey]
      this.form.cava.targets[targetName] = target
    },

    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
      const client: any = getWebsocketClient()

      if (!client) {
        return Promise.reject(new Error('websocket is not connected'))
      }

      if (typeof client.request === 'function') {
        return client.request(method, params, timeout)
      }

      return new Promise((resolve, reject) => {
        if (typeof client.send !== 'function') {
          reject(new Error('websocket client does not support send/request'))
          return
        }

        client.send(method, params)
        resolve({ params })
      })
    },

    getWebsocketResultKey(method: string) {
      return `result_${String(method ?? '').replace(/[^a-zA-Z0-9_]/g, '_')}`
    },

    unwrapWebsocketResponse(response: any, method = ''): any {
      const resultKey = method ? this.getWebsocketResultKey(method) : ''
      const containers = [response, response?.data, response?.payload, response?.result, response?.params].filter(Boolean)

      if (resultKey) {
        for (const container of containers) {
          if (container && typeof container === 'object' && Object.prototype.hasOwnProperty.call(container, resultKey)) {
            return container[resultKey]
          }
        }
      }

      for (const container of containers) {
        if (container && typeof container === 'object') {
          if (Object.prototype.hasOwnProperty.call(container, 'settings')) return container.settings
          if (Object.prototype.hasOwnProperty.call(container, 'data')) return container.data
          if (Object.prototype.hasOwnProperty.call(container, 'result')) return container.result
          if (Object.prototype.hasOwnProperty.call(container, 'payload')) return container.payload
        }
      }

      return response
    },

    normalizeHexColor(value: string) {
      const color = String(value || 'ff9800')
        .replace(/^#/, '')
        .replace(/[^0-9a-f]/gi, '')
        .trim()
        .toLowerCase()

      if (/^[0-9a-f]{3}$/i.test(color) || /^[0-9a-f]{6}$/i.test(color)) {
        return color
      }

      return 'ff9800'
    },

    normalizeNumber(value: any, fallback: number) {
      const number = Number(value)

      return Number.isFinite(number) ? number : fallback
    },

    normalizeForm(): SettingsForm {
      const defaults = defaultForm()

      return {
        language: String(this.form.language || defaults.language).trim().toLowerCase(),
        asset_tune: {
          codec: String(this.form.asset_tune.codec || defaults.asset_tune.codec).trim().toLowerCase(),
          image_compress_level: Number(this.form.asset_tune.image_compress_level),
          image_compress_percent: Number(this.form.asset_tune.image_compress_percent),
        },
        tts: {
          model: String(this.form.tts.model || defaults.tts.model).trim(),
        },
        theme: {
          default_color: this.normalizeHexColor(this.form.theme.default_color || defaults.theme.default_color),
        },
        cava: {
          ...defaults.cava,
          ...this.form.cava,
          bars: this.normalizeNumber(this.form.cava.bars, defaults.cava.bars),
          input: {
            ...defaults.cava.input,
            ...(this.form.cava.input || {}),
          },
          output: {
            ...defaults.cava.output,
            ...(this.form.cava.output || {}),
          },
          targets: Object.fromEntries(
            Object.entries(this.form.cava.targets || {})
              .map(([targetName, targetConfig]: [string, any]) => [
                this.normalizeCavaTargetName(targetName),
                {
                  ...targetConfig,
                  bars: this.normalizeNumber(targetConfig?.bars, defaults.cava.bars),
                  enabled: targetConfig?.enabled !== false,
                },
              ])
              .filter(([targetName]) => targetName && targetName !== 'default'),
          ),
        },
      }
    },

    async saveSettings() {
      this.saving = true
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const settings = this.normalizeForm()
        const response = await this.requestWebsocket('settings_save', settings)
        const savedSettings = this.unwrapWebsocketResponse(response, 'settings_save') || settings

        if (savedSettings?.error) {
          throw new Error(savedSettings.error)
        }

        this.setSystemConfig(savedSettings)
        this.successMessage = this.$t('settings.saved') || 'Settings saved'
      } catch (error: any) {
        this.errorMessage = error?.message || 'Failed to save settings'
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style scoped lang="scss">
.min-width-0 {
  min-width: 0;
}

.settings-color-preview {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.settings-color-preview--large {
  width: 38px;
  height: 38px;
}
</style>
