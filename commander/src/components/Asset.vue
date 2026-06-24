<script lang="ts">
export default {
  name: 'Asset',

  props: {
    asset: {
      type: Object,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    deleting: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['edit', 'delete'],

  computed: {
    setFields(): { key: string; label: string; value: any }[] {
      const fields = [
        ['message', this.$t('assets.message') || 'Message'],
        ['sound', this.$t('assets.sound') || 'Sound'],
        ['icon', this.$t('assets.icon') || 'Icon'],
        ['color', this.$t('assets.color') || 'Color'],
        ['channel', this.$t('assets.channel') || 'Channel'],
        ['duration', this.$t('assets.duration') || 'Duration'],
        ['volume', this.$t('assets.volume') || 'Volume'],
        ['image', this.$t('assets.image') || 'Image'],
        ['video', this.$t('assets.video') || 'Video'],
      ]

      return fields
        .filter(([key]) => this.isSet(this.asset?.[key as string]))
        .map(([key, label]) => ({ key: key as string, label, value: this.asset?.[key as string] }))
    },

    macroFields(): { key: string; label: string; values: string[] }[] {
      return [
        { key: 'start_macros', label: this.$t('assets.startMacros') || 'Start macros', values: this.asset?.start_macros ?? [] },
        { key: 'idle_macros', label: this.$t('assets.idleMacros') || 'Idle macros', values: this.asset?.idle_macros ?? [] },
        { key: 'end_macros', label: this.$t('assets.endMacros') || 'End macros', values: this.asset?.end_macros ?? [] },
      ].filter((entry) => Array.isArray(entry.values) && entry.values.length > 0)
    },

    wledControls(): { name: string; text: string }[] {
      const wled = this.asset?.wled
      if (!wled || typeof wled !== 'object') return []

      return Object.entries(wled)
        .map(([name, control]) => ({ name, text: this.formatWledControl(control) }))
        .filter((entry) => entry.text !== '')
    },

    hasDetails(): boolean {
      return this.setFields.length > 0 || this.macroFields.length > 0 || this.wledControls.length > 0
    },
  },

  methods: {
    isSet(value: any): boolean {
      if (value === undefined || value === null) return false
      if (typeof value === 'string') return value.trim().length > 0
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') return Object.keys(value).length > 0
      return true
    },

    stringify(value: any): string {
      if (value === undefined || value === null) return ''
      if (typeof value === 'string') return value
      if (Array.isArray(value)) return value.join(', ')
      try { return JSON.stringify(value) } catch { return String(value) }
    },

    getAssetIcon(asset: any) {
      const rawIcon = typeof asset?.icon === 'object' && asset?.icon !== null
        ? (asset.icon.raw ?? asset.icon.title ?? asset.icon.value ?? '')
        : asset?.icon
      const icon = String(rawIcon ?? '')
        .trim()
        .replace(/^mdi:/, '')
        .replace(/^mdi-/, '')

      if (!icon) return 'mdi-palette'
      return `mdi-${icon}`
    },

    getAssetColor(asset: any) {
      const color = String(asset?.color ?? '').trim().replace(/^#/, '')
      return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : 'primary'
    },

    formatWledControl(control: any): string {
      if (typeof control === 'string') return control
      if (!control || typeof control !== 'object') return ''

      return ['red', 'green', 'blue', 'white', 'effect']
        .filter((key) => this.isSet(control[key]))
        .map((key) => `${key}=${control[key]}`)
        .join(', ')
    },
  },
}
</script>

<template>
  <v-expansion-panel class="asset-panel" bg-color="grey-darken-4">
    <template #title>
      <div class="asset-panel__title">
        <v-avatar size="34" :color="getAssetColor(asset)" rounded="lg">
          <v-icon :icon="getAssetIcon(asset)" size="20" />
        </v-avatar>

        <div class="asset-panel__name-wrap min-width-0">
          <span class="asset-panel__name text-truncate" :title="name">
            {{ name }}
          </span>
        </div>

        <v-spacer />
      </div>
    </template>

    <v-expansion-panel-text class="asset-panel__content pa-0">
      <div class="asset-panel__details px-4 pt-3 pb-3">
        <v-spacer />

        <div class="asset-panel__actions">
          <v-btn
            prepend-icon="mdi-pencil"
            size="small"
            variant="tonal"
            color="primary"
            :disabled="disabled"
            @click="$emit('edit', name, asset)"
          >
            {{ $t('common.edit') || 'Edit' }}
          </v-btn>

          <v-btn
            prepend-icon="mdi-delete"
            size="small"
            variant="tonal"
            color="red"
            :loading="deleting"
            :disabled="disabled"
            @click="$emit('delete', name, asset)"
          >
            {{ $t('common.delete') || 'Delete' }}
          </v-btn>
        </div>
      </div>

      <div v-if="!hasDetails" class="px-4 pb-4 text-caption text-grey-lighten-1">
        {{ $t('assets.noValuesSet') || 'No values set' }}
      </div>

      <v-table v-if="setFields.length" density="compact" class="asset-panel__table">
        <tbody>
          <tr v-for="field in setFields" :key="field.key">
            <td class="asset-panel__field-label">{{ field.label }}</td>
            <td class="asset-panel__field-value">{{ stringify(field.value) }}</td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="macroFields.length" class="px-4 py-3 d-flex flex-wrap ga-1">
        <template v-for="field in macroFields" :key="field.key">
          <v-chip
            v-for="macro in field.values"
            :key="`${field.key}-${macro}`"
            size="x-small"
            variant="tonal"
            prepend-icon="mdi-flash"
          >
            {{ field.label }}: {{ macro }}
          </v-chip>
        </template>
      </div>

      <div v-if="wledControls.length" class="px-4 pb-3 d-flex flex-wrap ga-1">
        <v-chip
          v-for="control in wledControls"
          :key="control.name"
          size="x-small"
          variant="tonal"
          prepend-icon="mdi-led-strip-variant"
        >
          {{ control.name }}: {{ control.text }}
        </v-chip>
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<style scoped lang="scss">
.asset-panel {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.asset-panel__title {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  gap: 10px;
}

.asset-panel__name-wrap {
  display: flex;
  flex-direction: column;
  min-width: 120px;
}

.asset-panel__name {
  display: block;
}

.asset-panel__meta {
  align-items: center;
  gap: 6px;
}

.asset-panel__details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.asset-panel__details-text {
  flex: 1 1 auto;
}

.asset-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.asset-panel__table {
  background: transparent;
}

.asset-panel__field-label {
  width: 180px;
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.asset-panel__field-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.78rem;
  word-break: break-word;
}

.min-width-0 {
  min-width: 0;
}

@media (max-width: 600px) {
  .asset-panel__details {
    align-items: stretch;
    flex-direction: column;
  }

  .asset-panel__actions {
    justify-content: flex-end;
  }
}
</style>
