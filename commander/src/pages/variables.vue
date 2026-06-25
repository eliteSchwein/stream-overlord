<template>
  <v-card color="grey-darken-4">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-variable" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('variables.title') }}</div>
        </div>
      </div>
    </v-card-title>

    <v-card-text>
      <v-text-field
        v-model="searchQuery"
        :label="$t('variables.search') || 'Search variables'"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        class="mb-3"
      />

      <v-alert
        v-if="filteredVariables.length === 0"
        type="info"
        color="grey-darken-3"
        :text="$t('variables.empty')"
      />

      <v-list
        v-else
        density="compact"
        bg-color="transparent"
        class="variables-list"
      >
        <v-list-item
          v-for="variable in filteredVariables"
          :key="variable.key"
        >
          <template #prepend>
            <v-icon icon="mdi-variable" />
          </template>

          <v-list-item-title>{{ variable.key }}</v-list-item-title>

          <template #append>
            <div class="variables-list__actions">
              <v-text-field
                :model-value="draftValues[variable.key] ?? valueToInput(variable.value)"
                density="compact"
                variant="outlined"
                hide-details
                class="variables-list__input"
                @update:model-value="draftValues[variable.key] = String($event ?? '')"
                @keyup.enter="saveVariable(variable)"
              />

              <v-btn
                icon="mdi-content-save"
                size="small"
                variant="text"
                color="primary"
                @click.stop="saveVariable(variable)"
              />

              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="red"
                @click.stop="deleteVariable(variable)"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'

type VariableItem = {
  key: string
  value: any
}

export default {
  name: 'Variables',

  data() {
    return {
      searchQuery: '',
      draftValues: {} as Record<string, string>,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getVariables']),

    variableList(): VariableItem[] {
      return Object.entries(this.getVariables ?? {})
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.key.localeCompare(b.key))
    },

    filteredVariables(): VariableItem[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()

      if (!query) return this.variableList

      return this.variableList.filter((variable) => {
        return (
          variable.key.toLowerCase().includes(query) ||
          this.valueToInput(variable.value).toLowerCase().includes(query)
        )
      })
    },
  },

  methods: {
    saveVariable(variable: VariableItem) {
      if (!variable.key) return

      const store = useAppStore()
      const value = this.inputToValue(this.draftValues[variable.key] ?? this.valueToInput(variable.value))

      store.setVariables({
        ...(this.getVariables ?? {}),
        [variable.key]: value,
      })

      this.draftValues[variable.key] = this.valueToInput(value)
    },

    deleteVariable(variable: VariableItem) {
      if (!variable.key) return

      const store = useAppStore()
      const variables = { ...(this.getVariables ?? {}) }

      delete variables[variable.key]
      store.setVariables(variables)
    },

    valueToInput(value: any): string {
      if (typeof value === 'string') return value

      return JSON.stringify(value, null, 2)
    },

    inputToValue(value: string): any {
      const trimmed = String(value ?? '').trim()

      if (trimmed === '') return ''

      try {
        return JSON.parse(trimmed)
      } catch {
        return value
      }
    },
  },
}
</script>

<style scoped>
.variables-list {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}

.variables-list__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: min(520px, 60vw);
}

.variables-list__input {
  min-width: 280px;
}

.min-width-0 {
  min-width: 0;
}
</style>
