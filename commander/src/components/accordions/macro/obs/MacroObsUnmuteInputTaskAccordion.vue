<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-volume-high"
    :title="$t('macro.obs.unmuteInput.title')"
    export-prefix="macro_obs_unmute_input"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="task.data.inputName"
          :items="inputOptions"
          :label="$t('macro.obs.fields.inputSource')"
          prepend-inner-icon="mdi-import"
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
import { getInputNames } from './obsTaskHelpers'

export default {
  name: 'MacroObsUnmuteInputTaskAccordion',

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
      task.method = 'SetInputMute'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.inputName === undefined) {
        task.data.inputName = ''
      }

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
