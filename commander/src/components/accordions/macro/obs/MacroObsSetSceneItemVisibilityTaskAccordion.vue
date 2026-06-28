<template>
  <MacroTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row dense>
      <v-col cols="12" md="4">
        <v-autocomplete v-model="obsData.sceneName" :items="sceneNames" label="Scene" clearable hide-details="auto" prepend-inner-icon="mdi-view-dashboard" variant="outlined" density="comfortable" />
      </v-col>
      <v-col cols="12" md="4">
        <v-autocomplete v-model="obsData.sourceName" :items="sceneItemNames" label="Scene item / source" clearable hide-details="auto" prepend-inner-icon="mdi-eye" variant="outlined" density="comfortable" />
      </v-col>
      <v-col cols="12" md="4">
        <v-select v-model="obsData.sceneItemEnabled" :items="booleanItems" label="Visibility" hide-details="auto" variant="outlined" density="comfortable" />
      </v-col>
    </v-row>
  </MacroTaskAccordion>
</template>

<script lang="ts">
import MacroTaskAccordion from '../MacroTaskAccordion.vue'
import { ensureObsTask, obsStoreMixin, OBS_BOOLEAN_ITEMS } from './obsTaskHelpers'

export default {
  name: 'MacroObsSetSceneItemVisibilityTaskAccordion',
  components: { MacroTaskAccordion },
  mixins: [obsStoreMixin()],
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    booleanItems(): any[] { return OBS_BOOLEAN_ITEMS },
  },
  created() {
    ensureObsTask(this.item, 'SetSceneItemEnabled', { sceneItemEnabled: true })
  },
}
</script>
