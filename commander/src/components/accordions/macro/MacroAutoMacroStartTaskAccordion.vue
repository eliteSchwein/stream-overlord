<template>
  <MacroTaskAccordionTemplate
    class="macro-auto-macro-start-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-play-circle-outline"
    title="Start auto macro"
    export-prefix="macro_auto_macro_start"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <AutoMacroSelect v-model="data.name" label="Auto macro" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'
import AutoMacroSelect from './AutoMacroSelect.vue'

export default {
  name: 'MacroAutoMacroStartTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
    AutoMacroSelect,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'auto_macro'
      task.method = 'start'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.name === undefined) task.data.name = task.data.autoMacro ?? ''
      delete task.data.autoMacro

      return task
    },

    data(): any {
      return this.task.data
    },
  },

  created() {
    this.task
  },
}
</script>
