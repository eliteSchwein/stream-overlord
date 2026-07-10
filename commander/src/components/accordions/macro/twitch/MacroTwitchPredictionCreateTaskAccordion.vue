<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-crystal-ball"
    title="Create prediction"
    export-prefix="macro_twitch_prediction_create"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-text-field v-model="task.data.title" variant="outlined" label="Title" />
      </v-col>
      <v-col cols="12">
        <v-textarea v-model="task.data.outcomes" variant="outlined" label="Outcomes" hint="One outcome per line" persistent-hint rows="4" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model.number="task.data.duration" variant="outlined" type="number" min="30" max="1800" label="Lock after (seconds)" />
      </v-col>
      <v-col cols="12" md="6">
    <v-text-field
      v-model="task.data.variable"
      variant="outlined"
      label="Result variable"
      placeholder="prediction"
      hint="The created prediction is available as ${prediction}"
      persistent-hint
    />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchPredictionCreateTaskAccordion',
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
    this.task.data.action = 'create'
    this.task.data.title ??= ''
    this.task.data.outcomes ??= ''
    this.task.data.duration ??= 120
    this.task.data.variable ??= 'prediction'
  },
}
</script>
