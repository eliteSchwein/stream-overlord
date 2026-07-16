<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4" class="channel-point-dialog">
      <v-toolbar flat density="comfortable">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-star-circle" class="mr-2" />
          <span class="text-truncate">{{ title }}</span>
        </v-toolbar-title>

        <v-spacer />

        <YamlImportExportButtons
          class="mr-2"
          :filename="exportFilename"
          :disabled="loading || savingInternal"
          :export-data="exportPayload"
          @import="importChannelPoint"
          @error="handleImportError"
        />

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text class="py-3 px-0">
        <v-alert
          v-if="error || errorMessage"
          type="error"
          color="red-darken-3"
          density="comfortable"
          class="mb-3"
          :text="error || errorMessage"
        />

        <v-row density="comfortable" class="mb-3 px-3">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="form.name"
              label="Name"
              density="comfortable"
              variant="outlined"
              hide-details
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-switch
              v-model="form.enable_default"
              label="Enable default"
              color="primary"
              density="comfortable"
              hide-details
              inset
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-switch
              v-model="form.auto_accept"
              label="Auto accept"
              color="primary"
              density="comfortable"
              hide-details
              inset
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-switch
              v-model="form.strip_emotes"
              label="Strip emotes"
              color="primary"
              density="comfortable"
              hide-details
              inset
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-switch
              v-model="form.input_required"
              label="Input required"
              color="primary"
              density="comfortable"
              hide-details
              inset
            />
          </v-col>
        </v-row>

        <v-expansion-panels v-model="openPanels" variant="accordion">
          <v-expansion-panel value="asset">
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 min-width-0">
                <v-icon icon="mdi-palette" />
                <span class="text-truncate">Asset</span>
              </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <ChannelPointAssetAccordion
                ref="assetAccordion"
                :key="`asset_${generatedConfigName}`"
                :name="generatedConfigName"
                :disabled="loading || savingInternal"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel value="macro">
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 min-width-0">
                <v-icon icon="mdi-code-braces" />
                <span class="text-truncate">Macro</span>
              </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <ChannelPointMacroAccordion
                ref="macroAccordion"
                :key="`macro_${generatedConfigName}`"
                :name="generatedConfigName"
                :initial-content="macroContent"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading || savingInternal" :disabled="!canSave" @click="save">
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { useAppStore } from '@/stores/app'
import ChannelPointAssetAccordion from '@/components/accordions/ChannelPointAssetAccordion.vue'
import ChannelPointMacroAccordion from '@/components/accordions/ChannelPointMacroAccordion.vue'
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'

