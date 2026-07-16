<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-volume-mute"
    :title="$t('macro.obs.setInputMute.title')"
    export-prefix="macro_obs_set_input_mute"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="obsData.inputName"
          :items="inputNames"
          :label="$t('macro.obs.fields.inputSource')"
          clearable
          hide-details="auto"
          prepend-inner-icon="mdi-import"
          variant="outlined"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-select
          v-model="obsData.inputMuted"
          :items="booleanItems"
          :label="$t('macro.obs.fields.muted')"
          hide-details="auto"
          variant="outlined"
          density="comfortable"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import { ensureObsTask, getObsBooleanItems, obsStoreMixin } from './obsTaskHelpers'

export default {
  name: 'MacroObsSetInputMuteTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  mixins: [obsStoreMixin()],

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    booleanItems(): any[] {
      return getObsBooleanItems(this.$t)
    },
  },

  created() {
    ensureObsTask(this.item, 'SetInputMute', { inputMuted: true })
  },
}
</script>
