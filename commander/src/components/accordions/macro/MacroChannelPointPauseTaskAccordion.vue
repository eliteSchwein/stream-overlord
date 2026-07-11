<template>
  <MacroTaskAccordionTemplate
    class="macro-channel-point-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-pause-circle-outline"
    :title="title"
    export-prefix="macro_channel_point_pause"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
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
          hide-no-data
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
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroChannelPointPauseTaskAccordion',

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
      const channelPoints = this.appStore.channelPoints ?? {
        active: [],
        all: [],
      }

      const active = Array.isArray(channelPoints.active)
        ? channelPoints.active
        : []

      const all = Array.isArray(channelPoints.all)
        ? channelPoints.all
        : []

      return [...new Set([...active, ...all]
        .map((point: any) =>
          point?.label ??
          point?.name ??
          point?.title ??
          point?.reward?.title ??
          point?.reward?.name,
        )
        .filter(Boolean)
        .map((value: any) => String(value).trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
    },
  },

  created() {
    this.task
  },
}
</script>
