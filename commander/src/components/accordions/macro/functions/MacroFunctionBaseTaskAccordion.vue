<template>
  <MacroTaskAccordionTemplate
    class="macro-task-accordion macro-function-task-accordion"
    :item="item"
    :index="index"
    :icon="icon"
    :title="accordionTitle"
    export-prefix="macro_function"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field
      v-model="task.method"
      class="d-none"
      :label="$t('macro.function.fields.function')"
      density="compact"
      variant="outlined"
      hide-details
    />

    <v-row density="comfortable">
      <slot :task="task" :data="data" />
    </v-row>

    <slot name="after" :task="task" :data="data" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroFunctionBaseTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    titlePrefix: { type: String, default: '' },
    customTitle: { type: String, default: '' },
    icon: { type: String, default: 'mdi-function' },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      return (this.item as any).task
    },

    data(): any {
      if (!this.task.data || typeof this.task.data !== 'object') {
        this.task.data = {}
      }

      return this.task.data
    },

    accordionTitle(): string {
      const customTitle = typeof this.customTitle === 'string'
        ? this.customTitle.trim()
        : ''

      if (customTitle) {
        return customTitle
      }

      const prefix = typeof this.titlePrefix === 'string' && this.titlePrefix.trim()
        ? this.titlePrefix.trim()
        : String(this.$t('macro.function.defaultTitle'))

      const method = typeof this.task?.method === 'string' && this.task.method.trim()
        ? this.task.method.trim()
        : String(this.$t('macro.function.unknownMethod'))

      return String(this.$t('macro.function.titleWithMethod', { prefix, method }))
    },
  },

  created() {
    this.task.channel = 'function'
  },
}
</script>
