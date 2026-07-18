<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-volume-off"
    :title="$t('macro.yolobox.audioMute.title')"
    export-prefix="macro_yolobox_set_audio_muted"
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
          :label="$t('macro.yolobox.fields.audioSource')"
          variant="outlined"
          clearable
        />
      </v-col>
      <v-col cols="12">
        <v-select
          v-model="task.data.muted"
          :items="muteItems"
          item-title="title"
          item-value="value"
          :label="$t('macro.yolobox.fields.action')"
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
  name: 'MacroYoloboxAudioMuteTaskAccordion',
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
    muteItems(): Array<{ title: string; value: boolean }> {
      return [
        { title: String(this.$t('macro.yolobox.audioMute.mute')), value: true },
        { title: String(this.$t('macro.yolobox.audioMute.unmute')), value: false },
      ]
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
    this.task.method = 'set_audio_muted'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.id ??= ''
    this.task.data.muted ??= true
  },
}
</script>
