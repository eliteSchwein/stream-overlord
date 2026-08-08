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
        <div class="flex-grow-1">
          <v-row density="compact">
            <v-col
              v-for="(caseInput, inputIndex) in caseItem.inputs"
              :key="`${caseItem.id}_input_${inputIndex}`"
              cols="12"
              md="6"
              lg="4"
            >
              <div class="d-flex align-center ga-2">
                <v-text-field
                  :model-value="caseInput"
                  :label="$t('macro.core.switch.caseInput')"
                  density="comfortable"
                  variant="outlined"
                  hide-details
                  @update:model-value="setCaseInput(caseItem, inputIndex, $event)"
                />

                <v-btn
                  v-if="caseItem.inputs.length > 1"
                  icon="mdi-minus-circle-outline"
                  variant="text"
                  size="small"
                  color="error"
                  :title="$t('macro.core.switch.removeCaseInput')"
                  @click="removeCaseInput(caseItem, inputIndex)"
                />
              </div>
            </v-col>
          </v-row>

          <v-btn
            size="small"
            prepend-icon="mdi-plus"
            variant="text"
            class="mt-1"
            @click="addCaseInput(caseItem)"
          >
            {{ $t('macro.core.switch.addCaseInput') }}
          </v-btn>
        </div>

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

    for (const caseItem of (this.item as any).cases) {
      if (!Array.isArray(caseItem.inputs) || caseItem.inputs.length === 0) {
        caseItem.inputs = [String(caseItem?.task?.data?.input ?? '')]
      }
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
        inputs: [''],
        children: [],
      })
    },

    addCaseInput(caseItem: any) {
      if (!Array.isArray(caseItem.inputs)) caseItem.inputs = []
      caseItem.inputs.push('')
    },

    removeCaseInput(caseItem: any, index: number) {
      if (!Array.isArray(caseItem.inputs) || caseItem.inputs.length <= 1) return
      caseItem.inputs.splice(index, 1)
      this.syncCaseTask(caseItem)
    },

    setCaseInput(caseItem: any, index: number, value: unknown) {
      if (!Array.isArray(caseItem.inputs)) caseItem.inputs = ['']
      caseItem.inputs[index] = String(value ?? '')
      this.syncCaseTask(caseItem)
    },

    syncCaseTask(caseItem: any) {
      caseItem.task ??= { channel: 'switch', method: 'case', data: {} }
      caseItem.task.data ??= {}
      caseItem.task.data.input = String(caseItem.inputs?.[0] ?? '')
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
