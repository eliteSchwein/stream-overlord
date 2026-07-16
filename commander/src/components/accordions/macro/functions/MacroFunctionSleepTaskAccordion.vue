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
          :label="$t('macro.function.sleep.time')"
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
          :label="$t('macro.function.sleep.unit')"
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
    }
  },

  computed: {
    task(): any {
      return (this.item as any).task
    },

    timeUnits(): Array<{ title: string; value: TimeUnit }> {
      return [
        { title: String(this.$t('macro.function.sleep.units.milliseconds')), value: 'milliseconds' },
        { title: String(this.$t('macro.function.sleep.units.seconds')), value: 'seconds' },
        { title: String(this.$t('macro.function.sleep.units.minutes')), value: 'minutes' },
        { title: String(this.$t('macro.function.sleep.units.hours')), value: 'hours' },
      ]
    },

    sleepTitle(): string {
      return String(this.$t('macro.function.sleep.title', {
        duration: this.formatDuration(this.getMilliseconds()),
      }))
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
        return String(this.$t('macro.function.sleep.duration.milliseconds', {
          count: milliseconds,
        }))
      }

      const totalSeconds = milliseconds / 1000

      if (totalSeconds < 60) {
        return String(this.$t('macro.function.sleep.duration.seconds', {
          count: this.formatNumber(totalSeconds),
        }))
      }

      const totalMinutes = totalSeconds / 60

      if (totalMinutes < 60) {
        return String(this.$t('macro.function.sleep.duration.minutes', {
          count: this.formatNumber(totalMinutes),
        }))
      }

      const totalHours = totalMinutes / 60
      return String(this.$t('macro.function.sleep.duration.hours', {
        count: this.formatNumber(totalHours),
      }))
    },

    formatNumber(value: number): string {
      return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
    },
  },
}
</script>
