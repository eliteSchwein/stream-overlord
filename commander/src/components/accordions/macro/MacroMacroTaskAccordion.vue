<template>
  <MacroTaskAccordionTemplate
    class="macro-macro-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-playlist-play"
    :title="'Macro: ' + (task.method || 'Select macro')"
    export-prefix="macro_macro"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-combobox
          v-model="task.method"
          :items="macroOptions"
          :label="$t('macro.core.macroTask.macro')"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMacroTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      const task = (this.item as any).task
      task.channel = 'macro'
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
}
</script>
