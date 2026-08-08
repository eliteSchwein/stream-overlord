<template>
  <v-expansion-panel :value="panelValue">
    <MacroTaskTitle
      :icon="icon"
      :index="index"
      :title="title"
      :can-move-up="canMoveUp"
      :can-move-down="canMoveDown"
      @move-up="$emit('move-up')"
      @move-down="$emit('move-down')"
    />

    <v-expansion-panel-text>
      <slot />

      <MacroTaskActions
        class="mt-2"
        :task="item.task"
        :filename="`${exportPrefix}_${index + 1}.yaml`"
        @remove="$emit('remove')"
      />
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import MacroTaskTitle from './MacroTaskTitle.vue'
import MacroTaskActions from './MacroTaskActions.vue'

export default {
  name: 'MacroTaskAccordionTemplate',

  components: {
    MacroTaskTitle,
    MacroTaskActions,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    icon: { type: String, required: true },
    title: { type: String, required: true },
    exportPrefix: { type: String, default: 'macro_task' },
    panelValue: { type: [String, Number], default: undefined },
    canMoveUp: { type: Boolean, default: true },
    canMoveDown: { type: Boolean, default: true },
  },

  emits: ['remove', 'move-up', 'move-down'],
}
</script>
