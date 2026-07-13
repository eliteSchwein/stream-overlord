<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-movie-open-play"
    title="Random clip"
    export-prefix="macro_twitch_random_clip"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
      class="mb-4"
    >
      This task uses <strong>streamgood.gg</strong> to load and play Twitch clips.
    </v-alert>

    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.data.channel"
          variant="outlined"
          label="Twitch channel"
          placeholder="Leave empty for the primary channel"
          hint="Supports template variables."
          persistent-hint
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-select
          v-model="task.data.mode"
          :items="modeItems"
          variant="outlined"
          label="Mode"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-select
          v-model.number="task.data.recent_clips"
          :items="recentClipItems"
          variant="outlined"
          label="Recent clips"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-slider
          v-model="task.data.max_length"
          min="5"
          max="60"
          step="1"
          label="Maximum clip length"
          thumb-label="always"
          hide-details
        />
        <div class="text-caption text-medium-emphasis mt-1">
          {{ task.data.max_length }} seconds
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <v-radio-group
          v-model="task.data.filter_long_videos"
          label="Clips longer than the maximum"
          inline
          hide-details
        >
          <v-radio :value="true" label="Filter out clips" />
          <v-radio :value="false" label="Stop clips early" />
        </v-radio-group>
      </v-col>

      <v-col cols="12"><v-divider /></v-col>
      <v-col cols="12" md="6">
        <v-switch
          v-model="task.data.info"
          color="primary"
          label="Show information overlay"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-switch
          v-model="task.data.show_timer"
          color="primary"
          label="Show timer"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-slider
          v-model="task.data.volume"
          min="0"
          max="100"
          step="1"
          label="Volume"
          thumb-label="always"
          hide-details
        />
        <div class="text-caption text-medium-emphasis mt-1">
          {{ task.data.volume }}%
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="task.data.playback_seconds"
          variant="outlined"
          type="number"
          min="5"
          max="300"
          label="Overlay duration (seconds)"
          hint="How long the clip player remains visible."
          persistent-hint
        />
      </v-col>

      <v-col cols="12">
        <v-text-field
          v-model="task.data.variable"
          variant="outlined"
          label="Result variable"
          placeholder="random_clip"
          hint="Stores the generated URL, channel and playback duration."
          persistent-hint
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchRandomClipTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  data() {
    return {
      modeItems: [
        { title: 'Random', value: 'random' },
        { title: 'Top', value: 'top' },
      ],
      recentClipItems: [
        { title: 'All time', value: 0 },
        { title: 'Last 7 days', value: 7 },
        { title: 'Last 30 days', value: 30 },
        { title: 'Last 6 months', value: 180 },
        { title: 'Last year', value: 365 },
      ],
    }
  },
  computed: {
    task(): any {
      return (this.item as any).task
    },
  },
  created() {
    this.task.channel = 'twitch'
    this.task.method = 'random_clip'
    this.task.data = this.task.data && typeof this.task.data === 'object'
      ? this.task.data
      : {}

    this.task.data.channel ??= ''
    this.task.data.mode ??= 'random'
    this.task.data.recent_clips ??= 0
    this.task.data.max_length ??= 60
    this.task.data.filter_long_videos ??= false
    this.task.data.info ??= false
    this.task.data.show_timer ??= false
    this.task.data.volume ??= 50
    this.task.data.playback_seconds ??= 60
    this.task.data.variable ??= 'random_clip'
  },
}
</script>
