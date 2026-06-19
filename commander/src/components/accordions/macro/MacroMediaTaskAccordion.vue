<template>
  <v-expansion-panel class="macro-media-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-image-play-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">Show media: {{ mediaData.path || 'empty path' }}</span>
        <v-spacer />
        <v-chip size="x-small" color="cyan" variant="tonal">media</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <MacroAssetSelect
        v-model="mediaData.path"
        label="Media path"
        class="mb-3"
      />

      <v-textarea
        v-model="optionsText"
        label="Options JSON"
        density="comfortable"
        variant="outlined"
        rows="3"
        auto-grow
        hide-details
      />

      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-spacer />
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import MacroAssetSelect from './MacroAssetSelect.vue'

export default {
  name: 'MacroMediaTaskAccordion',

  components: { MacroAssetSelect },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    mediaData(): any {
      const task = (this.item as any).task
      task.method = 'show_media'
      if (!task.data || typeof task.data !== 'object') task.data = {}
      if (!task.data.options || typeof task.data.options !== 'object') task.data.options = {}
      return task.data
    },

    optionsText: {
      get(): string {
        return JSON.stringify((this.mediaData as any).options ?? {}, null, 2)
      },
      set(value: string) {
        try {
          ;(this.mediaData as any).options = value.trim() ? JSON.parse(value) : {}
        } catch (error) {
          ;(this.mediaData as any).options = value
        }
      },
    },
  },
}
</script>
