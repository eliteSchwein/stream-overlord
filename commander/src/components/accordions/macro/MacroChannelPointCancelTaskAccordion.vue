<template>
  <MacroTaskAccordionTemplate
    class="macro-channel-point-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-close-circle-outline"
    :title="$t('macro.core.channelPointCancel.cancelChannelPointReward')"
    export-prefix="macro_channel_point_cancel"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="warning"
      variant="tonal"
      density="comfortable"
      :text="$t('macro.core.channelPointCancel.marksTheCurrentChannelPointRedemptionAsCanceled')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroChannelPointCancelTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      const task = (this.item as any).task
      task.channel = 'channel_point'
      task.method = 'cancel'
      return task
    },
  },

  created() {
    this.task
  },
}
</script>
