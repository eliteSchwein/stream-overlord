<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-vector-square"
    :title="title"
    export-prefix="macro_obs_transform_scene_item"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="data.sceneName"
          :items="sceneOptions"
          :label="$t('macro.obs.fields.scene')"
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
          item-:title="$t('macro.obs.transformSceneItem.title')"
          item-value="value"
          :label="$t('macro.obs.fields.sceneItem')"
          prepend-inner-icon="mdi-layers-outline"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-text-field
          v-model.number="data.sceneItemTransform.positionX"
          type="number"
          :label="$t('macro.obs.fields.positionX')"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-text-field
          v-model.number="data.sceneItemTransform.positionY"
          type="number"
          :label="$t('macro.obs.fields.positionY')"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-text-field
          v-model.number="data.sceneItemTransform.scaleX"
          type="number"
          :label="$t('macro.obs.fields.scaleX')"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-text-field
          v-model.number="data.sceneItemTransform.scaleY"
          type="number"
          :label="$t('macro.obs.fields.scaleY')"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-text-field
          v-model.number="data.sceneItemTransform.rotation"
          type="number"
          :label="$t('macro.obs.fields.rotation')"
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
  name: 'MacroObsTransformSceneItemTaskAccordion',

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
      return String(this.$t('macro.obs.transformSceneItem.title'))
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
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}

    if (this.data.sceneName === undefined) this.data.sceneName = ''
    if (this.data.sceneItemId === undefined) this.data.sceneItemId = null

    if (!this.data.sceneItemTransform || typeof this.data.sceneItemTransform !== 'object') {
      this.data.sceneItemTransform = {}
    }

    this.data.sceneItemTransform.positionX ??= 0
    this.data.sceneItemTransform.positionY ??= 0
    this.data.sceneItemTransform.scaleX ??= 1
    this.data.sceneItemTransform.scaleY ??= 1
    this.data.sceneItemTransform.rotation ??= 0
  },
}
</script>
