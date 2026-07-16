<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-keyboard"
    :title="title"
    export-prefix="macro_obs_trigger_hotkey"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="data.hotkeyName"
          :label="$t('macro.obs.fields.hotkeyName')"
          prepend-inner-icon="mdi-keyboard"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroObsTriggerHotkeyTaskAccordion',

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
      return (this.item as any).task
    },

    data(): any {
      return this.task.data
    },

    title(): string {
      return String(this.$t('macro.obs.triggerHotkey.title'))
    },
  },

  created() {
    this.task.channel = 'obs'
    this.task.method = 'TriggerHotkeyByName'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}

    if (this.data.hotkeyName === undefined) {
      this.data.hotkeyName = ''
    }
  },
}
</script>
