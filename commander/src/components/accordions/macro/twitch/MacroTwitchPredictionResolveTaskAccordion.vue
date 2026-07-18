<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-check-decagram-outline"
    :title="$t('macro.twitch.predictionResolve.title')"
    export-prefix="macro_twitch_prediction_resolve"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12" md="6">
        <v-text-field v-model="task.data.prediction_id" variant="outlined" :label="$t('macro.twitch.fields.predictionId')" :placeholder="$t('macro.twitch.placeholders.predictionId')" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="task.data.winning_outcome_id" variant="outlined" :label="$t('macro.twitch.predictionResolve.winningOutcomeId')" :placeholder="$t('macro.twitch.placeholders.winningOutcomeId')" />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchPredictionResolveTaskAccordion',
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
    this.task.data.action = 'resolve'
    this.task.data.prediction_id ??= ''
    this.task.data.winning_outcome_id ??= ''
  },
}
</script>
