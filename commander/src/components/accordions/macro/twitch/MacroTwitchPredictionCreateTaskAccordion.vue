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
        <div class="text-subtitle-2 mb-2">Outcomes</div>

        <v-row v-for="(_, outcomeIndex) in outcomeFields" :key="outcomeIndex" dense>
          <v-col>
            <v-text-field
              v-model="outcomeFields[outcomeIndex]"
              variant="outlined"
              :label="`Outcome ${outcomeIndex + 1}`"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="auto" class="d-flex align-center">
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              :disabled="outcomeFields.length <= 2"
              :aria-label="`Remove outcome ${outcomeIndex + 1}`"
              @click="removeOutcome(outcomeIndex)"
            />
          </v-col>
        </v-row>

        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          prepend-icon="mdi-plus"
          class="mt-1"
          :disabled="outcomeFields.length >= 10"
          @click="addOutcome"
        >
          Add outcome
        </v-btn>

        <div class="text-caption text-medium-emphasis mt-2">
          A prediction requires between 2 and 10 outcomes.
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="task.data.duration"
          variant="outlined"
          type="number"
          min="30"
          max="1800"
          label="Lock after (seconds)"
        />
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
  data() {
    return {
      outcomeFields: [] as string[],
    }
  },
  computed: {
    task(): any { return (this.item as any).task },
  },
  watch: {
    outcomeFields: {
      deep: true,
      handler(value: string[]) {
        this.task.data.outcomes = value.join('\n')
      },
    },
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

    const outcomes = Array.isArray(this.task.data.outcomes)
      ? this.task.data.outcomes
      : String(this.task.data.outcomes)
        .split('\n')
        .map((outcome: string) => outcome.trim())
        .filter(Boolean)

    this.outcomeFields = outcomes.length >= 2 ? outcomes : ['', '']
  },
  methods: {
    addOutcome() {
      if (this.outcomeFields.length < 10) {
        this.outcomeFields.push('')
      }
    },
    removeOutcome(index: number) {
      if (this.outcomeFields.length > 2) {
        this.outcomeFields.splice(index, 1)
      }
    },
  },
}
</script>
