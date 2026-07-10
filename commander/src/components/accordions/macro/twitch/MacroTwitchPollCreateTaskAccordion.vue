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
        <v-textarea v-model="task.data.choices" variant="outlined" label="Choices" hint="One choice per line" persistent-hint rows="4" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model.number="task.data.duration" variant="outlined" type="number" min="15" max="1800" label="Duration (seconds)" />
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
        <v-switch v-model="task.data.channel_points_voting" label="Allow channel point votes" color="primary" hide-details />
      </v-col>
      <v-col v-if="task.data.channel_points_voting" cols="12" md="6">
        <v-text-field v-model.number="task.data.points_per_vote" variant="outlined" type="number" min="1" label="Points per additional vote" />
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
  computed: {
    task(): any { return (this.item as any).task },
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
  },
}
</script>
