<template>
  <v-dialog
    :model-value="modelValue"
    max-width="460"
    @update:model-value="updateModelValue"
  >
    <v-card color="grey-darken-4">
      <v-toolbar
        flat
        density="compact"
      >
        <v-toolbar-title class="d-flex align-center">
          {{ $t('assets.createFolder') }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)"></v-btn>
      </v-toolbar>

      <v-card-text>
        <v-text-field
          v-model="folderName"
          :label="$t('file.folder')"
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
          @click="close"
        >
          {{ $t('common.cancel') }}
        </v-btn>

        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          @click="submit"
        >
          {{ $t('assets.createFolder') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
export default {
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
    updateModelValue(value: boolean) {
      this.$emit('update:modelValue', value)
    },

    close() {
      this.$emit('update:modelValue', false)
    },

    submit() {
      if (this.loading) return

      this.$emit('create', this.folderName)
    },
  },
}
</script>
