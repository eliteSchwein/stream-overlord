<template>
  <v-expansion-panel class="macro-task-accordion macro-task-accordion--alert">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-bell-ring" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" variant="tonal">alert</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row density="comfortable">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="task.message"
            label="Message"
            density="comfortable"
            variant="outlined"
            hide-details="auto"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-switch
            v-model="task.speak"
            label="Speak"
            density="comfortable"
            color="primary"
            hide-details
          />
        </v-col>

        <v-col cols="12" md="4">
          <MacroAssetSelect
            v-model="task.asset"
            label="Asset"
          />
        </v-col>
      </v-row>

      <div class="d-flex justify-end ga-2 mt-2">
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import MacroAssetSelect from './MacroAssetSelect.vue'

export default {
  name: 'MacroAlertTaskAccordion',

  components: {
    MacroAssetSelect,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      return (this.item as any).task
    },

    title(): string {
      return `Alert: ${this.task.message || 'empty message'}`
    },
  },
}
</script>
