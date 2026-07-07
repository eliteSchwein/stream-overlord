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
              <v-text-field
                v-model="form.theme.default_color"
                label="Default primary color"
                variant="outlined"
                density="comfortable"
                hide-details
                prefix="#"
              >
                <template #append-inner>
                  <div
                    class="settings-color-preview"
                    :style="{ backgroundColor: normalizedDefaultColorPreview }"
                  />
                </template>
              </v-text-field>
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
                text="Avoid too high quality voice models on small systems. Medium models are usually the best balance for stream alerts."
              />

              <v-sheet color="grey-darken-3" rounded class="pa-3 mb-3">
                <div class="text-caption text-grey-lighten-1 mb-1">Selected voice model</div>
                <div class="d-flex align-center ga-2 min-width-0">
                  <v-icon icon="mdi-check-circle" color="success" size="small" />
                  <span class="text-body-2 text-truncate">{{ form.tts.model || 'de_DE-thorsten-medium' }}</span>
                </div>
              </v-sheet>

              <v-text-field
                v-model="voiceSearch"
                label="Search / change voice model"
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
                      Hide voices
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
                    text="No voice models found. The current/default voice will still be saved."
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
                    label="Video codec"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.asset_tune.image_compress_level"
                    label="Image compression level"
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
                    label="Image quality percent"
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

    normalizedDefaultColorPreview(): string {
      const color = String((this as any).form?.theme?.default_color || 'ff9800')
        .replace(/^#/, '')
        .trim()

      return `#${color || 'ff9800'}`
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
      }
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
        .trim()
        .toLowerCase()

      if (/^[0-9a-f]{3}$/i.test(color) || /^[0-9a-f]{6}$/i.test(color)) {
        return color
      }

      return 'ff9800'
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
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
</style>
