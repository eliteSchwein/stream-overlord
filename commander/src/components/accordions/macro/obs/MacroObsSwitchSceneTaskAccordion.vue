<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-monitor-screenshot"
    :title="title"
    export-prefix="macro_obs_switch_scene"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="data.sceneName"
          :items="sceneOptions"
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
import { getSceneNames } from './obsTaskHelpers'

export default {
  name: 'MacroObsSwitchSceneTaskAccordion',

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
      return (this.item as any).task
    },

    data(): any {
      return this.task.data
    },

    title(): string {
      return 'Switch scene'
    },

    sceneOptions(): string[] {
      return getSceneNames(this.appStore.getObsSceneData)
    },
  },

  created() {
    this.task.channel = 'obs'
    this.task.method = 'SetCurrentProgramScene'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}

    if (this.data.sceneName === undefined) {
      this.data.sceneName = ''
    }
  },
}
</script>
