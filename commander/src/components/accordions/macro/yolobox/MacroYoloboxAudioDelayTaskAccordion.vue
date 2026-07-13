<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-timer-outline"
    title="Set YoloBox audio delay"
    export-prefix="macro_yolobox_set_audio_delay"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-autocomplete
          v-model="task.data.id"
          :items="audioSources"
          item-title="title"
          item-value="value"
          label="Audio source"
          variant="outlined"
          clearable
        />
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model.number="task.data.delayTime"
          type="number"
          min="0"
          step="1"
          label="Audio delay"
          suffix="ms"
          variant="outlined"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroYoloboxAudioDelayTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    ...mapState(useAppStore, ['getYoloboxData']),
    task(): any {
      return (this.item as any).task
    },
    audioSources(): Array<{ title: string; value: string }> {
      return (this.getYoloboxData?.MixerList ?? []).map((source: any) => ({
        title: source.name || source.id,
        value: String(source.id),
      }))
    },
  },
  created() {
    this.task.channel = 'yolobox'
    this.task.method = 'set_audio_delay'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.id ??= ''
    this.task.data.delayTime ??= 0
  },
}
</script>
