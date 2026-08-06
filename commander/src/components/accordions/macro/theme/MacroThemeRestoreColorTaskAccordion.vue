<template>
  <MacroTaskAccordionTemplate
    class="macro-theme-restore-color-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-palette-outline"
    :title="$t('macro.theme.restoreColor.title')"
    export-prefix="macro_theme_restore_color"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
      :text="$t('macro.theme.restoreColor.info')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroThemeRestoreColorTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],
}
</script>
