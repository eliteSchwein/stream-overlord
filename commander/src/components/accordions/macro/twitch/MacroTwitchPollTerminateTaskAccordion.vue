<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-close-octagon-outline"
    :title="$t('macro.twitch.pollTerminate.title')"
    export-prefix="macro_twitch_poll_terminate"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field v-model="task.data.poll_id" variant="outlined" :label="$t('macro.twitch.fields.pollId')" :placeholder="$t('macro.twitch.placeholders.pollIdOrVariable')" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchPollTerminateTaskAccordion',
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
    this.task.method = 'poll'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.action = 'terminate'
    this.task.data.poll_id ??= ''
  },
}
</script>
