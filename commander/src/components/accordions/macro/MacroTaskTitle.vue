<template>
  <v-expansion-panel-title>
    <div class="d-flex align-center min-width-0 w-100">
      <v-icon :icon="icon" size="20" class="mr-2" />

      <span class="text-caption mr-2 text-medium-emphasis">{{ $t('macro.final.taskTitle.variable') }}</span>

      <span class="text-truncate font-weight-medium">{{ $t('macro.final.taskTitle.variable2') }}</span>

      <v-spacer />

      <v-btn
        size="small"
        variant="text"
        @click.stop="$emit('move-up')"
      >
        <v-icon icon="mdi-arrow-up" size="16" />
      </v-btn>

      <v-btn
        class="mr-4"
        size="small"
        variant="text"
        @click.stop="$emit('move-down')"
      >
        <v-icon icon="mdi-arrow-down" size="16" />
      </v-btn>
    </div>
  </v-expansion-panel-title>
</template>

<script lang="ts">
export default {
  name: 'MacroTaskTitle',

  props: {
    icon: { type: String, required: true },
    index: { type: Number, required: true },
    title: { type: String, required: true },
  },

  emits: ['move-up', 'move-down'],
}
</script>
