<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-poll"
    title="Create poll"
    export-prefix="macro_twitch_poll_create"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-text-field v-model="task.data.title" variant="outlined" label="Title" />
      </v-col>

      <v-col cols="12">
        <div class="text-subtitle-2 mb-2">Choices</div>

        <v-row v-for="(_, choiceIndex) in choiceFields" :key="choiceIndex" dense>
          <v-col>
            <v-text-field
              v-model="choiceFields[choiceIndex]"
              variant="outlined"
              :label="`Choice ${choiceIndex + 1}`"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="auto" class="d-flex align-center">
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              :disabled="choiceFields.length <= 2"
              :aria-label="`Remove choice ${choiceIndex + 1}`"
              @click="removeChoice(choiceIndex)"
            />
          </v-col>
        </v-row>

        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          prepend-icon="mdi-plus"
          class="mt-1"
          :disabled="choiceFields.length >= 5"
          @click="addChoice"
        >
          Add choice
        </v-btn>

        <div class="text-caption text-medium-emphasis mt-2">
          A poll requires between 2 and 5 choices.
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="task.data.duration"
          variant="outlined"
          type="number"
          min="15"
          max="1800"
          label="Duration (seconds)"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.data.variable"
          variant="outlined"
          label="Result variable"
          placeholder="poll"
          hint="The created poll is available as ${poll}"
          persistent-hint
        />
      </v-col>
      <v-col cols="12">
        <v-switch
          v-model="task.data.channel_points_voting"
          label="Allow channel point votes"
          color="primary"
          hide-details
        />
      </v-col>
      <v-col v-if="task.data.channel_points_voting" cols="12" md="6">
        <v-text-field
          v-model.number="task.data.points_per_vote"
          variant="outlined"
          type="number"
          min="1"
          label="Points per additional vote"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchPollCreateTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  data() {
    return {
      choiceFields: [] as string[],
    }
  },
  computed: {
    task(): any { return (this.item as any).task },
  },
  watch: {
    choiceFields: {
      deep: true,
      handler(value: string[]) {
        this.task.data.choices = value.join('\n')
      },
    },
  },
  created() {
    this.task.channel = 'twitch'
    this.task.method = 'poll'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.action = 'create'
    this.task.data.title ??= ''
    this.task.data.choices ??= ''
    this.task.data.duration ??= 60
    this.task.data.channel_points_voting ??= false
    this.task.data.points_per_vote ??= 1
    this.task.data.variable ??= 'poll'

    const choices = Array.isArray(this.task.data.choices)
      ? this.task.data.choices
      : String(this.task.data.choices)
        .split('\n')
        .map((choice: string) => choice.trim())
        .filter(Boolean)

    this.choiceFields = choices.length >= 2 ? choices : ['', '']
  },
  methods: {
    addChoice() {
      if (this.choiceFields.length < 5) {
        this.choiceFields.push('')
      }
    },
    removeChoice(index: number) {
      if (this.choiceFields.length > 2) {
        this.choiceFields.splice(index, 1)
      }
    },
  },
}
</script>
