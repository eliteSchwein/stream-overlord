<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar color="warning" flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ $t('autoMacro.deleteConfirmTitle') || 'Delete auto macro?' }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text>
        <div class="mb-2">
          {{ $t('autoMacro.deleteConfirmText') || 'Do you really want to delete this auto macro?' }}
        </div>

        <v-card color="grey-darken-3" variant="flat" class="pa-3">
          <div class="d-flex align-center ga-2 min-width-0 mb-3">
            <v-icon icon="mdi-timer-cog" />
            <div class="text-truncate" :title="name">
              {{ name }}
            </div>
          </div>

          <div class="text-caption text-grey-lighten-1 mb-2">
            {{ macroCount }} macros · every {{ intervalLabel }}
          </div>

          <v-chip
            v-for="macro in autoMacro?.macros || []"
            :key="macro"
            size="x-small"
            class="mr-1 mb-1"
            variant="tonal"
            prepend-icon="mdi-code-braces"
          >
            {{ macro }}
          </v-chip>
        </v-card>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          variant="text"
          :disabled="loading"
          @click="$emit('update:modelValue', false)"
        >
          {{ $t('common.cancel') || 'Cancel' }}
        </v-btn>

        <v-btn
          color="warning"
          variant="flat"
          :loading="loading"
          @click="$emit('confirm')"
        >
          {{ $t('common.delete') || 'Delete' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
export default {
  name: 'AutoMacroDeleteConfirmDialog',

  props: {
    modelValue: { type: Boolean, default: false },
    name: { type: String, default: '' },
    autoMacro: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'confirm'],

  computed: {
    macroCount(): number {
      return Array.isArray(this.autoMacro?.macros) ? this.autoMacro.macros.length : 0
    },

    intervalLabel(): string {
      return this.formatDuration(Number(this.autoMacro?.interval ?? 0))
    },
  },

  methods: {
    formatDuration(totalSeconds: number) {
      const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0))
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60

      if (hours > 0) return `${hours}h ${remainingMinutes}m`
      if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
      return `${seconds}s`
    },
  },
}
</script>

<style scoped lang="scss">
.min-width-0 {
  min-width: 0;
}
</style>
