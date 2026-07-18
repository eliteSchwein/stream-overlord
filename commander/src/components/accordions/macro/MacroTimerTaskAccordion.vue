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
          :label="$t('macro.final.timer.timerName')"
          prepend-inner-icon="mdi-timer-outline"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-number-input
          v-model="task.data.time"
          :label="$t('macro.final.timer.time')"
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
          :label="$t('macro.final.timer.endAction')"
          prepend-inner-icon="mdi-flag-checkered"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12">
        <v-combobox
          v-model="task.data.finished_macro"
          :items="macroOptions"
          :label="$t('macro.final.timer.finishedMacro')"
          :hint="$t('macro.final.timer.optionalMacroThatRunsWhenTheTimerReaches0')"
          persistent-hint
          clearable
          prepend-inner-icon="mdi-playlist-play"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          @update:model-value="normalizeFinishedMacro"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
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
        { title: String(this.$t('macro.final.timer.blink')), value: 'blink' },
        { title: String(this.$t('macro.final.timer.fade')), value: 'fade' },
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

      task.data.end ||= 'blink'

      if (task.data.finished_macro === null) {
        delete task.data.finished_macro
      }

      return task
    },

    macroOptions(): string[] {
      const appStore = useAppStore()
      const macros = appStore.getMacros ?? {}

      if (Array.isArray(macros)) {
        return macros
          .map((item: any) => (typeof item === 'string' ? item : item?.name))
          .filter(Boolean)
          .map(String)
          .sort((a: string, b: string) => a.localeCompare(b))
      }

      return Object.keys(macros)
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b))
    },
  },

  created() {
    this.task
  },

  methods: {
    normalizeFinishedMacro(value: string | null) {
      const macroName = String(value ?? '').trim()

      if (!macroName) {
        delete this.task.data.finished_macro
        return
      }

      this.task.data.finished_macro = macroName
    },
  },
}
</script>
