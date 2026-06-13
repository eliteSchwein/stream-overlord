<template>
  <v-dialog
    :model-value="modelValue"
    max-width="460"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ title }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text>
        <v-text-field
          v-model="folderName"
          :label="folderLabel"
          prepend-inner-icon="mdi-folder"
          variant="outlined"
          autofocus
          :disabled="loading"
          :error-messages="error"
          @keydown.enter.prevent="submit"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          variant="text"
          :disabled="loading"
          @click="$emit('update:modelValue', false)"
        >
          {{ cancelLabel }}
        </v-btn>

        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          @click="submit"
        >
          {{ submitLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
export default {
  name: 'FileCreateFolderDialog',

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: [String, Array],
      default: '',
    },
    title: {
      type: String,
      default: 'Create folder',
    },
    folderLabel: {
      type: String,
      default: 'Folder',
    },
    cancelLabel: {
      type: String,
      default: 'Cancel',
    },
    submitLabel: {
      type: String,
      default: 'Create folder',
    },
  },

  emits: ['update:modelValue', 'create'],

  data() {
    return {
      folderName: '',
    }
  },

  watch: {
    modelValue(value: boolean) {
      if (value) {
        this.folderName = ''
      }
    },
  },

  methods: {
    submit() {
      if (this.loading) return

      this.$emit('create', this.folderName)
    },
  },
}
</script>
