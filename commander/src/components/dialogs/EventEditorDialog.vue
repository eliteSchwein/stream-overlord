<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="event-dialog">
      <v-toolbar flat density="comfortable">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-lightning-bolt" class="mr-2" />
          <span class="text-truncate">{{ title }}</span>
        </v-toolbar-title>

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-divider />

      <v-card-text class="py-3 px-0">
        <v-alert
          v-if="error || errorMessage"
          type="error"
          color="red-darken-3"
          density="comfortable"
          class="mb-4"
          :text="error || errorMessage"
        />

        <v-expansion-panels v-model="openPanels" variant="accordion" @update:model-value="onPanelsChanged">
          <v-expansion-panel v-if="!isSystemEvent" value="asset">
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 min-width-0">
                <v-icon icon="mdi-palette" />
                <span class="text-truncate">Asset</span>
              </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <EventAssetAccordion
                ref="assetAccordion"
                :key="`asset_${configName}`"
                :name="configName"
                :disabled="loading || savingInternal"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel value="macro">
            <v-expansion-panel-title :hide-actions="isSystemEvent">
              <div class="d-flex align-center ga-2 min-width-0">
                <v-icon icon="mdi-code-braces" />
                <span class="text-truncate">Macro</span>
              </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <EventMacroAccordion
                ref="macroAccordion"
                :key="`macro_${configName}`"
                :name="configName"
                :initial-content="macroContent"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading || savingInternal" :disabled="!canSave" @click="save">
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'
import EventAssetAccordion from '@/components/accordions/EventAssetAccordion.vue'
import EventMacroAccordion from '@/components/accordions/EventMacroAccordion.vue'

export default {
  name: 'EventEditorDialog',

  components: {
    EventAssetAccordion,
    EventMacroAccordion,
  },

  props: {
    modelValue: { type: Boolean, default: false },
    eventEntry: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
  },

  emits: ['update:modelValue', 'save'],

  data() {
    return {
      openPanels: [] as string[],
      macroContent: '',
      errorMessage: '',
      savingInternal: false,
    }
  },

  computed: {
    configName(): string {
      return String(this.eventEntry?.configName ?? '')
    },

    isSystemEvent(): boolean {
      return this.configName.startsWith('event_system')
    },

    title(): string {
      return this.configName ? `Edit event: ${this.configName}` : 'Edit event'
    },

    canSave(): boolean {
      return this.configName.length > 0 && !this.loading && !this.savingInternal
    },
  },

  watch: {
    configName() {
      this.applyPanelState()
    },

    modelValue(value: boolean) {
      if (value) this.applyPanelState()
    },
  },

  methods: {
    async open() {
      this.errorMessage = ''
      this.macroContent = this.defaultMacroContent(this.configName)
      this.applyPanelState()
      await this.$nextTick()
      await this.loadExistingGeneratedFiles()
      this.applyPanelState()
    },

    applyPanelState() {
      this.openPanels = this.isSystemEvent ? ['macro'] : []
    },

    onPanelsChanged(value: string[]) {
      if (this.isSystemEvent && !value.includes('macro')) {
        this.openPanels = ['macro']
      }
    },

    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        throw new Error('websocket is not connected')
      }

      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    async requestEventEndpoint(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = response?.data ?? response

      if (data?.error) {
        throw new Error(data.error)
      }

      return data
    },

    async loadExistingGeneratedFiles() {
      if (!this.configName) return

      const loaders = [this.loadExistingMacro()]

      if (!this.isSystemEvent) {
        loaders.push(this.loadExistingAsset())
      }

      await Promise.all(loaders)
    },

    async loadExistingAsset() {
      await this.$nextTick()
      try {
        await (this.$refs.assetAccordion as any)?.open?.(this.configName)
      } catch (error) {
        ;(this.$refs.assetAccordion as any)?.setAsset?.({ channel: 'general', duration: 5 })
      }
    },

    async loadExistingMacro() {
      try {
        const data = await this.requestEventEndpoint('macro_read', {
          name: this.configName,
          path: `${this.configName}.yaml`,
          file: `${this.configName}.yaml`,
        })

        this.macroContent = String(data?.content ?? this.defaultMacroContent(this.configName))
      } catch (error) {
        this.macroContent = this.defaultMacroContent(this.configName)
      }

      await this.$nextTick()
      ;(this.$refs.macroAccordion as any)?.setContent?.(this.macroContent, this.configName)
    },

    defaultMacroContent(name: string) {
      return `name: ${name}\napis: []\ntasks: []\n`
    },

    save() {
      if (!this.canSave) return

      this.$emit('save', {
        name: this.configName,
        skipAsset: this.isSystemEvent,
        asset: this.isSystemEvent ? undefined : ((this.$refs.assetAccordion as any)?.getAssetPayload?.() ?? {}),
        macroContent: (this.$refs.macroAccordion as any)?.getContent?.() || this.macroContent || this.defaultMacroContent(this.configName),
      })
    },
  },
}
</script>

<style scoped lang="scss">
.min-width-0 {
  min-width: 0;
}
</style>
