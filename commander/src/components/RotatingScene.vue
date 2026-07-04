<template>
  <v-card color="grey-darken-4" variant="flat" class="rotating-scene-card">
    <v-card-text class="py-3">
      <div class="d-flex align-center justify-space-between ga-3">
        <div class="d-flex align-center ga-3 min-width-0">
          <v-avatar color="grey-darken-3" size="40">
            <v-icon icon="mdi-filmstrip" />
          </v-avatar>

          <div class="min-width-0">
            <div class="text-subtitle-1 text-truncate" :title="rotatingSceneName">
              {{ rotatingSceneName }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ sceneCount }} scenes · every {{ intervalLabel }}
            </div>
          </div>
        </div>

        <div class="d-flex align-center ga-2 flex-shrink-0">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-pencil"
            @click="$emit('edit', rotatingScene)"
          >
            Edit
          </v-btn>

          <v-btn
            color="error"
            variant="tonal"
            prepend-icon="mdi-delete"
            @click="$emit('delete', rotatingScene)"
          >
            Delete
          </v-btn>
        </div>
      </div>

      <div v-if="sceneNames.length" class="d-flex flex-wrap ga-1 mt-3">
        <v-chip
          v-for="scene in sceneNames"
          :key="scene.key"
          size="x-small"
          variant="tonal"
          prepend-icon="mdi-video-switch"
        >
          {{ scene.label }}
        </v-chip>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  rotatingScene: any
}>()

defineEmits<{
  edit: [rotatingScene: any]
  delete: [rotatingScene: any]
}>()

const rotatingSceneName = computed(() => String(props.rotatingScene?.name ?? ''))

const sceneItems = computed(() => {
  const scenes = props.rotatingScene?.scenes
  return Array.isArray(scenes) ? scenes : []
})

const sceneCount = computed(() => sceneItems.value.length)

const sceneNames = computed(() => sceneItems.value.map((scene: any, index: number) => {
  if (typeof scene === 'string') {
    return { key: `${scene}-${index}`, label: scene }
  }

  const sceneName = String(scene?.sceneName ?? scene?.name ?? scene?.sceneUuid ?? scene?.uuid ?? '')
  const canvasName = String(scene?.canvasName ?? '')

  return {
    key: `${scene?.sceneUuid ?? scene?.uuid ?? sceneName}-${index}`,
    label: canvasName ? `${canvasName} / ${sceneName}` : sceneName,
  }
}))

const intervalLabel = computed(() => formatDuration(Number(props.rotatingScene?.interval ?? 0) * 60))

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours > 0) return `${hours}h ${remainingMinutes}m`
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
  return `${seconds}s`
}
</script>

<style scoped lang="scss">
.rotating-scene-card {
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.min-width-0 {
  min-width: 0;
}
</style>
