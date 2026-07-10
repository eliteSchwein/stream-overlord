<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-lock-outline"
    title="Lock prediction"
    export-prefix="macro_twitch_prediction_lock"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field v-model="task.data.prediction_id" variant="outlined" label="Prediction ID" placeholder="${prediction.id} or {{variable}}" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchPredictionLockTaskAccordion',
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
    this.task.channel = 'twitch'
    this.task.method = 'prediction'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.action = 'lock'
    this.task.data.prediction_id ??= ''
  },
}
</script>
