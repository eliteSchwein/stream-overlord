<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-download"
    :title="$t('macro.api.requestTitles.get')"
    export-prefix="macro_api_get"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <MacroApiRequestFields :task="task" :supports-body="false" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import MacroApiRequestFields from './MacroApiRequestFields.vue'

export default {
  name: 'MacroApiGetTaskAccordion',
  components: { MacroTaskAccordionTemplate, MacroApiRequestFields },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    task(): any { return (this.item as any).task },
  },
  created() {
    this.task.channel = 'api_request'
    this.task.method = 'get'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.url ??= ''
    this.task.data.result_variable ??= 'api_response'
    this.task.data.headers ??= {}
    this.task.data.query ??= {}
    this.task.data.timeout ??= 30000
    this.task.data.fail_on_error ??= false
  },
}
</script>
