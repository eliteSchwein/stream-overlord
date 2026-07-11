<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-file-edit-outline"
    title="PATCH request"
    export-prefix="macro_api_patch"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <MacroApiRequestFields :task="task" :supports-body="true" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import MacroApiRequestFields from './MacroApiRequestFields.vue'

export default {
  name: 'MacroApiPatchTaskAccordion',
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
    this.task.method = 'patch'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.url ??= ''
    this.task.data.result_variable ??= 'api_response'
    this.task.data.headers ??= {}
    this.task.data.query ??= {}
    this.task.data.timeout ??= 30000
    this.task.data.fail_on_error ??= false
    this.task.data.body_type ??= 'json'
    this.task.data.body_data ??= {}
    this.task.data.form_data ??= {}
  },
}
</script>
