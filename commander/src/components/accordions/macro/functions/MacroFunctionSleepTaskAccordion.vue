<template>
  <MacroFunctionBaseTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    :custom-title="sleepTitle"
    icon="mdi-timer-sand"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <template #default>
      <v-col cols="12" sm="6" md="8">
        <v-text-field
          v-model.number="timeValue"
          label="Time"
          type="number"
          min="0"
          step="any"
          density="compact"
          variant="outlined"
          hide-details
          @update:model-value="saveMilliseconds"
        />
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-select
          v-model="timeUnit"
          :items="timeUnits"
          item-title="title"
          item-value="value"
          label="Unit"
          density="compact"
          variant="outlined"
          hide-details
          @update:model-value="saveMilliseconds"
        />
      </v-col>
    </template>
  </MacroFunctionBaseTaskAccordion>
</template>

<script lang="ts">
import MacroFunctionBaseTaskAccordion from './MacroFunctionBaseTaskAccordion.vue'

type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours'

const UNIT_MULTIPLIERS: Record<TimeUnit, number> = {
  milliseconds: 1,
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
}

export default {
  name: 'MacroFunctionSleepTaskAccordion',

  components: {
    MacroFunctionBaseTaskAccordion,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      timeValue: 0,
      timeUnit: 'seconds' as TimeUnit,
      timeUnits: [
        { title: 'Milliseconds', value: 'milliseconds' },
        { title: 'Seconds', value: 'seconds' },
        { title: 'Minutes', value: 'minutes' },
        { title: 'Hours', value: 'hours' },
      ],
    }
  },

  computed: {
    task(): any {
      return (this.item as any).task
    },

    sleepTitle(): string {
      return `Sleep: ${this.formatDuration(this.getMilliseconds())}`
    },
  },

  created() {
    this.task.channel = 'function'
    this.task.method = 'sleep'

    if (!this.task.data || typeof this.task.data !== 'object') {
      this.task.data = {}
    }

    const milliseconds = this.getMilliseconds()
    const initial = this.getBestUnit(milliseconds)

    this.timeUnit = initial.unit
    this.timeValue = initial.value
    this.saveMilliseconds()
  },

  methods: {
    getMilliseconds(): number {
      const value = Number(this.task.data?.time)
      return Number.isFinite(value) && value >= 0 ? value : 0
    },

    saveMilliseconds(): void {
      const value = Number(this.timeValue)
      const safeValue = Number.isFinite(value) && value >= 0 ? value : 0
      this.task.data.time = Math.round(safeValue * UNIT_MULTIPLIERS[this.timeUnit])
    },

    getBestUnit(milliseconds: number): { value: number; unit: TimeUnit } {
      if (milliseconds > 0 && milliseconds % UNIT_MULTIPLIERS.hours === 0) {
        return { value: milliseconds / UNIT_MULTIPLIERS.hours, unit: 'hours' }
      }

      if (milliseconds > 0 && milliseconds % UNIT_MULTIPLIERS.minutes === 0) {
        return { value: milliseconds / UNIT_MULTIPLIERS.minutes, unit: 'minutes' }
      }

      if (milliseconds > 0 && milliseconds % UNIT_MULTIPLIERS.seconds === 0) {
        return { value: milliseconds / UNIT_MULTIPLIERS.seconds, unit: 'seconds' }
      }

      return { value: milliseconds, unit: 'milliseconds' }
    },

    formatDuration(milliseconds: number): string {
      if (milliseconds < 1000) {
        return `${milliseconds} ms`
      }

      const totalSeconds = milliseconds / 1000

      if (totalSeconds < 60) {
        return `${this.formatNumber(totalSeconds)} ${totalSeconds === 1 ? 'second' : 'seconds'}`
      }

      const totalMinutes = totalSeconds / 60

      if (totalMinutes < 60) {
        return `${this.formatNumber(totalMinutes)} ${totalMinutes === 1 ? 'minute' : 'minutes'}`
      }

      const totalHours = totalMinutes / 60
      return `${this.formatNumber(totalHours)} ${totalHours === 1 ? 'hour' : 'hours'}`
    },

    formatNumber(value: number): string {
      return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
    },
  },
}
</script>
