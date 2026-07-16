<template>
  <MacroFunctionBaseTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    :title-prefix="$t('macro.function.announce.title')"
    icon="mdi-bullhorn-outline"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <template #default="{ data }">
      <v-col cols="12" md="8">
        <v-text-field
          v-model="data.content"
          :label="$t('macro.function.fields.message')"
          density="compact"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-select
          v-model="data.color"
          :items="colors"
          :label="$t('macro.function.fields.color')"
          density="compact"
          variant="outlined"
          hide-details
        />
      </v-col>
    </template>
  </MacroFunctionBaseTaskAccordion>
</template>

<script lang="ts">
import MacroFunctionBaseTaskAccordion from './MacroFunctionBaseTaskAccordion.vue'

export default {
  name: 'MacroFunctionAnnounceTaskAccordion',

  components: {
    MacroFunctionBaseTaskAccordion,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      colors: ['primary', 'blue', 'green', 'orange', 'purple'],
    }
  },

  created() {
    const task = (this.item as any).task

    task.channel = 'function'
    task.method = 'announce'

    if (!task.data || typeof task.data !== 'object') {
      task.data = {}
    }

    if (!task.data.color) {
      task.data.color = 'primary'
    }
  },
}
</script>
