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
      <v-col cols="12" md="6">
        <v-autocomplete v-model="obsData.inputName" :items="inputNames" label="Input / source" clearable hide-details="auto" prepend-inner-icon="mdi-import" variant="outlined" density="comfortable" />
      </v-col>
      <v-col cols="12" md="6">
        <v-select v-model="obsData.inputMuted" :items="booleanItems" label="Muted" hide-details="auto" variant="outlined" density="comfortable" />
      </v-col>
    </v-row>
  </MacroTaskAccordion>
</template>

<script lang="ts">
import MacroTaskAccordion from '../MacroTaskAccordion.vue'
import { ensureObsTask, obsStoreMixin, OBS_BOOLEAN_ITEMS } from './obsTaskHelpers'

export default {
  name: 'MacroObsSetInputMuteTaskAccordion',
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
    ensureObsTask(this.item, 'SetInputMute', { inputMuted: true })
  },
}
</script>
