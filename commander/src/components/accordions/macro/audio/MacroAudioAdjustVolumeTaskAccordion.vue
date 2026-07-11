<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-volume-plus"
    title="Adjust audio volume"
    export-prefix="macro_audio_adjust_volume"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-autocomplete
      v-model="task.data.interface"
      :items="audioInterfaces"
      label="Audio interface"
      placeholder="Select or enter an interface"
      variant="outlined"
      density="comfortable"
      clearable
      auto-select-first
      hide-no-data
    />

    <v-text-field
      v-model.number="task.data.volume"
      label="Volume adjustment"
      type="number"
      suffix="%"
      hint="Use a negative value to lower the volume"
      persistent-hint
      variant="outlined"
      density="comfortable"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import {useAppStore} from '@/stores/app'

export default {
  name: 'MacroAudioAdjustVolumeTaskAccordion',
  components: {MacroTaskAccordionTemplate},
  props: {
    item: {type: Object, required: true},
    index: {type: Number, required: true},
  },
  emits: ['remove', 'move-up', 'move-down'],
  setup() {
    const appStore = useAppStore()
    return {appStore}
  },
  created() {
    const task = (this.item as any).task
    task.channel = 'audio'
    task.method = 'adjust_volume'
    task.data = task.data && typeof task.data === 'object' ? task.data : {}
    task.data.interface ??= ''
    task.data.volume ??= 10
  },
  computed: {
    task(): any {
      return (this.item as any).task
    },
    audioInterfaces(): string[] {
      return Object.keys(this.appStore.audioData ?? {}).sort((a, b) => a.localeCompare(b))
    },
  },
}
</script>
