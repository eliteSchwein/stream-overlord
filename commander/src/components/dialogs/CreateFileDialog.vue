<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon :icon="icon" />
        <span>{{ title || $t('file.createFile') }}</span>
      </v-card-title>

      <v-card-text>
        <v-text-field
          v-model="name"
          :label="nameLabel || $t('file.name')"
          :suffix="extensionSuffix"
          variant="outlined"
          density="compact"
          hide-details="auto"
          class="mb-3"
          autofocus
          @keydown.enter="createFile"
        />

        <v-select
          v-if="presetItems.length"
          v-model="selectedPreset"
          :items="presetItems"
          :label="presetLabel || $t('file.preset')"
          variant="outlined"
          density="compact"
          hide-details="auto"
          class="mb-3"
        />

        <v-alert
          v-else-if="normalizedPresetFolder"
          type="info"
          color="grey-darken-3"
          density="compact"
          variant="tonal"
          :text="noPresetsLabel || $t('file.noPresetsFound')"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          variant="text"
          @click="close"
        >
          {{ cancelLabel || $t('actions.cancel') }}
        </v-btn>

        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!canCreate"
          @click="createFile"
        >
          {{ createLabel || $t('actions.create') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import eventBus from '@/eventBus'

const presetFiles = import.meta.glob('../../presets/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export default {
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    currentPath: {
      type: String,
      default: '',
    },
    websocketMethod: {
      type: String,
      required: true,
    },
    presetFolder: {
      type: String,
      default: '',
    },
    extension: {
      type: String,
      default: '',
    },
    enforceExtension: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String,
      default: 'mdi-file-plus',
    },
    title: {
      type: String,
      default: '',
    },
    nameLabel: {
      type: String,
      default: '',
    },
    presetLabel: {
      type: String,
      default: '',
    },
    noPresetsLabel: {
      type: String,
      default: '',
    },
    cancelLabel: {
      type: String,
      default: '',
    },
    createLabel: {
      type: String,
      default: '',
    },
  },

  emits: ['update:modelValue', 'created'],

  data() {
    return {
      name: '',
      selectedPreset: '',
      loading: false,
    }
  },

  computed: {
    normalizedPresetFolder(): string {
      return String(this.presetFolder ?? '')
        .replace(/^@?\/?src\/?presets\/?/i, '')
        .replace(/^@?\/?presets\/?/i, '')
        .replace(/^\/+|\/+$/g, '')
    },

    normalizedExtension(): string {
      return String(this.extension ?? '')
        .replace(/^\.+/, '')
        .trim()
        .toLowerCase()
    },

    extensionSuffix(): string {
      if (!this.normalizedExtension || !this.enforceExtension) return ''

      return `.${this.normalizedExtension}`
    },

    presetItems(): any[] {
      const folder = this.normalizedPresetFolder

      if (!folder) return []

      return Object.keys(presetFiles)
        .filter((file) => file.includes(`/presets/${folder}/`))
        .sort((a, b) => a.localeCompare(b))
        .map((file) => {
          const presetName = file.split('/').pop()?.replace(/\.html$/i, '') ?? file

          return {
            title: this.formatPresetName(presetName),
            value: file,
          }
        })
    },

    canCreate(): boolean {
      return this.safeName.length > 0 && (!this.presetItems.length || this.selectedPreset.length > 0)
    },

    safeName(): string {
      return String(this.name ?? '').trim().replace(/^\/+/, '')
    },

    normalizedFileName(): string {
      const name = this.safeName
      const extension = this.normalizedExtension

      if (!extension) return name

      if (this.enforceExtension) {
        const nameWithoutExtension = name.replace(/\.[^/.]+$/i, '')
        return `${nameWithoutExtension}.${extension}`
      }

      if (!name.toLowerCase().endsWith(`.${extension}`)) {
        return `${name}.${extension}`
      }

      return name
    },

    targetPath(): string {
      const basePath = String(this.currentPath ?? '').replace(/^\/+|\/+$/g, '')

      return [basePath, this.normalizedFileName].filter(Boolean).join('/')
    },
  },

  watch: {
    modelValue(value: boolean) {
      if (value) this.prepareDialog()
    },

    presetFolder() {
      this.selectedPreset = ''
      this.prepareDialog()
    },
  },

  mounted() {
    this.prepareDialog()
  },

  methods: {
    prepareDialog() {
      if (!this.selectedPreset && this.presetItems.length) {
        this.selectedPreset = this.presetItems[0].value
      }
    },

    close() {
      this.$emit('update:modelValue', false)
      this.name = ''
      this.loading = false
    },

    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 10_000): Promise<any> {
      return new Promise((resolve, reject) => {
        eventBus.$emit('websocket:request', {
          method,
          params,
          timeout,
          resolve,
          reject,
        })
      })
    },

    getPresetContent(preset: string): string {
      if (!preset) return ''

      return String((presetFiles as any)[preset] ?? '')
    },

    formatPresetName(value: string): string {
      return String(value ?? '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
    },

    async createFile() {
      if (!this.canCreate || this.loading) return

      this.loading = true

      try {
        await this.requestWebsocket(this.websocketMethod, {
          path: this.targetPath,
          content: this.getPresetContent(this.selectedPreset),
        })

        this.$emit('created', this.targetPath)
        this.close()
      } catch (error) {
        console.error('file create failed', error)
      } finally {
        this.loading = false
      }
    },
  },
}
</script>
