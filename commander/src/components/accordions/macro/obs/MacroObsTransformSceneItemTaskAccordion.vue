<template>
  <v-expansion-panel class="macro-obs-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-vector-square" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" color="primary" variant="tonal">SetSceneItemTransform</v-chip>
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

        <v-col cols="12" md="3"><v-text-field v-model.number="data.sceneItemTransform.positionX" type="number" label="X" variant="outlined" hide-details="auto" /></v-col>
        <v-col cols="12" md="3"><v-text-field v-model.number="data.sceneItemTransform.positionY" type="number" label="Y" variant="outlined" hide-details="auto" /></v-col>
        <v-col cols="12" md="3"><v-text-field v-model.number="data.sceneItemTransform.scaleX" type="number" label="Scale X" variant="outlined" hide-details="auto" /></v-col>
        <v-col cols="12" md="3"><v-text-field v-model.number="data.sceneItemTransform.scaleY" type="number" label="Scale Y" variant="outlined" hide-details="auto" /></v-col>
        <v-col cols="12" md="3"><v-text-field v-model.number="data.sceneItemTransform.rotation" type="number" label="Rotation" variant="outlined" hide-details="auto" /></v-col>
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
  name: 'MacroObsTransformSceneItemTaskAccordion',

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
      return 'Transform scene item'
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
    this.task.method = 'SetSceneItemTransform'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
      if (this.data.sceneName === undefined) this.data.sceneName = ''
      if (this.data.sceneItemId === undefined) this.data.sceneItemId = null
      if (!this.data.sceneItemTransform || typeof this.data.sceneItemTransform !== 'object') this.data.sceneItemTransform = { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0 }
  },
}
</script>
