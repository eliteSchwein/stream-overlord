<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-volume-high"
    title="Set YoloBox audio volume"
    export-prefix="macro_yolobox_set_audio_volume"
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
        <v-slider
          v-model="task.data.volume"
          :min="0"
          :max="1"
          :step="0.05"
          label="Volume"
          thumb-label="always"
          hide-details
        />
        <div class="text-caption text-medium-emphasis mt-1">
          {{ Math.round(Number(task.data.volume ?? 0) * 100) }}%
        </div>
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroYoloboxAudioVolumeTaskAccordion',
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
    this.task.method = 'set_audio_volume'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.id ??= ''
    this.task.data.volume ??= 1
  },
}
</script>
