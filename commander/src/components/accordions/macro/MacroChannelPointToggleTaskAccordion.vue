<template>
  <v-expansion-panel class="macro-channel-point-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-toggle-switch-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" color="primary" variant="tonal">{{ task.method }}</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-alert
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-4"
        text="Enables, disables, or sets the enabled state of a Twitch channel point reward. If no name is set, a channel point redemption macro can use the current reward."
      />

      <v-row density="comfortable">
        <v-col cols="12" md="6">
          <v-select
            v-model="task.method"
            :items="methodOptions"
            item-title="title"
            item-value="value"
            label="Enabled action"
            prepend-inner-icon="mdi-toggle-switch-outline"
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

        <v-col v-if="task.method === 'toggle'" cols="12" md="6">
          <v-select
            v-model="task.data.state"
            :items="stateOptions"
            item-title="title"
            item-value="value"
            label="Enabled state"
            hint="Required for backend method toggle"
            persistent-hint
            prepend-inner-icon="mdi-toggle-switch"
            variant="outlined"
            hide-details="auto"
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
  name: 'MacroChannelPointToggleTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      appStore: useAppStore(),
      methodOptions: [
        { title: 'Enable reward', value: 'enable' },
        { title: 'Disable reward', value: 'disable' },
        { title: 'Set enabled state', value: 'toggle' },
      ],
      stateOptions: [
        { title: 'Enabled', value: 'enable' },
        { title: 'Disabled', value: 'disable' },
      ],
    }
  },

  computed: {
    task(): any {
      const task = (this.item as any).task
      task.channel = 'channel_point'

      if (!['enable', 'disable', 'toggle'].includes(task.method)) {
        task.method = 'enable'
      }

      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.method === 'toggle' && task.data.state === undefined) {
        task.data.state = 'enable'
      }

      return task
    },

    title(): string {
      switch (this.task.method) {
        case 'disable':
          return 'Disable channel point reward'
        case 'toggle':
          return 'Set channel point enabled state'
        case 'enable':
        default:
          return 'Enable channel point reward'
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
