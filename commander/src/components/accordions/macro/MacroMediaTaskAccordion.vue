<template>
  <MacroTaskAccordionTemplate
    class="macro-media-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-image-play-outline"
    :title="'Show media: ' + (mediaData.path || 'empty path')"
    export-prefix="macro_media"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
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
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroAssetSelect from './MacroAssetSelect.vue'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMediaTaskAccordion',

  components: {
    MacroAssetSelect,
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    mediaData(): any {
      const task = (this.item as any).task

      task.channel = 'media'
      task.method = 'show_media'

      if (!task.data || typeof task.data !== 'object') {
        task.data = {}
      }

      if (!task.data.options || typeof task.data.options !== 'object') {
        task.data.options = {}
      }

      return task.data
    },

    optionsText: {
      get(): string {
        return JSON.stringify(this.mediaData.options ?? {}, null, 2)
      },

      set(value: string) {
        try {
          this.mediaData.options = value.trim() ? JSON.parse(value) : {}
        } catch (error) {
          this.mediaData.options = value
        }
      },
    },
  },
}
</script>
