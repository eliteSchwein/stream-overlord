<template>
  <div>
    <v-autocomplete
      :model-value="modelValue"
      :items="wledOptions"
      :label="label"
      clearable
      hide-details="auto"
      prepend-inner-icon="mdi-led-strip-variant"
      variant="outlined"
      density="comfortable"
      :loading="loading || saving"
      :disabled="disabled"
      v-model:menu="menuOpen"
      @update:menu="handleMenuUpdate"
      @update:model-value="$emit('update:modelValue', $event ?? '')"
    >
      <template #prepend-item>
        <v-list-item prepend-icon="mdi-plus" @click="openCreateWled">
          <v-list-item-title>{{ createLabel }}</v-list-item-title>
        </v-list-item>
        <v-divider class="my-1" />
      </template>
    </v-autocomplete>

    <WledIntegrationDialog
      ref="wledIntegrationDialog"
      v-model="dialog"
      :loading="saving"
      :error="error"
      @save="saveWled"
      @created="handleCreated"
    />
  </div>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import WledIntegrationDialog from '@/components/dialogs/WledIntegrationDialog.vue'

export default {
  name: 'MacroWledSelect',

  components: {
    WledIntegrationDialog,
  },

  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: 'WLED' },
    disabled: { type: Boolean, default: false },
  },

  emits: ['update:modelValue'],

  data() {
    return {
      loading: false,
      saving: false,
      dialog: false,
      error: '',
      localWledIntegrations: {} as Record<string, any>,
      menuOpen: false,
      hasLoadedWled: false,
    }
  },

  computed: {
    wledIntegrations(): Record<string, any> {
      const appStore = useAppStore()
      const storeWled = appStore.getIntegrations?.wled ?? {}

      return Object.keys(storeWled).length
        ? storeWled
        : this.localWledIntegrations
    },

    wledOptions(): string[] {
      const options = Object.keys(this.wledIntegrations ?? {})
      const current = String(this.modelValue ?? '').trim()

      if (current && !options.includes(current)) {
        options.unshift(current)
      }

      return options.sort((a, b) => a.localeCompare(b))
    },

    createLabel(): string {
      return `${this.$t?.('integrations.wled.add') || 'Add WLED'}`
    },
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        throw new Error('websocket is not connected')
      }

      return await client.request(method, params, timeout)
    },

    async handleMenuUpdate(open: boolean) {
      if (!open || this.hasLoadedWled || this.loading) return

      const appStore = useAppStore()
      const storeWled = appStore.getIntegrations?.wled ?? {}

      if (Object.keys(storeWled).length) {
        this.hasLoadedWled = true
        return
      }

      this.localWledIntegrations = storeWled
      this.hasLoadedWled = true
    },

    async openCreateWled() {
      this.error = ''
      this.dialog = true

      await this.$nextTick()
      await (this.$refs.wledIntegrationDialog as any)?.open?.(this.modelValue ?? '')
    },

    async saveWled(payload: { name: string; ip: string }) {
      if (!payload?.name || !payload?.ip || this.saving) return

      this.saving = true
      this.error = ''

      try {
        const data = await this.requestWebsocket('wled_add', {
          name: payload.name,
          ip: payload.ip,
        })

        if (data?.error) throw new Error(data.error)

        this.dialog = false
        this.$emit('update:modelValue', payload.name)
      } catch (error: any) {
        this.error = error?.message ?? 'save wled failed'
      } finally {
        this.saving = false
      }
    },

    handleCreated(name: string) {
      if (!name) return

      this.dialog = false
      this.$emit('update:modelValue', name)
    },
  },
}
</script>
