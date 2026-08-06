<template>
  <MacroTaskAccordionTemplate
    class="macro-loop-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-repeat"
    :title="'For: ' + (loopData.key || 'item')"
    export-prefix="macro_loop"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="4">
        <v-text-field
          v-model="loopData.key"
          :label="$t('macro.core.loop.key')"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="8">
        <v-btn-toggle
          v-model="loopMode"
          mandatory
          divided
          density="comfortable"
          variant="outlined"
        >
          <v-btn value="numbers" prepend-icon="mdi-counter">
            {{ $t('macro.core.loop.modes.numbers') }}
          </v-btn>
          <v-btn value="array" prepend-icon="mdi-code-brackets">
            {{ $t('macro.core.loop.modes.array') }}
          </v-btn>
        </v-btn-toggle>
      </v-col>

      <template v-if="loopMode === 'numbers'">
        <v-col cols="12" md="4">
          <v-text-field
            v-model.number="loopData.from"
            :label="$t('macro.core.loop.from')"
            type="number"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-text-field
            v-model.number="loopData.to"
            :label="$t('macro.core.loop.to')"
            type="number"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-text-field
            v-model.number="loopData.step"
            :label="$t('macro.core.loop.step')"
            type="number"
            density="comfortable"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
      </template>

      <template v-else>
        <v-col cols="12">
          <v-combobox
            v-model="loopValues"
            :label="$t('macro.core.loop.values')"
            :hint="$t('macro.core.loop.valuesHint')"
            multiple
            chips
            closable-chips
            clearable
            density="comfortable"
            variant="outlined"
            hide-details="auto"
            @keydown.enter.stop
            @blur="commitLoopValues"
          />
        </v-col>

        <v-col cols="12">
          <v-text-field
            v-model="loopData.data"
            :label="$t('macro.core.loop.dataVariablePath')"
            :hint="$t('macro.core.loop.dataVariablePathHint')"
            density="comfortable"
            variant="outlined"
            hide-details="auto"
            clearable
          />
        </v-col>
      </template>
    </v-row>

    <div class="text-caption text-medium-emphasis mt-4 mb-2">{{ $t('macro.core.loop.loopTasks') }}</div>

    <component
      :is="taskListComponent"
      :items="item.children"
      :depth="depth + 1"
      inside-loop
      nested
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroLoopTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    taskListComponent: { type: [Object, Function, String], required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  created() {
    if (!Array.isArray((this.item as any).children)) {
      ;(this.item as any).children = []
    }

    const task = (this.item as any).task
    task.data ??= {}

    if (!task.data.mode) {
      task.data.mode =
        task.data.data !== undefined || task.data.values !== undefined
          ? 'array'
          : 'numbers'
    }
  },

  computed: {
    loopData(): any {
      const task = (this.item as any).task

      task.channel = 'loop'
      task.method = 'for'

      if (!task.data || typeof task.data !== 'object') {
        task.data = {}
      }

      if (!task.data.key) {
        task.data.key = 'item'
      }

      return task.data
    },

    loopMode: {
      get(): 'numbers' | 'array' {
        return this.loopData.mode === 'array' ||
          this.loopData.data !== undefined ||
          this.loopData.values !== undefined
          ? 'array'
          : 'numbers'
      },

      set(mode: 'numbers' | 'array') {
        this.loopData.mode = mode

        if (mode === 'numbers') {
          delete this.loopData.data
          delete this.loopData.values

          this.loopData.from ??= 1
          this.loopData.to ??= 10
        } else {
          delete this.loopData.from
          delete this.loopData.to
          delete this.loopData.step

          this.loopData.values ??= []
        }
      },
    },

    loopValues: {
      get(): Array<string | number> {
        const values = this.loopData.values

        if (Array.isArray(values)) {
          return values
        }

        if (values === undefined || values === null || values === '') {
          return []
        }

        return [values]
      },

      set(values: Array<string | number>) {
        this.loopData.values = Array.isArray(values)
          ? values
            .map((value: any) => typeof value === 'string' ? value.trim() : value)
            .filter((value: any) => value !== '')
          : []
      },
    },
  },

  methods: {
    commitLoopValues() {
      this.loopValues = [...this.loopValues]
    },
  },
}
</script>
