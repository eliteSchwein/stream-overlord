<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar color="warning" flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          Delete rotating scene?
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text>
        <div class="mb-2">
          Do you really want to delete this rotating scene?
        </div>

        <v-card color="grey-darken-3" variant="flat" class="pa-3">
          <div class="d-flex align-center ga-2 min-width-0 mb-3">
            <v-icon icon="mdi-sync" />
            <div class="text-truncate" :title="name">
              {{ name }}
            </div>
          </div>

          <div class="text-caption text-grey-lighten-1 mb-2">
            {{ sceneCount }} scenes · every {{ intervalLabel }}
          </div>

          <v-chip
            v-for="scene in sceneLabels"
            :key="scene.key"
            size="x-small"
            class="mr-1 mb-1"
            variant="tonal"
            prepend-icon="mdi-video-switch"
          >
            {{ scene.label }}
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
          Cancel
        </v-btn>

        <v-btn
          color="warning"
          variant="flat"
          :loading="loading"
          @click="$emit('confirm')"
        >
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
export default {
  name: 'RotatingSceneDeleteConfirmDialog',

  props: {
    modelValue: { type: Boolean, default: false },
    name: { type: String, default: '' },
    rotatingScene: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'confirm'],

  computed: {
    scenes(): any[] {
      return Array.isArray(this.rotatingScene?.scenes) ? this.rotatingScene.scenes : []
    },

    sceneCount(): number {
      return this.scenes.length
    },

    sceneLabels(): any[] {
      return this.scenes.map((scene: any, index: number) => {
        if (typeof scene === 'string') return { key: `${scene}-${index}`, label: scene }

        const sceneName = String(scene?.sceneName ?? scene?.name ?? scene?.sceneUuid ?? scene?.uuid ?? '')
        const canvasName = String(scene?.canvasName ?? '')

        return {
          key: `${scene?.sceneUuid ?? scene?.uuid ?? sceneName}-${index}`,
          label: canvasName ? `${canvasName} / ${sceneName}` : sceneName,
        }
      })
    },

    intervalLabel(): string {
      return this.formatDuration(Number(this.rotatingScene?.interval ?? 0) * 60)
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
