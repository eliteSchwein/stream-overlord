<template>
  <MacroTaskAccordionTemplate
    class="macro-system-shutdown-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-power"
    :title="$t('macro.system.shutdown.title')"
    export-prefix="macro_system_shutdown"
    color="primary"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="warning"
      variant="tonal"
      density="comfortable"
      :text="$t('macro.system.shutdown.info')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroSystemShutdownTaskAccordion',

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
  },

  created() {
    this.task.channel = 'system'
    this.task.method = 'shutdown'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}
  },
}
</script>
