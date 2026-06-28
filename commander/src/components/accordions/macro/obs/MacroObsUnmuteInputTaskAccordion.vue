<template>
  <v-expansion-panel class="macro-obs-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-volume-high" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">Unmute input</span>
        <v-spacer />
        <v-chip size="x-small" color="primary" variant="tonal">{{ task.method }}</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row density="comfortable">
        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="task.data.inputName"
            :items="inputOptions"
            label="Input / source"
            prepend-inner-icon="mdi-import"
            variant="outlined"
            hide-details="auto"
            clearable
            auto-select-first
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
import { getInputNames } from './obsTaskHelpers'

export default {
  name: 'MacroObsUnmuteInputTaskAccordion',

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
      task.method = 'SetInputMute'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.inputName === undefined) task.data.inputName = ''
      task.data.inputMuted = false

      return task
    },

    inputOptions(): string[] {
      return getInputNames(this.appStore.getObsSceneData, this.appStore.getObsAudioData)
    },
  },

  created() {
    this.task
  },
}
</script>
