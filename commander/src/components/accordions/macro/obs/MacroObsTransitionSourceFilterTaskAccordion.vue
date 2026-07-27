<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-transition"
    :title="$t('macro.obs.transitionSourceFilter.title')"
    export-prefix="macro_obs_transition_source_filter"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="4">
        <v-autocomplete
          :model-value="task.data.sourceName"
          :items="sourceOptions"
          :label="$t('macro.obs.fields.source')"
          prepend-inner-icon="mdi-import"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
          @update:model-value="selectSource"
        />
      </v-col>

      <v-col cols="12" md="5">
        <v-autocomplete
          :model-value="task.data.filterName"
          :items="filterOptions"
          :label="$t('macro.obs.fields.filterName')"
          prepend-inner-icon="mdi-filter"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
          :disabled="!task.data.sourceName"
          @update:model-value="selectFilter"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-number-input
          v-model="task.data.duration"
          :label="$t('macro.obs.transitionSourceFilter.duration')"
          prepend-inner-icon="mdi-timer-outline"
          variant="outlined"
          hide-details="auto"
          :min="0"
          :step="0.1"
          suffix="s"
        />
      </v-col>
    </v-row>

    <v-alert
      v-if="task.data.filterName && settingEntries.length === 0"
      type="warning"
      variant="tonal"
      density="compact"
      class="mt-4"
    >
      {{ $t('macro.obs.transitionSourceFilter.noSettings') }}
    </v-alert>

    <v-alert
      v-if="task.data.filterName"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-4"
    >
      {{ $t('macro.obs.transitionSourceFilter.inputHint') }}
    </v-alert>

    <v-expansion-panels
      v-if="task.data.filterName"
      variant="accordion"
      multiple
      class="mt-4"
    >
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start icon="mdi-play" />
          {{ $t('macro.obs.transitionSourceFilter.start') }}
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <v-row density="comfortable">
            <v-col
              v-for="setting in settingEntries"
              :key="`start-${setting.key}`"
              cols="12"
            >
              <v-switch
                v-if="setting.type === 'boolean'"
                v-model="task.data.start[setting.key]"
                :label="setting.label"
                color="primary"
                hide-details="auto"
              />

              <v-number-input
                v-else-if="setting.type === 'number'"
                v-model="task.data.start[setting.key]"
                :label="setting.label"
                variant="outlined"
                hide-details="auto"
                :step="numberStep(setting.value)"
              />

              <v-textarea
                v-else-if="setting.type === 'object'"
                :model-value="getComplexValue('start', setting.key)"
                :label="setting.label"
                prepend-inner-icon="mdi-code-json"
                variant="outlined"
                hide-details="auto"
                rows="4"
                auto-grow
                spellcheck="false"
                @update:model-value="setComplexDraft('start', setting.key, $event)"
                @blur="applyComplexValue('start', setting.key)"
              />

              <v-text-field
                v-else
                v-model="task.data.start[setting.key]"
                :label="setting.label"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start icon="mdi-stop" />
          {{ $t('macro.obs.transitionSourceFilter.end') }}
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <v-row density="comfortable">
            <v-col
              v-for="setting in settingEntries"
              :key="`end-${setting.key}`"
              cols="12"
            >
              <v-switch
                v-if="setting.type === 'boolean'"
                v-model="task.data.end[setting.key]"
                :label="setting.label"
                color="primary"
                hide-details="auto"
              />

              <v-number-input
                v-else-if="setting.type === 'number'"
                v-model="task.data.end[setting.key]"
                :label="setting.label"
                variant="outlined"
                hide-details="auto"
                :step="numberStep(setting.value)"
              />

              <v-textarea
                v-else-if="setting.type === 'object'"
                :model-value="getComplexValue('end', setting.key)"
                :label="setting.label"
                prepend-inner-icon="mdi-code-json"
                variant="outlined"
                hide-details="auto"
                rows="4"
                auto-grow
                spellcheck="false"
                @update:model-value="setComplexDraft('end', setting.key, $event)"
                @blur="applyComplexValue('end', setting.key)"
              />

              <v-text-field
                v-else
                v-model="task.data.end[setting.key]"
                :label="setting.label"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import {
  cloneObsValue,
  getFilterNames,
  getFilterSettings,
  getInputNames,
} from './obsTaskHelpers'

type TransitionSide = 'start' | 'end'

interface SettingEntry {
  key: string
  label: string
  type: 'boolean' | 'number' | 'string' | 'object'
  value: any
}

function isRecord(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneSettings(value: any): Record<string, any> {
  return isRecord(value) ? cloneObsValue(value) : {}
}

function hasSettings(value: any): boolean {
  return isRecord(value) && Object.keys(value).length > 0
}

function humanizeSettingKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase())
}

function getSettingType(value: any): SettingEntry['type'] {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  return 'object'
}

