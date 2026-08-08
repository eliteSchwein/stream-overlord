<template>
  <MacroTaskAccordionTemplate
    class="macro-switch-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-call-split"
    :title="$t('macro.core.switch.title') + ': ' + (switchData.input || '-')"
    export-prefix="macro_switch"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field
      v-model="switchData.input"
      :label="$t('macro.core.switch.input')"
      :hint="$t('macro.core.switch.inputHint')"
      density="comfortable"
      variant="outlined"
      hide-details="auto"
      class="mb-4"
    />

    <div
      v-for="(caseItem, caseIndex) in item.cases"
      :key="caseItem.id"
      :class="caseIndex > 0 ? 'mt-4' : ''"
    >
      <div class="d-flex align-center ga-2 mb-2">
        <v-text-field
          v-model="caseItem.task.data.input"
          :label="$t('macro.core.switch.caseInput')"
          density="comfortable"
          variant="outlined"
          hide-details
        />

        <v-btn
          icon="mdi-arrow-up"
          variant="text"
          size="small"
          :disabled="caseIndex === 0"
          @click="moveCase(caseIndex, -1)"
        />
        <v-btn
          icon="mdi-arrow-down"
          variant="text"
          size="small"
          :disabled="caseIndex === item.cases.length - 1"
          @click="moveCase(caseIndex, 1)"
        />
        <v-btn
          icon="mdi-delete-outline"
          variant="text"
          size="small"
          color="error"
          @click="removeCase(caseIndex)"
        />
      </div>

      <div class="text-caption text-medium-emphasis mb-2">
        {{ $t('macro.core.switch.caseTasks') }}
      </div>

      <component
        :is="taskListComponent"
        :items="caseItem.children"
        :depth="depth + 1"
        :inside-loop="insideLoop"
        inside-switch
        nested
      />
    </div>

    <div class="d-flex flex-wrap ga-2 mt-4">
      <v-btn
        size="small"
        prepend-icon="mdi-plus"
        variant="tonal"
        @click="addCase"
      >
        {{ $t('macro.core.switch.addCase') }}
      </v-btn>

      <v-btn
        v-if="!item.defaultBranch"
        size="small"
        prepend-icon="mdi-source-branch"
        variant="tonal"
        @click="addDefault"
      >
        {{ $t('macro.core.switch.addDefault') }}
      </v-btn>
    </div>

    <div v-if="item.defaultBranch" class="mt-4">
      <div class="d-flex align-center mb-2">
        <div class="text-caption text-medium-emphasis">
          {{ $t('macro.core.switch.default') }}
        </div>
        <v-spacer />
        <v-btn
          icon="mdi-delete-outline"
          size="small"
          variant="text"
          color="error"
          @click="removeDefault"
        />
      </div>

      <component
        :is="taskListComponent"
        :items="item.defaultBranch.children"
        :depth="depth + 1"
        :inside-loop="insideLoop"
        inside-switch
        nested
      />
    </div>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroSwitchTaskAccordion',

  components: { MacroTaskAccordionTemplate },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    taskListComponent: { type: [Object, Function, String], required: true },
    insideLoop: { type: Boolean, default: false },
  },

  emits: ['remove', 'move-up', 'move-down'],

  created() {
    const task = (this.item as any).task
    task.channel = 'switch'
    task.method = 'switch'
    task.data ??= {}
    task.data.input ??= ''

    if (!Array.isArray((this.item as any).cases)) {
      ;(this.item as any).cases = []
    }
  },

  computed: {
    switchData(): any {
      const task = (this.item as any).task
      task.data ??= {}
      return task.data
    },
  },

  methods: {
    uid() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`
    },

    addCase() {
      ;(this.item as any).cases.push({
        id: this.uid(),
        task: { channel: 'switch', method: 'case', data: { input: '' } },
        children: [],
      })
    },

    removeCase(index: number) {
      ;(this.item as any).cases.splice(index, 1)
    },

    moveCase(index: number, direction: number) {
      const cases = (this.item as any).cases as any[]
      const target = index + direction
      if (target < 0 || target >= cases.length) return

      const [entry] = cases.splice(index, 1)
      cases.splice(target, 0, entry)
    },

    addDefault() {
      ;(this.item as any).defaultBranch = {
        id: this.uid(),
        task: { channel: 'switch', method: 'default' },
        children: [],
      }
    },

    removeDefault() {
      ;(this.item as any).defaultBranch = undefined
    },
  },
}
</script>
