<template>
  <MacroTaskAccordionTemplate
    class="macro-channel-point-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-toggle-switch-outline"
    :title="title"
    export-prefix="macro_channel_point_toggle"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="comfortable"
      class="mb-4"
      :text="$t('macro.core.channelPointToggle.enablesDisablesOrSetsTheEnabledStateOfATwitchChannelPointRewardIfNoNameIsSetAChannelPointRedemptionMacroCanUseTheCurrentReward')"
    />

    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-select
          v-model="task.method"
          :items="methodOptions"
          item-title="title"
          item-value="value"
          :label="$t('macro.core.channelPointToggle.enabledAction')"
          prepend-inner-icon="mdi-toggle-switch-outline"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="task.data.name"
          :items="channelPointOptions"
          :label="$t('macro.core.channelPointToggle.channelPointName')"
          persistent-hint
          prepend-inner-icon="mdi-star-circle"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
          hide-no-data
        />
      </v-col>

      <v-col v-if="task.method === 'toggle'" cols="12" md="6">
        <v-select
          v-model="task.data.state"
          :items="stateOptions"
          item-title="title"
          item-value="value"
          :label="$t('macro.core.channelPointToggle.enabledState')"
          :hint="$t('macro.core.channelPointToggle.requiredForBackendMethodToggle')"
          persistent-hint
          prepend-inner-icon="mdi-toggle-switch"
          variant="outlined"
          hide-details="auto"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroChannelPointToggleTaskAccordion',

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
        { title: String(this.$t('macro.core.channelPointToggle.enableReward')), value: 'enable' },
        { title: String(this.$t('macro.core.channelPointToggle.disableReward')), value: 'disable' },
        { title: String(this.$t('macro.core.channelPointToggle.setEnabledState')), value: 'toggle' },
      ],
      stateOptions: [
        { title: String(this.$t('macro.core.channelPointToggle.enabled')), value: 'enable' },
        { title: String(this.$t('macro.core.channelPointToggle.disabled')), value: 'disable' },
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
