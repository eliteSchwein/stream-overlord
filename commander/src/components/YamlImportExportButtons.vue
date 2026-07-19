<template>
  <div class="d-flex justify-end ga-2">
    <v-btn
      variant="text"
      prepend-icon="mdi-export"
      :disabled="disabled"
      @click="exportYaml"
    >
      {{ $t('components.yamlImportExport.export') }}
    </v-btn>

    <v-btn
      variant="text"
      prepend-icon="mdi-import"
      :disabled="disabled"
      @click="openImport"
    >
      {{ $t('components.yamlImportExport.import') }}
    </v-btn>

    <input
      ref="fileInput"
      class="d-none"
      type="file"
      accept=".yaml,.yml,text/yaml,application/x-yaml,text/plain"
      @change="importYaml"
    >
  </div>
</template>

<script lang="ts">
import YAML from 'yaml'

export default {
  name: 'YamlImportExportButtons',

  props: {
    filename: { type: String, default: 'export.yaml' },
    disabled: { type: Boolean, default: false },
    exportData: { type: [Object, Array], default: null },
    exportContent: { type: String, default: '' },
  },

  emits: ['import', 'error'],

  methods: {
    exportYaml() {
      const content = this.exportContent || YAML.stringify(this.exportData ?? {})

      const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = this.filename
      link.click()

      URL.revokeObjectURL(url)
    },

    openImport() {
      ;(this.$refs.fileInput as HTMLInputElement | undefined)?.click()
    },

    async importYaml(event: Event) {
      const input = event.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return

      try {
        const content = await file.text()
        const data = YAML.parse(content)

        this.$emit('import', {
          data,
          content,
          file,
        })
      } catch (error: any) {
        this.$emit('error', error)
      } finally {
        input.value = ''
      }
    },
  },
}
</script>
