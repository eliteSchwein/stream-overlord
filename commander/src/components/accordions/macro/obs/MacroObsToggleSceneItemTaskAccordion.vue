<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-eye-sync"
    :title="$t('macro.obs.toggleSceneItem.title')"
    export-prefix="macro_obs_toggle_scene_item"
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
          :label="$t('macro.obs.fields.scene')"
          prepend-inner-icon="mdi-view-dashboard"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
          @update:model-value="onSceneChanged"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="data.sceneItemId"
          :items="sceneItemOptions"
          item-title="title"
          item-value="value"
          :label="$t('macro.obs.fields.sceneItem')"
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
          :label="$t('macro.obs.fields.visibility')"
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
import { getSceneItemOptions, getSceneOptions, migrateSceneNameToSceneUuid } from './obsTaskHelpers'

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
      const task = (this.item as any).task

      task.channel = 'obs'
      task.method = 'SetSceneItemEnabled'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.sceneUuid === undefined) task.data.sceneUuid = ''
      if (task.data.sceneItemId === undefined) task.data.sceneItemId = null
      if (task.data.sceneItemEnabled === undefined) task.data.sceneItemEnabled = true

      migrateSceneNameToSceneUuid(task.data, this.appStore.getObsSceneData)

      return task
    },

    data(): any {
      return this.task.data
    },

    sceneOptions(): any[] {
      return getSceneOptions(this.appStore.getObsSceneData)
    },

    sceneItemOptions(): any[] {
      return getSceneItemOptions(this.appStore.getObsSceneData, this.data.sceneUuid)
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

  methods: {
    onSceneChanged() {
      this.data.sceneItemId = null
    },
  },
}
</script>
