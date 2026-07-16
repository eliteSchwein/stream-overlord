<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-repeat-once"
    :title="$t('macro.music.loopFile.title')"
    export-prefix="macro_music_loop_file"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-select
      v-model="mode"
      :items="modes"
      item-title="title"
      item-value="value"
      :label="$t('macro.music.fields.action')"
      variant="outlined"
      density="comfortable"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicLoopFileTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
computed: {
    task(): any { return (this.item as any).task },
    mode: {
      get(): string {
        if (this.task.data.enabled === true) return 'enable'
        if (this.task.data.enabled === false) return 'disable'
        return 'toggle'
      },
      set(value: string) {
        if (value === 'toggle') {
          delete this.task.data.enabled
          return
        }
        this.task.data.enabled = value === 'enable'
      },
    },
  },
  created() {
    this.task.channel = 'music'
    this.task.method = 'loop_file'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
  },
}
</script>
