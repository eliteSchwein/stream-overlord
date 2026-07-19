<template>
  <MacroTaskAccordionTemplate
    class="macro-system-reboot-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-restart"
    :title="$t('macro.system.reboot.title')"
    export-prefix="macro_system_reboot"
    color="primary"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="warning"
      variant="tonal"
      density="comfortable"
      :text="$t('macro.system.reboot.info')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroSystemRebootTaskAccordion',

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
    this.task.method = 'reboot'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}
  },
}
</script>
