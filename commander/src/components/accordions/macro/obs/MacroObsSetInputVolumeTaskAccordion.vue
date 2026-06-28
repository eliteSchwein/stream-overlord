<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-volume-source"
    title="Set input volume"
    export-prefix="macro_obs_set_input_volume"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="data.inputName"
          :items="inputOptions"
          label="Input / source"
          prepend-inner-icon="mdi-import"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="data.inputVolumeDb"
          type="number"
          label="Volume dB"
          prepend-inner-icon="mdi-volume-high"
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
import { getInputNames } from './obsTaskHelpers'

export default {
  name: 'MacroObsSetInputVolumeTaskAccordion',

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

    inputOptions(): string[] {
      return getInputNames(this.appStore.getObsSceneData, this.appStore.getObsAudioData)
    },
  },

  created() {
    this.task.channel = 'obs'
    this.task.method = 'SetInputVolume'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}

    if (this.data.inputName === undefined) this.data.inputName = ''
    if (this.data.inputVolumeDb === undefined) this.data.inputVolumeDb = 0
  },
}
</script>
