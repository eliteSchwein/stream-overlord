<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar color="warning" flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ $t('channelPoints.deleteConfirmTitle') }}
        </v-toolbar-title>

        <v-btn
          icon="mdi-close"
          :disabled="loading"
          @click="$emit('update:modelValue', false)"
        />
      </v-toolbar>

      <v-card-text>
        <div class="mb-2">
          {{ $t('channelPoints.deleteConfirmText') }}
        </div>

        <v-card color="grey-darken-3" variant="flat" class="pa-3">
          <div class="d-flex align-center ga-3 min-width-0">
            <v-avatar
              size="40"
              :color="avatarColor"
              rounded="lg"
              class="pa-1"
            >
              <v-img
                v-if="channelPoint?.image"
                :src="channelPoint.image"
                cover
              />

              <v-icon
                v-else
                icon="mdi-star-circle"
                size="20"
              />
            </v-avatar>

            <div class="min-width-0">
              <div
                class="text-truncate"
                :title="displayName"
              >
                {{ displayName }}
              </div>

              <div
                v-if="internalName && internalName !== displayName"
                class="text-caption text-grey-lighten-1 text-truncate"
                :title="internalName"
              >
                {{ internalName }}
              </div>
            </div>
          </div>
        </v-card>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          variant="text"
          :disabled="loading"
          @click="$emit('update:modelValue', false)"
        >
          {{ $t('common.cancel') }}
        </v-btn>

        <v-btn
          color="warning"
          variant="flat"
          :loading="loading"
          @click="$emit('confirm')"
        >
          {{ $t('common.delete') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
export default {
  name: 'ChannelPointDeleteConfirmDialog',

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    channelPoint: {
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
    displayName(): string {
      return String(this.channelPoint?.label ?? this.channelPoint?.name ?? '')
    },

    internalName(): string {
      return String(this.channelPoint?.name ?? '')
    },

    avatarColor(): string {
      const color = String(this.channelPoint?.background ?? '').trim()
      return color || 'grey-darken-3'
    },
  },
}
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}
</style>
