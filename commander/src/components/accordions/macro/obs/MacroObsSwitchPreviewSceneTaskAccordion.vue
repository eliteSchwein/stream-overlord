<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-monitor-eye"
    :title="title"
    export-prefix="macro_obs_switch_preview_scene"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="data.sceneUuid"
          :items="sceneOptions"
          item-title="title"
          item-value="value"
          label="Scene"
          prepend-inner-icon="mdi-view-dashboard"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import { getSceneOptions, migrateSceneNameToSceneUuid } from './obsTaskHelpers'

export default {
  name: 'MacroObsSwitchPreviewSceneTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      appStore: useAppStore(),
    }
  },

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'obs'
      task.method = 'SetCurrentPreviewScene'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.sceneUuid === undefined) task.data.sceneUuid = ''

      migrateSceneNameToSceneUuid(task.data, this.appStore.getObsSceneData)

      return task
    },

    data(): any {
      return this.task.data
    },

    title(): string {
      return 'Switch preview scene'
    },

    sceneOptions(): any[] {
      return getSceneOptions(this.appStore.getObsSceneData)
    },
  },

  watch: {
    'appStore.getObsSceneData': {
      handler() {
        migrateSceneNameToSceneUuid(this.data, this.appStore.getObsSceneData)
      },
      deep: true,
    },
  },

  created() {
    this.task
  },
}
</script>
