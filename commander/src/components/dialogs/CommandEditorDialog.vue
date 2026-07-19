<template>
  <CommandCreateDialog
    ref="inner"
    :model-value="modelValue"
    :loading="loading"
    @update:model-value="$emit('update:modelValue', $event)"
    @save="save"
  />
</template>

<script lang="ts">
import CommandCreateDialog from '@/components/dialogs/CommandCreateDialog.vue'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { useAppStore } from '@/stores/app'

export default {
  name: 'CommandEditorDialog',

  components: { CommandCreateDialog },

  props: {
    modelValue: { type: Boolean, default: false },
    commandEntry: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'save'],

  data() {
    return {
      appStore: useAppStore(),
    }
  },

  methods: {
    async open() {
      await this.$nextTick()

      const inner = this.$refs.inner as any
      inner?.open?.()

      const command = this.commandEntry?.command ?? {}
      const name = this.commandEntry?.name ?? command.name ?? ''
      const generatedName = `command_${String(name).replace(/^command_/, '')}`
      const assetName = command.asset || generatedName
      const macroName = command.macro || generatedName

      if (!inner) return

      inner.form = {
        name,
        aliases: this.toArray(command.aliases ?? command.alias),
        params: this.expandParams(command.params),
        userCooldown: command.userCooldown,
        globalCooldown: command.globalCooldown,
        enforce_primary: command.enforce_primary === true || command.enforceSame === true,
        requiresBroadcaster: command.requiresBroadcaster === true,
        requiresMod: command.requiresMod === true,
        requiresVip: command.requiresVip === true,
      }

      await Promise.all([
        inner.loadAsset?.(assetName),
        this.loadMacro(macroName).then((content: string) => {
          inner.macroContent = content
        }),
      ])

      await this.$nextTick()
      ;(inner.$refs.macroAccordion as any)?.setContent?.(inner.macroContent, macroName)
    },

    toArray(value: any): any[] {
      if (Array.isArray(value)) return value
      if (value === null || value === undefined) return []
      if (typeof value === 'object') return Object.values(value)
      return [value]
    },

    expandParams(params: any) {
      return this.toArray(params).map((param: any) => {
        if (!param || typeof param !== 'object') {
          return {
            name: String(param ?? ''),
            subcommandNames: [],
          }
        }

        return {
          ...param,
          subcommandNames: this.toArray(param.subcommands).map((sub: any) => {
            if (typeof sub === 'string') return sub
            return sub?.name ?? ''
          }).filter(Boolean),
        }
      })
    },

    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 4_000): Promise<any> {
      const client = getWebsocketClient()
      if (!client) throw new Error('websocket is not connected')

      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    unwrap(response: any, method: string) {
      const key = `result_${method}`
      const candidates = [
        response,
        response?.data,
        response?.payload,
        response?.result,
        response?.data?.result,
      ].filter(Boolean)

      for (const candidate of candidates) {
        if (candidate?.[key] !== undefined) return candidate[key]
      }

      return response?.data ?? response
    },

    async loadMacro(name: string) {
      const payload = {
        name,
        path: `${name}.yaml`,
        file: `${name}.yaml`,
      }

      try {
        const response = await this.requestWebsocket('macro_read', payload)
        const data = this.unwrap(response, 'macro_read')
        if (data?.content) return String(data.content)
      } catch (_) {
        // fallback below
      }

      try {
        const response = await fetch(`${this.appStore.getRestApi}/api/macro/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await response.json().catch(() => ({}))
        const content = data?.content ?? data?.data?.content
        if (content) return String(content)
      } catch (_) {
        // default below
      }

      return `name: ${name}\ntasks: []\n`
    },

    save(payload: any) {
      this.$emit('save', {
        ...payload,
        path: this.commandEntry?.file ?? payload.path,
      })
    },
  },
}
</script>
