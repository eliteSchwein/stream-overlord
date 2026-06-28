<template>
  <v-expansion-panel class="macro-obs-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-eye-sync" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" color="primary" variant="tonal">SetSceneItemEnabled</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
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

      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-spacer />
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import { getSceneItemOptions, getSceneNames } from './obsTaskHelpers'

export default {
  name: 'MacroObsToggleSceneItemTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      appStore: useAppStore(),
      enabledOptions: [{ title: 'Visible', value: true }, { title: 'Hidden', value: false }],
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
      return 'Set scene item visibility'
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
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
      if (this.data.sceneName === undefined) this.data.sceneName = ''
      if (this.data.sceneItemId === undefined) this.data.sceneItemId = null
      if (this.data.sceneItemEnabled === undefined) this.data.sceneItemEnabled = true
  },
}
</script>
