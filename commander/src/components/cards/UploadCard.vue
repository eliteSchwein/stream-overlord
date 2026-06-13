<template>
  <v-card
    color="grey-darken-3"
    variant="flat"
    class="upload-card h-100"
    :class="{ 'upload-card--dragging': dragging }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <v-card-text class="pa-3 d-flex align-center h-100">
      <v-file-input
        :key="inputKey"
        v-model="model"
        :label="label"
        :accept="accept"
        :prepend-icon="icon"
        multiple
        variant="outlined"
        density="compact"
        hide-details
        class="upload-card__input"
        :disabled="disabled || loading"
        :loading="loading"
        @update:model-value="emitFiles"
      />

      <div v-if="dragging" class="upload-card__drop">
        <v-icon :icon="icon" size="42" />
        <div class="text-subtitle-2 mt-2">{{ dropLabel }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
export default {
  props: {
    label: {
      type: String,
      required: true,
    },
    dropLabel: {
      type: String,
      default: 'Drop files here',
    },
    icon: {
      type: String,
      default: 'mdi-upload',
    },
    accept: {
      type: String,
      default: '',
    },
    loading: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['upload'],

  data() {
    return {
      model: [] as File[],
      inputKey: 0,
      dragging: false,
      dragDepth: 0,
    }
  },

  methods: {
    reset() {
      this.model = []
      this.inputKey += 1
      this.dragging = false
      this.dragDepth = 0
    },

    emitFiles(value: File | File[] | null) {
      const files = Array.isArray(value)
        ? value
        : value
          ? [value]
          : []

      if (!files.length) return

      this.$emit('upload', files)
    },

    onDragEnter(event: DragEvent) {
      if (this.disabled || this.loading) return
      if (!this.hasFiles(event)) return

      this.dragDepth += 1
      this.dragging = true
    },

    onDragOver(event: DragEvent) {
      if (this.disabled || this.loading) return
      if (!this.hasFiles(event)) return

      this.dragging = true
    },

    onDragLeave() {
      this.dragDepth = Math.max(0, this.dragDepth - 1)

      if (this.dragDepth === 0) {
        this.dragging = false
      }
    },

    onDrop(event: DragEvent) {
      if (this.disabled || this.loading) return

      const files = Array.from(event.dataTransfer?.files ?? [])

      this.reset()

      if (!files.length) return

      this.$emit('upload', files)
    },

    hasFiles(event: DragEvent): boolean {
      return Array.from(event.dataTransfer?.types ?? []).includes('Files')
    },
  },
}
</script>

<style scoped>
.upload-card {
  position: relative;
  min-height: 116px;
}

.upload-card__input {
  width: 100%;
}

.upload-card__drop {
  position: absolute;
  inset: 8px;
  border: 2px dashed rgba(255, 255, 255, 0.45);
  border-radius: 10px;
  background: rgba(33, 33, 33, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  pointer-events: none;
  z-index: 2;
}

.upload-card--dragging {
  outline: 2px solid rgb(var(--v-theme-primary));
}
</style>
