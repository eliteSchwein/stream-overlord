<template>
  <MacroTaskAccordionTemplate
    class="macro-wled-custom-task-accordion"
    :item="item"
    :index="index"
    :depth="depth"
    icon="mdi-led-strip-variant"
    title="WLED Custom"
    export-prefix="macro_wled_custom"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <MacroWledControlEditor
      v-model="task.data"
      @remove="$emit('remove')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'
import MacroWledControlEditor from '@/components/MacroWledControlEditor.vue'

export default {
  name: 'MacroWledCustomTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
    MacroWledControlEditor,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'wled'
      task.method = 'custom'
      task.data ??= {}

      return task
    },
  },
}
</script>
