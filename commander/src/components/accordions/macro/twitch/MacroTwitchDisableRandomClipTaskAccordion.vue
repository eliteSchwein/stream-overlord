<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-movie-open-off"
    :title="$t('macro.twitch.randomClip.disableTitle')"
    export-prefix="macro_twitch_disable_random_clip"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
    >
      {{ $t('macro.twitch.randomClip.disableInfo') }}
    </v-alert>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchDisableRandomClipTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    task(): any {
      return (this.item as any).task
    },
  },
  created() {
    this.task.channel = 'twitch'
    this.task.method = 'disable_random_clip'
    this.task.data = {}
  },
}
</script>
