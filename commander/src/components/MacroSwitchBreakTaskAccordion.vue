<template>
  <MacroTaskAccordionTemplate
    class="macro-switch-break-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-stop-circle-outline"
    :title="$t('macro.core.switch.breakTitle')"
    export-prefix="macro_switch_break"
    color="primary"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert density="comfortable" variant="tonal" color="warning">
      {{ $t('macro.core.switch.breakInfo') }}
    </v-alert>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroSwitchBreakTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  created() {
    const task = (this.item as any).task
    task.channel = 'switch'
    task.method = 'break'
  },
}
</script>
