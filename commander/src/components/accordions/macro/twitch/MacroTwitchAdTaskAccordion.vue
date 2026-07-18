<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-advertisements"
    :title="$t('macro.twitch.ad.title')"
    export-prefix="macro_twitch_ad"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-select v-model="task.data.duration" variant="outlined" :items="[30, 60, 90, 120, 150, 180]" :label="$t('macro.twitch.fields.durationSeconds')" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchAdTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    task(): any { return (this.item as any).task },
  },
  created() {
    this.task.channel = 'twitch'
    this.task.method = 'ad'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.duration ??= 30
  },
}
</script>
