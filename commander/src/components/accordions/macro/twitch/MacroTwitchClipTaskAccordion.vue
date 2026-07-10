<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-content-cut"
    title="Create clip"
    export-prefix="macro_twitch_clip"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-switch v-model="task.data.create_after_delay" label="Create after delay" color="primary" hide-details />
    <v-row>
      <v-col cols="6">
        <v-text-field
          variant="outlined"
          v-model="task.data.variable"
          label="Result variable"
          placeholder="clip"
          hint="The completed clip is available as e.g. ${clip.url}"
          persistent-hint
        />
      </v-col>
      <v-col cols="6">
        <v-text-field
          variant="outlined"
          v-model.number="task.data.wait_seconds"
          type="number"
          min="0"
          label="Wait before fetching clip (seconds)"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchClipTaskAccordion',
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
    this.task.method = 'clip'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.create_after_delay ??= false
    this.task.data.wait_seconds ??= 35
    this.task.data.variable ??= "clip"
  },
}
</script>
