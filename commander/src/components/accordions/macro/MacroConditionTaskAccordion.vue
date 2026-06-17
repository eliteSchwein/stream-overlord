<template>
  <v-expansion-panel class="macro-condition-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-source-branch" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">If: {{ item.task.check || 'empty condition' }}</span>
        <v-spacer />
        <v-chip size="x-small" color="primary" variant="tonal">condition</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-text-field
        v-model="item.task.check"
        label="Condition"
        density="comfortable"
        variant="outlined"
        hide-details
        class="mb-3"
      />

      <div class="text-caption text-medium-emphasis mb-2">Then</div>
      <component :is="taskListComponent" :items="item.children" :depth="depth + 1" nested />

      <div v-for="(branch, branchIndex) in item.branches" :key="branch.id" class="mt-4">
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
            v-model="branch.task.check"
            label="Condition"
            density="comfortable"
            variant="outlined"
            hide-details
          />

          <v-spacer />
          <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeBranch(branchIndex)" />
        </div>

        <component :is="taskListComponent" :items="branch.children" :depth="depth + 1" nested />
      </div>

      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-btn size="small" prepend-icon="mdi-source-branch-plus" variant="tonal" @click="addElseIf">Add else if</v-btn>
        <v-btn size="small" prepend-icon="mdi-source-branch" variant="tonal" @click="addElse">Add else</v-btn>
        <v-spacer />
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
export default {
  name: 'MacroConditionTaskAccordion',

  props: {
    item: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
    taskListComponent: {
      type: [Object, Function, String],
      required: true,
    },
  },

  emits: ['remove', 'move-up', 'move-down'],

  methods: {
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
