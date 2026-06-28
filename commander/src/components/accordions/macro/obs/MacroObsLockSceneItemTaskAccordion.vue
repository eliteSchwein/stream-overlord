<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-lock"
    title="Lock scene item"
    export-prefix="macro_obs_lock_scene_item"
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

      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="data.sceneItemId"
          :items="sceneItemOptions"
          item-title="title"
          item-value="value"
          label="Scene item"
          prepend-inner-icon="mdi-layers-outline"
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
import { getSceneItemOptions, getSceneNames } from './obsTaskHelpers'

export default {
  name: 'MacroObsLockSceneItemTaskAccordion',

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
      task.method = 'SetSceneItemLocked'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.sceneName === undefined) task.data.sceneName = ''
      if (task.data.sceneItemId === undefined) task.data.sceneItemId = null

      task.data.sceneItemLocked = true

      return task
    },

    data(): any {
      return this.task.data
    },

    sceneOptions(): string[] {
      return getSceneNames(this.appStore.getObsSceneData)
    },

    sceneItemOptions(): any[] {
      return getSceneItemOptions(this.appStore.getObsSceneData, this.data.sceneName)
    },
  },

  created() {
    this.task
  },
}
</script>
