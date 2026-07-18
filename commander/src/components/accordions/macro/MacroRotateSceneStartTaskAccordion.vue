<template>
  <MacroTaskAccordionTemplate
    class="macro-rotate-scene-start-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-play-circle-outline"
    :title="$t('macro.final.rotateSceneStart.startRotatingScene')"
    export-prefix="macro_rotate_scene_start"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <RotatingSceneSelect v-model="data.name" :label="$t('macro.final.rotateSceneStart.rotatingScene')" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'
import RotatingSceneSelect from './RotatingSceneSelect.vue'

export default {
  name: 'MacroRotateSceneStartTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
    RotatingSceneSelect,
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
      task.method = 'start'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.name === undefined) {
        task.data.name = task.data.rotateScene ?? task.data.rotatingScene ?? ''
      }

      delete task.data.rotateScene
      delete task.data.rotatingScene

      return task
    },

    data(): any {
      return this.task.data
    },
  },

  created() {
    this.task
  },
}
</script>
