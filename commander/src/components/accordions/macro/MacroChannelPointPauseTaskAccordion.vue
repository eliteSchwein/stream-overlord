<template>
  <v-expansion-panel class="macro-channel-point-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-pause-circle-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" color="warning" variant="tonal">{{ task.method }}</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-alert
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-4"
        text="Pauses, unpauses, or sets the pause state of a Twitch channel point reward. If no name is set, a channel point redemption macro can use the current reward."
      />

      <v-row density="comfortable">
        <v-col cols="12" md="6">
          <v-select
            v-model="task.method"
            :items="methodOptions"
            item-title="title"
            item-value="value"
            label="Pause action"
            prepend-inner-icon="mdi-pause-circle-outline"
            variant="outlined"
            hide-details="auto"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="task.data.name"
            :items="channelPointOptions"
            label="Channel point name"
            persistent-hint
            prepend-inner-icon="mdi-star-circle"
            variant="outlined"
            hide-details="auto"
            clearable
            auto-select-first
          />
        </v-col>

        <v-col v-if="task.method === 'toggle_pause'" cols="12" md="6">
          <v-select
            v-model="task.data.state"
            :items="stateOptions"
            item-title="title"
            item-value="value"
            label="Pause state"
            hint="Leave empty behavior depends on backend fallback"
            persistent-hint
            prepend-inner-icon="mdi-toggle-switch-outline"
            variant="outlined"
            hide-details="auto"
            clearable
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

export default {
  name: 'MacroChannelPointPauseTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      appStore: useAppStore(),
      methodOptions: [
        { title: 'Pause reward', value: 'pause' },
        { title: 'Unpause reward', value: 'unpause' },
        { title: 'Set/toggle pause state', value: 'toggle_pause' },
      ],
      stateOptions: [
        { title: 'Paused', value: 'pause' },
        { title: 'Unpaused', value: 'unpause' },
      ],
    }
  },

  computed: {
    task(): any {
      const task = (this.item as any).task
      task.channel = 'channel_point'

      if (!['pause', 'unpause', 'toggle_pause'].includes(task.method)) {
        task.method = 'pause'
      }

      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      return task
    },

    title(): string {
      switch (this.task.method) {
        case 'unpause':
          return 'Unpause channel point reward'
        case 'toggle_pause':
          return 'Set channel point pause state'
        case 'pause':
        default:
          return 'Pause channel point reward'
      }
    },

    channelPointOptions(): string[] {
      const channelPoints = this.appStore.getChannelPoints ?? []

      return [...new Set((Array.isArray(channelPoints) ? channelPoints : [])
        .map((point: any) => point?.label ?? point?.name)
        .filter(Boolean)
        .map(String))]
        .sort((a, b) => a.localeCompare(b))
    },
  },

  created() {
    this.task
  },
}
</script>
