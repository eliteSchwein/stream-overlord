<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    :icon="task.data.status === 'start' ? 'mdi-play-circle-outline' : 'mdi-stop-circle-outline'"
    :title="task.data.status === 'start' ? 'Start YoloBox stream' : 'Stop YoloBox stream'"
    export-prefix="macro_yolobox_live_status"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-select
          v-model="task.data.status"
          :items="statusItems"
          item-title="title"
          item-value="value"
          label="Stream action"
          variant="outlined"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroYoloboxLiveStatusTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  data() {
    return {
      statusItems: [
        { title: 'Go live', value: 'start' },
        { title: 'Stop stream', value: 'stop' },
      ],
    }
  },
  computed: {
    task(): any {
      return (this.item as any).task
    },
  },
  created() {
    this.task.channel = 'yolobox'
    this.task.method = 'set_live_status'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.status ??= 'start'
  },
}
</script>
