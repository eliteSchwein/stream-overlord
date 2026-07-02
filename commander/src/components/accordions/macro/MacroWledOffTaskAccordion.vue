<template>
  <MacroTaskAccordionTemplate
    class="macro-wled-off-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-led-strip-variant-off"
    :title="title"
    export-prefix="macro_wled_off"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <MacroWledSelect
          v-model="wledData.name"
          label="WLED device"
        />
      </v-col>

      <v-col cols="12">
        <v-alert
          type="warning"
          variant="tonal"
          density="comfortable"
        >
          This task uses the <strong>off</strong> method and turns the selected WLED device off.
        </v-alert>
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'
import MacroWledSelect from '../../MacroWledSelect.vue'

export default {
  name: 'MacroWledOffTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
    MacroWledSelect,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'wled'
      task.method = 'off'
      task.data ??= {}
      task.data.name ??= ''

      return task
    },

    wledData(): any {
      return this.task.data
    },

    title(): string {
      return `WLED: turn off ${this.wledData.name || 'device'}`
    },
  },
}
</script>
