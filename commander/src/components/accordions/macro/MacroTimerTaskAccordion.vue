<template>
  <MacroTaskAccordionTemplate
    class="macro-timer-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-timer-play-outline"
    :title="'Timer: ' + (task.data.name || 'start')"
    export-prefix="macro_timer"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="4">
        <v-text-field
          v-model="task.data.name"
          label="Timer name"
          prepend-inner-icon="mdi-timer-outline"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-number-input
          v-model="task.data.time"
          label="Time"
          suffix="seconds"
          :min="1"
          :step="1"
          prepend-inner-icon="mdi-timer-outline"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-select
          v-model="task.data.end"
          :items="endActionOptions"
          item-title="title"
          item-value="value"
          label="End action"
          prepend-inner-icon="mdi-flag-checkered"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTimerTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      endActionOptions: [
        { title: 'Blink', value: 'blink' },
        { title: 'Fade', value: 'fade' },
      ],
    }
  },

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'timer'
      task.method = 'start'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (!Number.isFinite(Number(task.data.time))) {
        task.data.time = 600
      }

      task.data.end ??= ''

      return task
    },
  },

  created() {
    this.task
  },
}
</script>
