<template>
  <MacroTaskAccordionTemplate
    class="macro-loop-control-task-accordion"
    :item="item"
    :index="index"
    :icon="icon"
    :title="title"
    export-prefix="macro_loop_control"
    color="primary"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      density="comfortable"
      variant="tonal"
      color="warning"
    >{{ $t('macro.core.loopControl.variable') }}</v-alert>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroLoopControlTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      return (this.item as any).task
    },

    title(): string {
      return this.task?.method === 'continue' ? 'Continue loop' : 'Break loop'
    },

    icon(): string {
      return this.task?.method === 'continue'
        ? 'mdi-skip-next-outline'
        : 'mdi-stop-circle-outline'
    },

    description(): string {
      return this.task?.method === 'continue'
        ? 'Skips the rest of the current loop iteration and continues with the next value.'
        : 'Stops the nearest active loop.'
    },
  },
}
</script>
