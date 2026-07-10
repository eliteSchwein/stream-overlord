<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-account-clock"
    title="Timeout user"
    export-prefix="macro_twitch_timeout"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.data.user"
          variant="outlined"
          label="User"
          placeholder="username or {{variable}}"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="task.data.duration"
          variant="outlined"
          type="number"
          min="1"
          max="1209600"
          label="Duration in seconds"
          hint="Maximum: 1,209,600 seconds (14 days)"
          persistent-hint
        />
      </v-col>

      <v-col cols="12">
        <v-text-field
          v-model="task.data.reason"
          variant="outlined"
          label="Reason"
          placeholder="Optional reason or {{variable}}"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchTimeoutTaskAccordion',
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
    this.task.method = 'timeout'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.user ??= ''
    this.task.data.duration ??= 600
    this.task.data.reason ??= ''
  },
}
</script>
