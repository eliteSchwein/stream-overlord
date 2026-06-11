<template>
  <v-card color="grey-darken-4">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>{{ $t('variables.title') }}</span>

      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        @click="fetchVariables"
      />
    </v-card-title>

    <v-card-text>
      <v-alert
        v-if="variables.length === 0 && !loading"
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
          v-for="variable in variables"
          :key="variable.key"
        >
          <template #prepend>
            <v-icon icon="mdi-variable" />
          </template>

          <v-list-item-title>{{ variable.key }}</v-list-item-title>

          <template #append>
            <div class="variables-list__actions">
              <v-text-field
                v-model="variable.editValue"
                density="compact"
                variant="outlined"
                hide-details
                class="variables-list__input"
                :disabled="savingKey === variable.key || deletingKey === variable.key"
                @keyup.enter="saveVariable(variable)"
              />

              <v-btn
                icon="mdi-content-save"
                size="small"
                variant="text"
                color="primary"
                :loading="savingKey === variable.key"
                :disabled="deletingKey === variable.key"
                @click.stop="saveVariable(variable)"
              />

              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="red"
                :loading="deletingKey === variable.key"
                :disabled="savingKey === variable.key"
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
import eventBus from '@/eventBus'

type VariableItem = {
  key: string
  value: any
  editValue: string
}

export default {
  data() {
    return {
      variables: [] as VariableItem[],
      loading: false,
      savingKey: null as string | null,
      deletingKey: null as string | null,
    }
  },

  async mounted() {
    eventBus.$on('websocket:connected', async () => {
      await this.fetchVariables()
    })

    await this.fetchVariables()
  },

  methods: {
    requestVariablesWebsocket(method: string, params: Record<string, any> = {}, timeout = 10_000): Promise<any> {
      return new Promise((resolve, reject) => {
        eventBus.$emit('websocket:request', {
          method,
          params,
          timeout,
          resolve,
          reject,
        })
      })
    },

    async fetchVariables() {
      if (this.loading) return

      this.loading = true

      try {
        const data = await this.requestVariablesWebsocket('variables_list')
        const keys = Array.isArray(data?.keys) ? data.keys : []

        const variables = await Promise.all(keys.map(async (key: string) => {
          const response = await this.requestVariablesWebsocket('variables_get', { key })
          const value = response?.value

          return {
            key,
            value,
            editValue: this.valueToInput(value),
          }
        }))

        this.variables = variables.sort((a, b) => a.key.localeCompare(b.key))
      } catch (error) {
        console.error('loading variables failed', error)
      } finally {
        this.loading = false
      }
    },

    async saveVariable(variable: VariableItem) {
      if (!variable.key || this.savingKey) return

      this.savingKey = variable.key

      try {
        const value = this.inputToValue(variable.editValue)

        await this.requestVariablesWebsocket('variables_set', {
          key: variable.key,
          value,
        })

        variable.value = value
        variable.editValue = this.valueToInput(value)
      } catch (error) {
        console.error('saving variable failed', error)
      } finally {
        this.savingKey = null
      }
    },

    async deleteVariable(variable: VariableItem) {
      if (!variable.key || this.deletingKey) return

      this.deletingKey = variable.key

      try {
        await this.requestVariablesWebsocket('variables_delete', {
          key: variable.key,
        })

        this.variables = this.variables.filter(item => item.key !== variable.key)
      } catch (error) {
        console.error('deleting variable failed', error)
      } finally {
        this.deletingKey = null
      }
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
</style>
