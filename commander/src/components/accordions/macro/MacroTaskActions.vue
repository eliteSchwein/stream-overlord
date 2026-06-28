<template>
  <div class="d-flex justify-end ga-2 mt-2">
    <v-btn variant="text" prepend-icon="mdi-export" @click="exportTask">
      Export
    </v-btn>

    <v-btn variant="text" prepend-icon="mdi-import" @click="openImport">
      Import
    </v-btn>

    <input
      ref="fileInput"
      class="d-none"
      type="file"
      accept=".yaml,.yml,text/yaml,application/x-yaml,text/plain"
      @change="importTask"
    >

    <v-btn variant="text" color="error" @click="$emit('remove')">
      <v-icon icon="mdi-delete" />
    </v-btn>
  </div>
</template>

<script lang="ts">
import YAML from 'yaml'

export default {
  name: 'MacroTaskActions',

  props: {
    task: { type: Object, required: true },
    filename: { type: String, default: 'macro_task.yaml' },
  },

  emits: ['remove', 'error'],

  methods: {
    exportTask() {
      const yaml = YAML.stringify(this.task)
      const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' })
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

    async importTask(event: Event) {
      const input = event.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return

      try {
        const parsed = YAML.parse(await file.text())
        const importedTask = parsed?.task ?? parsed

        if (!importedTask || typeof importedTask !== 'object' || Array.isArray(importedTask)) {
          throw new Error('invalid macro task yaml')
        }

        Object.assign(this.task, importedTask)
      } catch (error: any) {
        this.$emit('error', error)
      } finally {
        input.value = ''
      }
    },
  },
}
</script>
