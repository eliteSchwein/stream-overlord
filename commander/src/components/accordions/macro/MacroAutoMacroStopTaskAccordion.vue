<template>
  <MacroTaskAccordionTemplate
    class="macro-auto-macro-stop-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-stop-circle-outline"
    :title="$t('macro.core.autoMacroStop.stopAutoMacro')"
    export-prefix="macro_auto_macro_stop"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <AutoMacroSelect v-model="data.name" :label="$t('macro.core.autoMacroStop.autoMacro')" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'
import AutoMacroSelect from './AutoMacroSelect.vue'

export default {
  name: 'MacroAutoMacroStopTaskAccordion',

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
      task.method = 'stop'
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
