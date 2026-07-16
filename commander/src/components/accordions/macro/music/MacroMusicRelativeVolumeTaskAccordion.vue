<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-volume-plus"
    :title="$t('macro.music.relativeVolume.title')"
    export-prefix="macro_music_relative_volume"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field
      v-model.number="task.data.volume"
      :label="$t('macro.music.fields.volumeAdjustment')"
      type="number"
            suffix="%"
      :hint="$t('macro.music.fields.negativeVolumeHint')"
      persistent-hint
      variant="outlined"
      density="comfortable"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicRelativeVolumeTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    task(): any { return (this.item as any).task },
  },
  created() {
    this.task.channel = 'music'
    this.task.method = 'relative_volume'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.volume ??= 10
  },
}
</script>
