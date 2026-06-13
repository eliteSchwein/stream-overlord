<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4" class="overlay-editor-dialog">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-application-edit-outline" class="mr-2" />
          <span class="text-truncate">{{ entry?.path || title }}</span>
        </v-toolbar-title>

        <v-btn
          icon="mdi-refresh"
          variant="text"
          :loading="loading"
          @click="loadFile"
        />

        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-content-save"
          :loading="saving"
          :disabled="!entry?.path || loading"
          @click="saveFile"
        >
          {{ saveLabel }}
        </v-btn>

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text class="pa-3 overlay-editor-dialog__body">
        <v-alert
          v-if="errorMessage"
          type="error"
          color="red-darken-3"
          density="compact"
          class="mb-3"
          :text="errorMessage"
        />

        <v-row density="compact" class="overlay-editor-dialog__settings mb-3">
          <v-col cols="12" md="3">
            <v-text-field
              v-model.number="previewWidth"
              :label="widthLabel"
              type="number"
              min="1"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>

          <v-col cols="12" md="3">
            <v-text-field
              v-model.number="previewHeight"
              :label="heightLabel"
              type="number"
              min="1"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>

          <v-col cols="12" md="3">
            <v-select
              v-model="previewPreset"
              :items="previewPresets"
              item-title="title"
              item-value="value"
              :label="presetLabel"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="applyPreviewPreset"
            />
          </v-col>

          <v-col cols="12" md="3">
            <v-select
              v-model="previewMode"
              :items="previewModes"
              item-title="title"
              item-value="value"
              :label="previewModeLabel"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>

        <v-row density="compact" class="overlay-editor-dialog__workspace">
          <v-col cols="12" lg="6" class="overlay-editor-dialog__pane">
            <v-card color="grey-darken-3" variant="flat" class="h-100 d-flex flex-column">
              <v-card-title class="py-2 d-flex align-center justify-space-between">
                <span class="text-subtitle-2">{{ codeLabel }}</span>
                <v-chip size="small" variant="tonal">{{ editorLanguage }}</v-chip>
              </v-card-title>
              <v-divider />

              <div class="overlay-editor-dialog__code">
                <vue-monaco-editor
                  v-model:value="content"
                  :language="editorLanguage"
                  theme="vs-dark"
                  height="100%"
                  :options="editorOptions"
                />
              </div>
            </v-card>
          </v-col>

          <v-col cols="12" lg="6" class="overlay-editor-dialog__pane">
            <v-card color="grey-darken-3" variant="flat" class="h-100 d-flex flex-column">
              <v-card-title class="py-2 d-flex align-center justify-space-between">
                <div>
                  <div class="text-subtitle-2">{{ previewLabel }}</div>
                  <div class="text-caption text-grey-lighten-1">
                    {{ previewWidth }} × {{ previewHeight }} · {{ aspectRatioLabel }}
                  </div>
                </div>

                <v-btn
                  variant="text"
                  size="small"
                  prepend-icon="mdi-open-in-new"
                  :href="renderedPreviewUrl"
                  target="_blank"
                  :disabled="!renderedPreviewUrl"
                >
                  {{ openLabel }}
                </v-btn>
              </v-card-title>
              <v-divider />

              <div class="overlay-editor-dialog__preview-shell">
                <div
                  class="overlay-editor-dialog__preview-frame"
                  :style="previewFrameStyle"
                >
                  <iframe
                    v-if="useRenderedPreview"
                    :key="renderedPreviewUrl"
                    :src="renderedPreviewUrl"
                    class="overlay-editor-dialog__iframe"
                    allow="autoplay; fullscreen"
                  />

                  <iframe
                    v-else
                    :key="rawPreviewKey"
                    :srcdoc="rawPreviewHtml"
                    class="overlay-editor-dialog__iframe"
                    allow="autoplay; fullscreen"
                  />
                </div>
              </div>

              <v-alert
                v-if="previewMode === 'raw' && hasTemplateTags"
                type="warning"
                color="amber-darken-4"
                density="compact"
                class="ma-3 mt-0"
                :text="templateWarningLabel"
              />
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'
import {VueMonacoEditor} from "@guolao/vue-monaco-editor";

