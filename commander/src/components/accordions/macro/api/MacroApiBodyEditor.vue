<template>
  <div>
    <v-card v-if="bodyType === 'json' || bodyType === 'raw'" variant="outlined" class="api-body-editor">
      <v-divider v-if="bodyType === 'json'" />

      <vue-monaco-editor
        v-model:value="editorValue"
        :language="editorLanguage"
        theme="vs-dark"
        height="260px"
        :options="editorOptions"
        @mount="handleEditorMount"
      />
    </v-card>

    <v-alert
      v-if="bodyType === 'json' && jsonError"
      type="error"
      density="compact"
      variant="tonal"
      class="mt-2"
      :text="jsonError"
    />

    <MacroApiKeyValueEditor
      v-else-if="bodyType === 'form' || bodyType === 'multipart'"
      v-model="formValue"
      :label="$t(bodyType === 'multipart' ? 'macro.api.multipartFormData' : 'macro.api.formData')"
      :add-label="$t(bodyType === 'multipart' ? 'macro.api.addMultipartField' : 'macro.api.addFormField')"
      :key-label="$t('macro.api.field')"
      :value-label="$t('macro.api.value')"
      :key-placeholder="$t('macro.api.placeholders.fieldName')"
      :value-placeholder="$t('macro.api.placeholders.templateValue')"
    />
  </div>
</template>

<script lang="ts">
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import MacroApiKeyValueEditor from './MacroApiKeyValueEditor.vue'

export default {
  name: 'MacroApiBodyEditor',
  components: {
    VueMonacoEditor,
    MacroApiKeyValueEditor,
  },
  props: {
    bodyType: { type: String, required: true },
    bodyData: { type: [String, Object, Array, Number, Boolean], default: '' },
    formData: { type: [String, Object, Array], default: () => ({}) },
  },
  emits: ['update:bodyData', 'update:formData'],
  data() {
    return {
      editor: null as any,
      editorValue: '',
      jsonError: '',
      syncingFromProp: false,
      editorOptions: {
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        folding: true,
        formatOnPaste: true,
        formatOnType: true,
      },
    }
  },
  computed: {
    editorLanguage(): string {
      return this.bodyType === 'json' ? 'json' : 'plaintext'
    },
    formValue: {
      get(): any {
        return this.formData
      },
      set(value: any) {
        this.$emit('update:formData', value)
      },
    },
  },
  watch: {
    bodyData: {
      immediate: true,
      deep: true,
      handler(value: any) {
        const nextValue = this.stringify(value)

        if (nextValue === this.editorValue) return

        this.syncingFromProp = true
        this.editorValue = nextValue
        this.$nextTick(() => {
          this.syncingFromProp = false
        })
      },
    },
    bodyType() {
      this.jsonError = ''
      this.editorValue = this.stringify(this.bodyData)
      this.validateAndEmit(this.editorValue)
    },
    editorValue(value: string) {
      if (this.syncingFromProp) return
      this.validateAndEmit(value)
    },
  },
  methods: {
    handleEditorMount(editor: any) {
      this.editor = editor
    },
    stringify(value: any): string {
      if (value === undefined || value === null || value === '') return ''
      if (typeof value === 'string') return value

      if (this.bodyType === 'json') {
        try {
          return JSON.stringify(value, null, 2)
        } catch {
          return String(value)
        }
      }

      return String(value)
    },
    validateAndEmit(value: string) {
      if (this.bodyType !== 'json') {
        this.jsonError = ''
        this.$emit('update:bodyData', value)
        return
      }

      if (!value.trim()) {
        this.jsonError = ''
        this.$emit('update:bodyData', '')
        return
      }

      try {
        const parsed = JSON.parse(value)
        this.jsonError = ''
        this.$emit('update:bodyData', parsed)
      } catch (error: any) {
        this.jsonError = error?.message
          ? this.$t('macro.api.invalidJsonWithReason', { reason: error.message })
          : this.$t('macro.api.invalidJson')
        this.$emit('update:bodyData', value)
      }
    },
  },
}
</script>

<style scoped>
.api-body-editor {
  overflow: hidden;
}
</style>
