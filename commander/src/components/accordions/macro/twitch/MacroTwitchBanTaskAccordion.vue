<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-account-cancel"
    title="Ban user"
    export-prefix="macro_twitch_ban"
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
  name: 'MacroTwitchBanTaskAccordion',
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
    this.task.method = 'ban'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.user ??= ''
    this.task.data.reason ??= ''
  },
}
</script>
