<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-refresh"
    :title="$t('macro.music.reload.title')"
    export-prefix="macro_music_reload"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-switch
      v-model="task.data.restore_state"
      :label="$t('macro.music.fields.restoreState')"
      color="primary"
      hide-details
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicReloadTaskAccordion',
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
    this.task.method = 'reload'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.restore_state ??= false
  },
}
</script>
