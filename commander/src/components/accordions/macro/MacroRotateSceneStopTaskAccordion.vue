<template>
  <MacroTaskAccordionTemplate
    class="macro-rotate-scene-stop-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-stop-circle-outline"
    title="Stop rotating scene"
    export-prefix="macro_rotate_scene_stop"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
      text="Stops the currently running rotating scene."
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroRotateSceneStopTaskAccordion',

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
      const task = (this.item as any).task

      task.channel = 'rotate_scene'
      task.method = 'stop'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      delete task.data.name
      delete task.data.rotateScene
      delete task.data.rotatingScene

      return task
    },
  },

  created() {
    this.task
  },
}
</script>
