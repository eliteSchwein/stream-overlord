<template>
  <MacroTaskAccordionTemplate
    class="macro-alert-task-accordion"
    :item="item"
    :index="index"
    :depth="depth"
    icon="mdi-bell-ring"
    :title="title"
    chip="alert"
    export-prefix="macro_alert"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.message"
          label="Message"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="2">
        <v-switch
          v-model="task.speak"
          label="Speak"
          density="comfortable"
          color="primary"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <MacroAssetSelect
          v-model="task.asset"
          label="Asset"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'
import MacroAssetSelect from './MacroAssetSelect.vue'

export default {
  name: 'MacroAlertTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
    MacroAssetSelect,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      return (this.item as any).task
    },

    title(): string {
      return `Alert: ${this.task.message || 'empty message'}`
    },
  },
}
</script>
