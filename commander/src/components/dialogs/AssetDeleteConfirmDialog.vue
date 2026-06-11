<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="updateModelValue"
  >
    <v-card color="grey-darken-4">
      <v-toolbar
        color="warning"
        flat
        density="compact"
      >
        <v-toolbar-title class="d-flex align-center">
          {{ $t('assets.deleteConfirmTitle') }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="close"></v-btn>
      </v-toolbar>

      <v-card-text>
        <div class="mb-2">
          {{ $t('assets.deleteConfirmText') }}
        </div>

        <v-card color="grey-darken-3" variant="flat" class="pa-3">
          <div class="d-flex align-center ga-2 min-width-0 mb-3">
            <v-icon :icon="asset?.type === 'folder' ? 'mdi-folder' : 'mdi-file'" />
            <div class="text-truncate" :title="asset?.path || asset?.name">
              {{ asset?.path || asset?.name }}
            </div>
          </div>

          <AssetPreview
            v-if="asset"
            :asset="asset"
            :rest-api="restApi"
            variant="compact"
            :controls="true"
            :autoplay="false"
            :muted="true"
            :show-label="asset?.type !== 'folder'"
          />
        </v-card>
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
          color="warning"
          variant="flat"
          :loading="loading"
          @click="confirm"
        >
          {{ $t('file.delete') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import AssetPreview from '@/components/AssetPreview.vue'

export default {
  components: {
    AssetPreview,
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    asset: {
      type: Object,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    restApi: {
      type: String,
      required: true,
    },
  },

  emits: ['update:modelValue', 'confirm'],

  methods: {
    updateModelValue(value: boolean) {
      this.$emit('update:modelValue', value)
    },

    close() {
      if (this.loading) return
      this.$emit('update:modelValue', false)
    },

    confirm() {
      if (this.loading) return
      this.$emit('confirm')
    },
  },
}
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}
</style>
