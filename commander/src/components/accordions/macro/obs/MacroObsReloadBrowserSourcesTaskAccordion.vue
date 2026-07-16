<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-refresh"
    :title="$t('macro.obs.reloadBrowserSources.title')"
    export-prefix="macro_obs_reload_browser_sources"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
      :text="$t('macro.obs.noExtraOptions')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroObsReloadBrowserSourcesTaskAccordion',

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
  },

  created() {
    this.task.channel = 'obs'
    this.task.method = 'reload_browser_sources'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}
  },
}
</script>
