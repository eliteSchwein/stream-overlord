<template>
  <div class="api-key-value-editor">
    <div class="text-subtitle-2 mb-2">{{ label }}</div>

    <div
      v-for="(entry, entryIndex) in entries"
      :key="entry.id"
      class="d-flex ga-2 mb-2 align-start"
    >
      <v-text-field
        :model-value="entry.key"
        :label="keyLabel"
        :placeholder="keyPlaceholder"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
        class="flex-grow-1"
        @update:model-value="updateEntry(entryIndex, 'key', $event)"
      />

      <v-text-field
        :model-value="entry.value"
        :label="valueLabel"
        :placeholder="valuePlaceholder"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
        class="flex-grow-1"
        @update:model-value="updateEntry(entryIndex, 'value', $event)"
      />

      <v-btn
        icon="mdi-delete-outline"
        variant="text"
        color="error"
        class="mt-1"
        :aria-label="`Remove ${label} row`"
        @click="removeEntry(entryIndex)"
      />
    </div>

    <div v-if="entries.length === 0" class="text-medium-emphasis text-body-2 mb-2">
      No {{ label.toLowerCase() }} configured.
    </div>

    <v-btn
      prepend-icon="mdi-plus"
      variant="tonal"
      size="small"
      @click="addEntry"
    >
      {{ addLabel }}
    </v-btn>
  </div>
</template>

<script lang="ts">
type KeyValueEntry = {
  id: number
  key: string
  value: string
}

let nextEntryId = 1

export default {
  name: 'MacroApiKeyValueEditor',
  props: {
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    label: {
      type: String,
      required: true,
    },
    addLabel: {
      type: String,
      default: 'Add field',
    },
    keyLabel: {
      type: String,
      default: 'Key',
    },
    valueLabel: {
      type: String,
      default: 'Value',
    },
    keyPlaceholder: {
      type: String,
      default: '',
    },
    valuePlaceholder: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      entries: [] as KeyValueEntry[],
      syncingFromModel: false,
    }
  },
  watch: {
    modelValue: {
      immediate: true,
      deep: true,
      handler(value: Record<string, any>) {
        if (this.syncingFromModel) return

        const normalized = value && typeof value === 'object' && !Array.isArray(value)
          ? value
          : {}

        this.entries = Object.entries(normalized).map(([key, entryValue]) => ({
          id: nextEntryId++,
          key,
          value: this.formatValue(entryValue),
        }))
      },
    },
  },
  methods: {
    formatValue(value: any): string {
      if (value === undefined || value === null) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    },
    emitValue() {
      const value: Record<string, string> = {}

      for (const entry of this.entries) {
        const key = entry.key.trim()
        if (!key) continue
        value[key] = entry.value
      }

      this.syncingFromModel = true
      this.$emit('update:modelValue', value)
      this.$nextTick(() => {
        this.syncingFromModel = false
      })
    },
    addEntry() {
      this.entries.push({
        id: nextEntryId++,
        key: '',
        value: '',
      })
    },
    removeEntry(index: number) {
      this.entries.splice(index, 1)
      this.emitValue()
    },
    updateEntry(index: number, field: 'key' | 'value', value: unknown) {
      const entry = this.entries[index]
      if (!entry) return

      entry[field] = value === undefined || value === null ? '' : String(value)
      this.emitValue()
    },
  },
}
</script>