export default {
  name: 'ChannelPointEditorDialog',

  components: {
    ChannelPointAssetAccordion,
    ChannelPointMacroAccordion,
    YamlImportExportButtons,
  },

  props: {
    modelValue: { type: Boolean, default: false },
    channelPoint: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
  },

  emits: ['update:modelValue', 'save'],

  data() {
    return {
      appStore: useAppStore(),
      openPanels: [],
      form: {
        name: '',
        enable_default: false,
        auto_accept: false,
        strip_emotes: false,
        input_required: false,
      },
      originalName: '',
      macroContent: '',
      errorMessage: '',
      savingInternal: false,
    }
  },

  computed: {
    title(): string {
      return this.channelPoint?.label ? `${this.$t('channelPoints.edit') || 'Edit channel point'}: ${this.channelPoint.label}` : (this.$t('channelPoints.edit') || 'Edit channel point')
    },


    normalizedName(): string {
      return this.originalName || this.normalizeName(this.form.name)
    },

    generatedConfigName(): string {
      return this.normalizedName ? `channel_point_${this.normalizedName}` : 'channel_point_'
    },

    canSave(): boolean {
      return String(this.form.name ?? '').trim().length > 0 && this.normalizedName.length > 0 && !this.loading && !this.savingInternal
    },

    exportFilename(): string {
      const name = this.normalizedName || this.normalizeName(this.form.name) || 'new'
      return `channel_point_${name}.yaml`
    },

    exportPayload(): Record<string, any> {
      const normalizedName = this.normalizedName || this.normalizeName(this.form.name)
      const generatedName = normalizedName ? `channel_point_${normalizedName}` : 'channel_point_'

      return {
        label: String(this.form.name || normalizedName).trim(),
        name: normalizedName,
        enable_default: this.form.enable_default,
        auto_accept: this.form.auto_accept,
        strip_emotes: this.form.strip_emotes,
        input_required: this.form.input_required,
        asset: generatedName,
        macro: generatedName,
      }
    },
  },

  methods: {
    async open() {
      this.errorMessage = ''
      this.resetForm()
      await this.$nextTick()
      await this.loadExistingGeneratedFiles()
    },

    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const websocketClient = getWebsocketClient()

      if (!websocketClient) {
        throw new Error('websocket is not connected')
      }

      const response = await websocketClient.request(method, params, timeout)
      return response?.params ?? response
    },

    async requestEndpoint(method: string, endpoint: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      try {
        const response = await this.requestWebsocket(method, params, timeout)
        return response?.data ?? response
      } catch (websocketError) {
        const response = await fetch(`${this.appStore.getRestApi}/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })

        const data = await response.json().catch(() => ({}))
        const responseData = data?.data ?? data

        if (!response.ok || responseData?.error || data?.error) {
          throw new Error(responseData?.error ?? responseData?.message ?? data?.error ?? `${endpoint} failed`)
        }

        return responseData
      }
    },

    normalizeName(value: any): string {
      return String(value ?? '')
        .trim()
        .replace(/^channel_point_/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
    },

    resetForm() {
      const point: any = this.channelPoint ?? {}
      const label = String(point.label ?? point.name ?? '').trim()
      const fileName = this.normalizeName(point.name ?? point.file ?? point.asset ?? point.macro ?? label)

      this.originalName = fileName
      this.form = {
        name: label || fileName,
        enable_default: point.enable_default === true,
        auto_accept: point.auto_accept === true,
        strip_emotes: point.strip_emotes === true,
        input_required: point.input_required === true,
      }

      this.macroContent = this.defaultMacroContent(`channel_point_${fileName}`)
    },

    async loadExistingGeneratedFiles() {
      if (!this.normalizedName) {
        await this.$nextTick()
        ;(this.$refs.assetAccordion as any)?.setAsset?.({ channel: 'general', duration: 5 })
        ;(this.$refs.macroAccordion as any)?.setContent?.(this.defaultMacroContent(this.generatedConfigName), this.generatedConfigName)
        return
      }

      await Promise.all([
        this.loadExistingAsset(),
        this.loadExistingMacro(),
      ])
    },

    async loadExistingAsset() {
      await this.$nextTick()
      try {
        await (this.$refs.assetAccordion as any)?.open?.(this.generatedConfigName)
      } catch (error) {
        ;(this.$refs.assetAccordion as any)?.setAsset?.({ channel: 'general', duration: 5 })
      }
    },

    async loadExistingMacro() {
      try {
        const data = await this.requestEndpoint('macro_read', 'macro/read', {
          name: this.generatedConfigName,
          path: `${this.generatedConfigName}.yaml`,
          file: `${this.generatedConfigName}.yaml`,
        })

        this.macroContent = String(data?.content ?? this.defaultMacroContent(this.generatedConfigName))
      } catch (error) {
        this.macroContent = this.defaultMacroContent(this.generatedConfigName)
      }

      await this.$nextTick()
      ;(this.$refs.macroAccordion as any)?.setContent?.(this.macroContent, this.generatedConfigName)
    },

    defaultMacroContent(name: string) {
      return `name: ${name}\ntasks: []\n`
    },

    async importChannelPoint(payload: any) {
      const data = payload?.data ?? {}

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        this.errorMessage = 'Imported YAML must be an object'
        return
      }

      const importedLabel = String(data.label ?? data.name ?? '').trim()
      const importedName = this.normalizeName(data.name ?? data.asset ?? data.macro ?? importedLabel)

      this.form = {
        name: importedLabel || importedName,
        enable_default: data.enable_default === true,
        auto_accept: data.auto_accept === true,
        strip_emotes: data.strip_emotes === true,
        input_required: data.input_required === true,
      }

      if (importedName) {
        this.originalName = importedName
      }

      this.errorMessage = ''

      await this.$nextTick()

      if (importedName) {
        await this.loadExistingGeneratedFiles()
      } else {
        ;(this.$refs.assetAccordion as any)?.setAsset?.({ channel: 'general', duration: 5 })
        ;(this.$refs.macroAccordion as any)?.setContent?.(this.defaultMacroContent(this.generatedConfigName), this.generatedConfigName)
      }
    },

    handleImportError(error: any) {
      this.errorMessage = error?.message ?? String(error ?? 'Failed to import YAML')
    },

    save() {
      if (!this.canSave) return

      this.$emit('save', {
        name: this.normalizedName,
        label: String(this.form.name || this.normalizedName).trim(),
        enable_default: this.form.enable_default,
        auto_accept: this.form.auto_accept,
        strip_emotes: this.form.strip_emotes,
        input_required: this.form.input_required,
        asset: (this.$refs.assetAccordion as any)?.getAssetPayload?.() ?? {},
        macroContent: (this.$refs.macroAccordion as any)?.getContent?.() || this.macroContent || this.defaultMacroContent(this.generatedConfigName),
      })
    },
  },
}
</script>

<style scoped lang="scss">
.channel-point-dialog {
}

.min-width-0 {
  min-width: 0;
}
</style>
