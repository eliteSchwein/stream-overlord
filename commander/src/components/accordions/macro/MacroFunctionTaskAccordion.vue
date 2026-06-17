<template>
  <component
    :is="componentName"
    :item="item"
    :index="index"
    :depth="depth"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  />
</template>

<script lang="ts">
import MacroTaskAccordion from '@/components/accordions/macro/MacroTaskAccordion.vue'
import {
  MacroFunctionRandomTaskAccordion,
  MacroFunctionSendDmTaskAccordion,
  MacroFunctionSendMessageTaskAccordion,
  MacroFunctionSleepTaskAccordion,
  MacroFunctionSongRequestTaskAccordion,
  MacroFunctionSongRequestToggleTaskAccordion,
  MacroFunctionSpeakTaskAccordion,
  MacroFunctionToggleAutoMacroTaskAccordion,
} from '@/components/accordions/macro/functions'

export default {
  name: 'MacroFunctionTaskAccordion',

  components: {
    MacroFunctionRandomTaskAccordion,
    MacroFunctionToggleAutoMacroTaskAccordion,
    MacroFunctionSleepTaskAccordion,
    MacroFunctionSpeakTaskAccordion,
    MacroFunctionSongRequestTaskAccordion,
    MacroFunctionSongRequestToggleTaskAccordion,
    MacroFunctionSendMessageTaskAccordion,
    MacroFunctionSendDmTaskAccordion,
    MacroTaskAccordion,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    componentName(): string {
      const method = (this.item as any)?.task?.method
      const componentsByMethod: Record<string, string> = {
        random: 'MacroFunctionRandomTaskAccordion',
        toggle_auto_macro: 'MacroFunctionToggleAutoMacroTaskAccordion',
        sleep: 'MacroFunctionSleepTaskAccordion',
        speak: 'MacroFunctionSpeakTaskAccordion',
        song_request: 'MacroFunctionSongRequestTaskAccordion',
        song_request_toggle: 'MacroFunctionSongRequestToggleTaskAccordion',
        send_message: 'MacroFunctionSendMessageTaskAccordion',
        send_dm: 'MacroFunctionSendDmTaskAccordion',
      }

      return componentsByMethod[method] ?? 'MacroTaskAccordion'
    },
  },
}
</script>
