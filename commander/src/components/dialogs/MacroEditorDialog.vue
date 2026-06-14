<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4" class="macro-editor-dialog">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-pencil" class="mr-2" />
          <span class="text-truncate">{{ name }}</span>
        </v-toolbar-title>

        <v-btn
          icon="mdi-refresh"
          variant="text"
          :loading="loadingFile"
          @click="loadMacro"
        />

        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-content-save"
          :loading="saving"
          :disabled="!name || loadingFile"
          @click="saveMacro"
        >
          {{ $t('common.save') || 'Save' }}
        </v-btn>

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text class="pa-3 macro-editor-dialog__body">
        <v-alert
          v-if="errorMessage"
          type="error"
          color="red-darken-3"
          density="compact"
          class="mb-3"
          :text="errorMessage"
        />

        <v-card color="grey-darken-3" variant="flat" class="h-100 d-flex flex-column">
          <v-card-title class="py-2 d-flex align-center justify-space-between">
            <span class="text-subtitle-2">{{ $t('macro.editor') || 'Macro editor' }}</span>
            <v-chip size="small" variant="tonal">yaml</v-chip>
          </v-card-title>

          <v-divider />

          <div class="macro-editor-dialog__code">
            <vue-monaco-editor
              v-model:value="content"
              language="yaml"
              theme="vs-dark"
              height="100%"
              :options="editorOptions"
            />
          </div>
        </v-card>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import eventBus from '@/eventBus'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'

export default {
  name: 'MacroEditorDialog',

  components: {
    VueMonacoEditor,
  },

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      default: '',
    },
    macro: {
      type: Object,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    filePath: {
      type: String,
      default: '',
    },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      content: '',
      loadingFile: false,
      saving: false,
      errorMessage: '',
      editorOptions: {
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
      },
    }
  },

  watch: {
    modelValue(value: boolean) {
      if (value) {
        this.loadMacro()
      }
    },

    name() {
      if (this.modelValue) {
        this.loadMacro()
      }
    },
  },

  methods: {
    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
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

    async loadMacro() {
      if (!this.name) return

      this.loadingFile = true
      this.errorMessage = ''

      try {
        const response = await this.requestWebsocket('macro_read', {
          name: this.name,
          path: this.filePath || undefined,
          file: this.filePath || undefined,
        })

        const data = response?.data ?? response

        if (data?.error) throw new Error(data.error)

        this.content = String(data?.content ?? this.macroToYaml(this.name, this.macro))
      } catch (error: any) {
        this.content = this.macroToYaml(this.name, this.macro)
        this.errorMessage = error?.message ?? ''
      } finally {
        this.loadingFile = false
      }
    },

    async saveMacro() {
      if (!this.name) return

      this.saving = true
      this.errorMessage = ''

      try {
        const response = await this.requestWebsocket('macro_edit', {
          name: this.name,
          path: this.filePath || undefined,
          file: this.filePath || undefined,
          content: this.content,
        })

        const data = response?.data ?? response

        if (data?.error) throw new Error(data.error)

        this.$emit('saved')
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'saving macro failed'
      } finally {
        this.saving = false
      }
    },

    macroToYaml(name: string, macro: any): string {
      const lines = [`name: ${this.scalarToYaml(name)}`]

      if (Array.isArray(macro?.apis) && macro.apis.length > 0) {
        lines.push('apis:')
        macro.apis.forEach((api: any) => lines.push(`  - ${this.scalarToYaml(api)}`))
      } else {
        lines.push('apis: []')
      }

      lines.push('tasks:')

      if (Array.isArray(macro?.tasks) && macro.tasks.length > 0) {
        macro.tasks.forEach((task: any) => {
          lines.push(`  - ${this.objectToInlineYaml(task)}`)
        })
      } else {
        lines.push('  []')
      }

      return `${lines.join('\n')}\n`
    },

    scalarToYaml(value: any): string {
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      const stringValue = String(value ?? '')

      if (/^[a-zA-Z0-9_.-]+$/.test(stringValue)) return stringValue

      return JSON.stringify(stringValue)
    },

    objectToInlineYaml(value: any): string {
      if (Array.isArray(value)) {
        return `[${value.map((item) => this.objectToInlineYaml(item)).join(', ')}]`
      }

      if (value && typeof value === 'object') {
        return `{${Object.entries(value)
          .map(([key, item]) => `${key}: ${this.objectToInlineYaml(item)}`)
          .join(', ')}}`
      }

      return this.scalarToYaml(value)
    },
  },
}
</script>

<style scoped>
.macro-editor-dialog__body {
  height: calc(100vh - 48px);
}

.macro-editor-dialog__code {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
</style>
