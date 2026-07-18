<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-video-switch"
    :title="$t('macro.yolobox.videoSource.title')"
    export-prefix="macro_yolobox_video_source"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-autocomplete
          v-model="task.data.id"
          :items="sources"
          item-title="title"
          item-value="value"
          :label="$t('macro.yolobox.fields.videoSource')"
          variant="outlined"
          clearable
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
  name: 'MacroYoloboxVideoSourceTaskAccordion',
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
    sources(): Array<{ title: string; value: string }> {
      return (this.getYoloboxData?.DirectorList ?? []).map((source: any) => ({
        title: source.directorName || source.name || source.id,
        value: String(source.id),
      }))
    },
  },
  created() {
    this.task.channel = 'yolobox'
    this.task.method = 'switch_video_source'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.id ??= ''
  },
}
</script>
