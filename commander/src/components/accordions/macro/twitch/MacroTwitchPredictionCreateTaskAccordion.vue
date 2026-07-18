<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-crystal-ball"
    :title="$t('macro.twitch.predictionCreate.title')"
    export-prefix="macro_twitch_prediction_create"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-text-field v-model="task.data.title" variant="outlined" :label="$t('macro.twitch.fields.title')" />
      </v-col>

      <v-col cols="12">
        <div class="text-subtitle-2 mb-2">{{ $t('macro.twitch.predictionCreate.outcomes') }}</div>

        <v-row v-for="(_, outcomeIndex) in outcomeFields" :key="outcomeIndex" dense>
          <v-col>
            <v-text-field
              v-model="outcomeFields[outcomeIndex]"
              variant="outlined"
              :label="$t('macro.twitch.predictionCreate.outcome', { number: outcomeIndex + 1 })"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="auto" class="d-flex align-center">
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              :disabled="outcomeFields.length <= 2"
              :aria-label="$t('macro.twitch.predictionCreate.removeOutcome', { number: outcomeIndex + 1 })"
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
          {{ $t('macro.twitch.predictionCreate.addOutcome') }}
        </v-btn>

        <div class="text-caption text-medium-emphasis mt-2">
          {{ $t('macro.twitch.predictionCreate.requirement') }}
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="task.data.duration"
          variant="outlined"
          type="number"
          min="30"
          max="1800"
          :label="$t('macro.twitch.predictionCreate.lockAfterSeconds')"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.data.variable"
          variant="outlined"
          :label="$t('macro.twitch.fields.resultVariable')"
          :placeholder="$t('macro.twitch.placeholders.predictionVariable')"
          :hint="$t('macro.twitch.predictionCreate.resultHint')"
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
