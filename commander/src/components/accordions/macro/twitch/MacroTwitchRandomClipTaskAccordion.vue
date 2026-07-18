<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-movie-open-play"
    :title="$t('macro.twitch.randomClip.title')"
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
      <i18n-t keypath="macro.twitch.randomClip.serviceInfo" tag="span"><template #service><strong>streamgood.gg</strong></template></i18n-t>
    </v-alert>

    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.data.channel"
          variant="outlined"
          :label="$t('macro.twitch.fields.twitchChannel')"
          :placeholder="$t('macro.twitch.randomClip.primaryChannelPlaceholder')"
          :hint="$t('macro.twitch.randomClip.templateVariablesHint')"
          persistent-hint
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-select
          v-model="task.data.mode"
          :items="modeItems"
          variant="outlined"
          :label="$t('macro.twitch.fields.mode')"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-select
          v-model.number="task.data.recent_clips"
          :items="recentClipItems"
          variant="outlined"
          :label="$t('macro.twitch.randomClip.recentClips')"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-slider
          v-model="task.data.max_length"
          min="5"
          max="60"
          step="1"
          :label="$t('macro.twitch.randomClip.maximumClipLength')"
          thumb-label="always"
          hide-details
        />
        <div class="text-caption text-medium-emphasis mt-1">
          {{ $t('macro.twitch.randomClip.seconds', { count: task.data.max_length }) }}
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <v-radio-group
          v-model="task.data.filter_long_videos"
          :label="$t('macro.twitch.randomClip.longClipBehavior')"
          inline
          hide-details
        >
          <v-radio :value="true" :label="$t('macro.twitch.randomClip.filterOutClips')" />
          <v-radio :value="false" :label="$t('macro.twitch.randomClip.stopClipsEarly')" />
        </v-radio-group>
      </v-col>

      <v-col cols="12"><v-divider /></v-col>
      <v-col cols="12" md="6">
        <v-switch
          v-model="task.data.info"
          color="primary"
          :label="$t('macro.twitch.randomClip.showInformationOverlay')"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-switch
          v-model="task.data.show_timer"
          color="primary"
          :label="$t('macro.twitch.randomClip.showTimer')"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-slider
          v-model="task.data.volume"
          min="0"
          max="100"
          step="1"
          :label="$t('macro.twitch.fields.volume')"
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
          :label="$t('macro.twitch.randomClip.overlayDurationSeconds')"
          :hint="$t('macro.twitch.randomClip.overlayDurationHint')"
          persistent-hint
        />
      </v-col>

      <v-col cols="12">
        <v-text-field
          v-model="task.data.variable"
          variant="outlined"
          :label="$t('macro.twitch.fields.resultVariable')"
          :placeholder="$t('macro.twitch.placeholders.randomClipVariable')"
          :hint="$t('macro.twitch.randomClip.resultHint')"
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
  computed: {
    task(): any {
      return (this.item as any).task
    },
    modeItems(): Array<{ title: string; value: string }> {
      return [
        { title: String(this.$t('macro.twitch.randomClip.modes.random')), value: 'random' },
        { title: String(this.$t('macro.twitch.randomClip.modes.top')), value: 'top' },
      ]
    },
    recentClipItems(): Array<{ title: string; value: number }> {
      return [
        { title: String(this.$t('macro.twitch.randomClip.periods.allTime')), value: 0 },
        { title: String(this.$t('macro.twitch.randomClip.periods.last7Days')), value: 7 },
        { title: String(this.$t('macro.twitch.randomClip.periods.last30Days')), value: 30 },
        { title: String(this.$t('macro.twitch.randomClip.periods.last6Months')), value: 180 },
        { title: String(this.$t('macro.twitch.randomClip.periods.lastYear')), value: 365 },
      ]
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
