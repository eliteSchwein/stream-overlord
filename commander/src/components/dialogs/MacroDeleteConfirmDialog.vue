<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar color="warning" flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ $t('macro.deleteConfirmTitle') || 'Delete macro?' }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text>
        <div class="mb-2">
          {{ $t('macro.deleteConfirmText') || 'Do you really want to delete this macro?' }}
        </div>

        <v-card color="grey-darken-3" variant="flat" class="pa-3">
          <div class="d-flex align-center ga-2 min-width-0 mb-3">
            <v-icon icon="mdi-code-braces" />
            <div class="text-truncate" :title="name">
              {{ name }}
            </div>
          </div>

          <div class="text-caption text-grey-lighten-1 mb-1">
            {{ taskCount }} tasks · {{ apiCount }} APIs
          </div>

          <v-chip
            v-for="api in macro?.apis || []"
            :key="api"
            size="x-small"
            class="mr-1 mb-1"
            variant="tonal"
          >
            {{ api }}
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
  name: 'MacroDeleteConfirmDialog',

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
  },

  emits: ['update:modelValue', 'confirm'],

  computed: {
    taskCount(): number {
      return Array.isArray(this.macro?.tasks) ? this.macro.tasks.length : 0
    },

    apiCount(): number {
      return Array.isArray(this.macro?.apis) ? this.macro.apis.length : 0
    },
  },
}
</script>
