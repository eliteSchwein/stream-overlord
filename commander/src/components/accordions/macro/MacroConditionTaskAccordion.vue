<template>
  <MacroTaskAccordionTemplate
    class="macro-condition-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-source-branch"
    :title="'If: ' + (item.task?.check || 'empty condition')"
    export-prefix="macro_condition"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field
      v-model="conditionCheck"
      label="Condition"
      density="comfortable"
      variant="outlined"
      hide-details
      class="mb-3"
    />

    <div class="text-caption text-medium-emphasis mb-2">
      Then
    </div>

    <component
      :is="taskListComponent"
      :items="item.children"
      :depth="depth + 1"
      :inside-loop="insideLoop"
      nested
    />

    <div
      v-for="(branch, branchIndex) in item.branches"
      :key="branch.id"
      class="mt-4"
    >
      <div class="d-flex align-center mb-2">
        <v-select
          v-model="branch.task.method"
          :items="['else_if', 'else']"
          label="Branch"
          density="comfortable"
          variant="outlined"
          hide-details
          class="mr-2"
          style="max-width: 180px"
        />

        <v-text-field
          v-if="branch.task.method === 'else_if'"
          :model-value="getBranchCheck(branch)"
          label="Condition"
          @update:model-value="setBranchCheck(branch, $event)"
          density="comfortable"
          variant="outlined"
          hide-details
        />

        <v-spacer />

        <v-btn
          icon="mdi-delete"
          size="small"
          variant="text"
          color="error"
          @click="removeBranch(branchIndex)"
        />
      </div>

      <component
        :is="taskListComponent"
        :items="branch.children"
        :depth="depth + 1"
        :inside-loop="insideLoop"
        nested
      />
    </div>

    <div class="d-flex flex-wrap ga-2 mt-4">
      <v-btn
        size="small"
        prepend-icon="mdi-source-branch-plus"
        variant="tonal"
        @click="addElseIf"
      >
        Add else if
      </v-btn>

      <v-btn
        size="small"
        prepend-icon="mdi-source-branch"
        variant="tonal"
        @click="addElse"
      >
        Add else
      </v-btn>
    </div>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroConditionTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    taskListComponent: { type: [Object, Function, String], required: true },
    insideLoop: { type: Boolean, default: false },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      return (this.item as any).task
    },

    conditionCheck: {
      get(): string {
        return String((this.item as any).task?.check ?? '')
      },
      set(value: unknown) {
        ;(this.item as any).task.check = String(value ?? '')
      },
    },
  },

  created() {
    if (!Array.isArray((this.item as any).branches)) {
      ;(this.item as any).branches = []
    }

    if (!Array.isArray((this.item as any).children)) {
      ;(this.item as any).children = []
    }

    ;(this.item as any).task.check = String((this.item as any).task?.check ?? '')

    for (const branch of (this.item as any).branches) {
      if (branch?.task?.method === 'else_if') {
        branch.task.check = String(branch.task.check ?? '')
      }
    }
  },

  methods: {
    getBranchCheck(branch: any): string {
      return String(branch?.task?.check ?? '')
    },

    setBranchCheck(branch: any, value: unknown) {
      if (!branch.task) branch.task = {}
      branch.task.check = String(value ?? '')
    },

    uid() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`
    },

    addElseIf() {
      ;(this.item as any).branches.push({
        id: this.uid(),
        task: {
          channel: 'condition',
          method: 'else_if',
          check: '',
        },
        children: [],
      })
    },

    addElse() {
      ;(this.item as any).branches.push({
        id: this.uid(),
        task: {
          channel: 'condition',
          method: 'else',
        },
        children: [],
      })
    },

    removeBranch(index: number) {
      ;(this.item as any).branches.splice(index, 1)
    },
  },
}
</script>
