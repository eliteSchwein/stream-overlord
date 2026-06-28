<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-eye-sync"
    title="Set scene item visibility"
    export-prefix="macro_obs_toggle_scene_item"
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

      <v-col cols="12" md="6">
        <v-select
          v-model="data.sceneItemEnabled"
          :items="enabledOptions"
          item-title="title"
          item-value="value"
          label="Visibility"
          prepend-inner-icon="mdi-eye"
          variant="outlined"
          hide-details="auto"
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
  name: 'MacroObsToggleSceneItemTaskAccordion',

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
      enabledOptions: [
        { title: 'Visible', value: true },
        { title: 'Hidden', value: false },
      ],
    }
  },

  computed: {
    task(): any {
      return (this.item as any).task
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
    this.task.channel = 'obs'
    this.task.method = 'SetSceneItemEnabled'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}

    if (this.data.sceneName === undefined) this.data.sceneName = ''
    if (this.data.sceneItemId === undefined) this.data.sceneItemId = null
    if (this.data.sceneItemEnabled === undefined) this.data.sceneItemEnabled = true
  },
}
</script>
