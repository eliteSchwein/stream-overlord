<template>
  <MacroTaskAccordionTemplate
    class="macro-end-macro-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-stop-circle-outline"
    :title="$t('macro.core.endMacro.endMacro')"
    export-prefix="macro_end_macro"
    color="primary"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      color="warning"
      density="comfortable"
      variant="tonal"
      :text="$t('macro.core.endMacro.stopsTheCurrentMacroHereWhenThisTaskIsReached')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroEndMacroTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  created() {
    const task = (this.item as any).task

    task.channel = 'condition'
    task.method = 'end_macro'

    delete task.check
    delete task.data
  },
}
</script>