type FileEntry = {
  name?: string
  path?: string
  type?: 'file' | 'folder'
}

export default {
  name: 'OverlayEditorDialog',

  components: {
    VueMonacoEditor,
  },

  props: {
    modelValue: { type: Boolean, default: false },
    entry: { type: Object as () => FileEntry | null, default: null },
    readMethod: { type: String, default: 'overlays_read_text' },
    updateMethod: { type: String, default: 'overlays_update_text' },
    publicPrefix: { type: String, default: '' },
    title: { type: String, default: 'Overlay editor' },
    saveLabel: { type: String, default: 'Save' },
    codeLabel: { type: String, default: 'Code' },
    previewLabel: { type: String, default: 'Preview' },
    widthLabel: { type: String, default: 'Width' },
    heightLabel: { type: String, default: 'Height' },
    presetLabel: { type: String, default: 'Preset' },
    previewModeLabel: { type: String, default: 'Preview mode' },
    openLabel: { type: String, default: 'Open' },
    templateWarningLabel: {
      type: String,
      default: 'Raw preview does not expand <template path="..."> tags. Save and use rendered preview for the real overlay output.',
    },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      content: '',
      originalContent: '',
      loading: false,
      saving: false,
      errorMessage: '',
      previewWidth: 1920,
      previewHeight: 1080,
      previewPreset: '1080p',
      previewMode: 'rendered',
      cacheBust: Date.now(),
      rawPreviewKey: 0,
      previewPresets: [
        { title: '4K horizontal', value: '3840x2160', width: 3840, height: 2160 },
        { title: '1440p horizontal', value: '2560x1440', width: 2560, height: 1440 },
        { title: '1080p horizontal', value: '1920x1080', width: 1920, height: 1080 },
        { title: '1080p vertical', value: '1080x1920', width: 1080, height: 1920 },
        { title: '720p horizontal', value: '1280x720', width: 1280, height: 720 },
        { title: '720p vertical', value: '720x1280', width: 720, height: 1280 },
        { title: 'Custom', value: 'custom', width: null, height: null },
      ],
      previewModes: [
        { title: 'Rendered saved file', value: 'rendered' },
        { title: 'Raw unsaved HTML', value: 'raw' },
      ],
    }
  },

  computed: {
    ...mapState(useAppStore, ['getRestApi']),

    editorLanguage(): string {
      const ext = this.extension
      if (ext === 'html' || ext === 'htm') return 'html'
      if (ext === 'css') return 'css'
      if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'javascript'
      if (ext === 'ts') return 'typescript'
      if (ext === 'json') return 'json'
      if (ext === 'svg') return 'html'
      return 'plaintext'
    },

    editorOptions(): any {
      return {
        automaticLayout: true,
        minimap: {
          enabled: false,
        },
        fontSize: 14,
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        bracketPairColorization: {
          enabled: true,
        },
        readOnly: this.loading || this.saving,
      }
    },

    extension(): string {
      const name = String(this.entry?.name || this.entry?.path || '')
      const match = name.match(/\.([a-z0-9]+)$/i)
      return match ? match[1].toLowerCase() : ''
    },

    isHtmlFile(): boolean {
      return ['html', 'htm', 'svg'].includes(this.extension)
    },

    hasTemplateTags(): boolean {
      return /<template\b[^>]*\bpath=/i.test(this.content)
    },

    useRenderedPreview(): boolean {
      return this.previewMode === 'rendered' || !this.isHtmlFile
    },

    renderedPreviewUrl(): string {
      if (!this.entry?.path) return ''

      return `${this.getPublicUrl(this.entry.path)}?_=${this.cacheBust}`
    },

    rawPreviewHtml(): string {
      if (this.isHtmlFile) return this.content

      if (this.extension === 'css') {
        return `<!doctype html><html><head><style>${this.content}</style></head><body></body></html>`
      }

      if (this.extension === 'js' || this.extension === 'mjs' || this.extension === 'cjs') {
        const closingScript = `${'<'}\/script>`
        const safeContent = this.content.replace(new RegExp('</' + 'script', 'gi'), '<\\/script')

        return `<!doctype html><html><body><script>${safeContent}${closingScript}</body></html>`
      }

      return `<pre>${this.escapeHtml(this.content)}</pre>`
    },

    aspectRatioLabel(): string {
      const width = Number(this.previewWidth) || 1
      const height = Number(this.previewHeight) || 1
      const gcd = this.gcd(width, height)

      return `${Math.round(width / gcd)}:${Math.round(height / gcd)}`
    },

    previewFrameStyle(): Record<string, string> {
      const width = Math.max(1, Number(this.previewWidth) || 1920)
      const height = Math.max(1, Number(this.previewHeight) || 1080)

      return {
        aspectRatio: `${width} / ${height}`,
      }
    },
  },

  watch: {
    async modelValue(value: boolean) {
      if (value) await this.loadFile()
    },

    entry: {
      async handler() {
        if (this.modelValue) await this.loadFile()
      },
    },

    content() {
      this.rawPreviewKey += 1
    },

    previewWidth() {
      this.previewPreset = 'custom'
    },

    previewHeight() {
      this.previewPreset = 'custom'
    },
  },

  methods: {
    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      return new Promise((resolve, reject) => {
        eventBus.$emit('websocket:request', { method, params, timeout, resolve, reject })
      })
    },

    async loadFile() {
      if (!this.entry?.path) return

      this.loading = true
      this.errorMessage = ''

      try {
        const response = await this.requestWebsocket(this.readMethod, { path: this.entry.path })
        const data = response?.data ?? response

        if (data?.error) throw new Error(data.error)

        this.content = String(data?.content ?? '')
        this.originalContent = this.content
        this.cacheBust = Date.now()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'loading overlay failed'
        console.error('loading overlay failed', error)
      } finally {
        this.loading = false
      }
    },

    async saveFile() {
      if (!this.entry?.path) return

      this.saving = true
      this.errorMessage = ''

      try {
        const response = await this.requestWebsocket(this.updateMethod, {
          path: this.entry.path,
          content: this.content,
        }, 60_000)
        const data = response?.data ?? response

        if (data?.error) throw new Error(data.error)

        this.originalContent = this.content
        this.cacheBust = Date.now()
        this.$emit('saved', data)
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'saving overlay failed'
        console.error('saving overlay failed', error)
      } finally {
        this.saving = false
      }
    },

    applyPreviewPreset(value: string) {
      const preset = this.previewPresets.find((item: any) => item.value === value)
      if (!preset || !preset.width || !preset.height) return

      this.previewWidth = preset.width
      this.previewHeight = preset.height
    },

    getPublicUrl(value: string): string {
      const normalized = this.normalizePath(value)
      const prefix = this.normalizePath(this.publicPrefix)
      const joined = [prefix, normalized].filter(Boolean).join('/')
      const encoded = joined
        .split('/')
        .map(part => encodeURIComponent(part))
        .join('/')

      return `${this.getRestApi}/${encoded}`
    },

    normalizePath(value: any): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },

    gcd(a: number, b: number): number {
      return b === 0 ? a : this.gcd(b, a % b)
    },

    escapeHtml(value: string): string {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    },
  },
}
</script>

<style scoped>
.overlay-editor-dialog {
  height: 100vh;
}

.overlay-editor-dialog__body {
  height: calc(100vh - 48px);
  overflow: hidden;
}

.overlay-editor-dialog__workspace {
  height: calc(100% - 72px);
}

.overlay-editor-dialog__pane {
  min-height: 0;
}

.overlay-editor-dialog__code {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  background: #1e1e1e;
}

.overlay-editor-dialog__preview-shell {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  display: grid;
  place-items: center;
  background:
    linear-gradient(45deg, rgba(255,255,255,.08) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,.08) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,.08) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,.08) 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}

.overlay-editor-dialog__preview-frame {
  width: min(100%, 900px);
  max-height: 100%;
  background: transparent;
  box-shadow: 0 0 0 1px rgba(255,255,255,.22), 0 12px 42px rgba(0,0,0,.38);
}

.overlay-editor-dialog__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
}

.min-width-0 {
  min-width: 0;
}

@media (max-width: 1280px) {
  .overlay-editor-dialog__body {
    overflow: auto;
  }

  .overlay-editor-dialog__workspace {
    height: auto;
  }

  .overlay-editor-dialog__pane {
    min-height: 520px;
  }
}
</style>
