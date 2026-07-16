<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-volume-high"
    :title="$t('macro.audio.setVolumeTitle')"
    export-prefix="macro_audio_set_volume"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-autocomplete
      v-model="task.data.interface"
      :items="audioInterfaces"
      :label="$t('macro.audio.interface')"
      :placeholder="$t('macro.audio.interfacePlaceholder')"
      variant="outlined"
      density="comfortable"
      clearable
      auto-select-first
      hide-no-data
    />

    <v-text-field
      v-model.number="task.data.volume"
      :label="$t('macro.audio.volume')"
      type="number"
      min="0"
      max="100"
      suffix="%"
      variant="outlined"
      density="comfortable"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import {useAppStore} from '@/stores/app'

export default {
  name: 'MacroAudioSetVolumeTaskAccordion',
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
    task.method = 'set_volume'
    task.data = task.data && typeof task.data === 'object' ? task.data : {}
    task.data.interface ??= ''
    task.data.volume ??= 50
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