function stringifyComplexValue(value: any): string {
  return JSON.stringify(value, null, 2)
}

export default {
  name: 'MacroObsTransitionSourceFilterTaskAccordion',

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
      complexDrafts: {} as Record<string, string>,
    }
  },

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'obs'
      task.method = 'transition_source_filter'
      task.data = isRecord(task.data) ? task.data : {}

      if (task.data.sourceName === undefined) task.data.sourceName = ''
      if (task.data.filterName === undefined) task.data.filterName = ''
      if (task.data.duration === undefined) task.data.duration = 1
      if (!isRecord(task.data.start)) task.data.start = {}
      if (!isRecord(task.data.end)) task.data.end = {}

      return task
    },

    obsSceneData(): any[] {
      return this.appStore.getObsSceneData ?? []
    },

    sourceOptions(): string[] {
      return getInputNames(this.obsSceneData, this.appStore.getObsAudioData)
    },

    filterOptions(): string[] {
      return getFilterNames(this.obsSceneData, this.task.data.sourceName)
    },

    obsFilterSettings(): Record<string, any> {
      return getFilterSettings(
        this.obsSceneData,
        this.task.data.sourceName,
        this.task.data.filterName,
      )
    },

    settingEntries(): SettingEntry[] {
      const settings = {
        ...cloneSettings(this.task.data.start),
        ...cloneSettings(this.task.data.end),
        ...cloneSettings(this.obsFilterSettings),
      }

      return Object.entries(settings)
        .map(([key, value]) => ({
          key,
          label: humanizeSettingKey(key),
          type: getSettingType(value),
          value,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    },
  },

  watch: {
    obsFilterSettings: {
      deep: true,
      handler() {
        this.seedSettingsFromObs(false)
      },
    },
  },

  created() {
    this.task
    this.seedSettingsFromObs(false)
  },

  methods: {
    selectSource(sourceName: string | null) {
      const nextSourceName = sourceName ?? ''

      if (nextSourceName === this.task.data.sourceName) return

      this.task.data.sourceName = nextSourceName
      this.task.data.filterName = ''
      this.task.data.start = {}
      this.task.data.end = {}
      this.complexDrafts = {}
    },

    selectFilter(filterName: string | null) {
      const nextFilterName = filterName ?? ''

      if (nextFilterName === this.task.data.filterName) return

      this.task.data.filterName = nextFilterName
      this.task.data.start = {}
      this.task.data.end = {}
      this.complexDrafts = {}

      if (!nextFilterName) return

      this.$nextTick(() => {
        this.seedSettingsFromObs(true)
      })
    },

    seedSettingsFromObs(force: boolean) {
      const settings = cloneSettings(this.obsFilterSettings)
      if (!hasSettings(settings)) return

      if (force || !hasSettings(this.task.data.start)) {
        this.task.data.start = cloneSettings(settings)
      } else {
        this.addMissingSettings(this.task.data.start, settings)
      }

      if (force || !hasSettings(this.task.data.end)) {
        this.task.data.end = cloneSettings(settings)
      } else {
        this.addMissingSettings(this.task.data.end, settings)
      }

      this.removeUnavailableDrafts()
    },

    addMissingSettings(target: Record<string, any>, settings: Record<string, any>) {
      for (const [key, value] of Object.entries(settings)) {
        if (target[key] === undefined) {
          target[key] = cloneObsValue(value)
        }
      }
    },

    removeUnavailableDrafts() {
      const availableKeys = new Set(this.settingEntries.map((setting) => setting.key))

      for (const draftKey of Object.keys(this.complexDrafts)) {
        const settingKey = draftKey.substring(draftKey.indexOf(':') + 1)
        if (!availableKeys.has(settingKey)) delete this.complexDrafts[draftKey]
      }
    },

    numberStep(value: number): number {
      return Number.isInteger(value) ? 1 : 0.01
    },

    complexDraftKey(side: TransitionSide, key: string): string {
      return `${side}:${key}`
    },

    getComplexValue(side: TransitionSide, key: string): string {
      const draftKey = this.complexDraftKey(side, key)

      if (this.complexDrafts[draftKey] !== undefined) {
        return this.complexDrafts[draftKey]
      }

      return stringifyComplexValue(this.task.data[side][key])
    },

    setComplexDraft(side: TransitionSide, key: string, value: string) {
      this.complexDrafts[this.complexDraftKey(side, key)] = value
    },

    applyComplexValue(side: TransitionSide, key: string) {
      const draftKey = this.complexDraftKey(side, key)
      const draft = this.complexDrafts[draftKey]

      if (draft === undefined) return

      try {
        this.task.data[side][key] = JSON.parse(draft)
        this.complexDrafts[draftKey] = stringifyComplexValue(this.task.data[side][key])
      } catch (_) {
        this.complexDrafts[draftKey] = stringifyComplexValue(this.task.data[side][key])
      }
    },
  },
}
</script>
