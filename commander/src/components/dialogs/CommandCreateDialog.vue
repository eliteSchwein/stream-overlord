<template>
  <v-dialog :model-value="modelValue" fullscreen scrollable @update:model-value="$emit('update:modelValue', $event)">
    <v-card class="command-dialog">
      <v-toolbar flat density="comfortable">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-console-line" class="mr-2" />
          <span class="text-truncate">{{ $t('commands.create') }}</span>
        </v-toolbar-title>

        <YamlImportExportButtons
          class="mr-2"
          :filename="exportFilename"
          :disabled="loading"
          :export-data="exportPayload"
          @import="importCommand"
          @error="handleImportError"
        />

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text class="px-0 py-3">
        <v-alert v-if="errorMessage" type="error" color="red-darken-3" class="mb-3 mx-3" :text="errorMessage" />

        <v-row density="comfortable" class="px-3">
          <v-col cols="12" md="6">
            <v-text-field v-model="form.name" :label="$t('dialogs.commandCreateDialog.command')" prefix="!" variant="outlined" density="comfortable" hide-details @update:model-value="syncMacro" />
          </v-col>

          <v-col cols="12" md="6">
            <v-combobox v-model="form.aliases" :label="$t('dialogs.commandCreateDialog.aliases')" variant="outlined" density="comfortable" multiple chips closable-chips hide-details />
          </v-col>
        </v-row>

        <v-row density="comfortable" class="mt-3 px-3">
          <v-col cols="12" md="6">
            <v-text-field v-model.number="form.userCooldown" :label="$t('dialogs.commandCreateDialog.userCooldown')" type="number" variant="outlined" density="comfortable" hide-details />
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field v-model.number="form.globalCooldown" :label="$t('dialogs.commandCreateDialog.globalCooldown')" type="number" variant="outlined" density="comfortable" hide-details />
          </v-col>
        </v-row>

        <div class="d-flex flex-wrap ga-2 my-3 px-3">
          <v-switch v-model="form.enforce_primary" :label="$t('dialogs.commandCreateDialog.primaryOnly')" color="primary" hide-details density="comfortable" />
          <v-switch v-model="form.requiresBroadcaster" :label="$t('dialogs.commandCreateDialog.broadcaster')" color="primary" hide-details density="comfortable" />
          <v-switch v-model="form.requiresMod" :label="$t('dialogs.commandCreateDialog.mod')" color="primary" hide-details density="comfortable" />
          <v-switch v-model="form.requiresVip" :label="$t('dialogs.commandCreateDialog.vip')" color="primary" density="comfortable" hide-details />
        </div>

        <v-card color="grey-darken-4" variant="flat" class="pa-3 mb-3">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-subtitle-2">{{ $t('dialogs.commandCreateDialog.params') }}</div>
            <v-btn size="small" prepend-icon="mdi-plus" variant="tonal" @click="addParam">{{ $t('dialogs.commandCreateDialog.addParam') }}</v-btn>
          </div>

          <v-alert v-if="safeParams.length === 0" type="info" density="compact" variant="tonal" :text="$t('dialogs.commandCreateDialog.noParamsConfigured')" />

          <v-row v-for="(param, index) in safeParams" :key="index" density="compact" class="align-center mb-1">
            <v-col cols="12" md="3">
              <v-text-field v-model="param.name" :label="$t('dialogs.commandCreateDialog.name')" variant="outlined" density="compact" hide-details />
            </v-col>

            <v-col cols="12" md="3">
              <v-select v-model="param.type" :items="paramTypes" :label="$t('dialogs.commandCreateDialog.type')" variant="outlined" density="compact" hide-details />
            </v-col>

            <v-col cols="12" md="4">
              <v-combobox
                v-if="param.type === 'subcommand'"
                v-model="param.subcommandNames"
                :label="$t('dialogs.commandCreateDialog.subcommands')"
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
                hide-details
              />
              <v-switch v-else v-model="param.required" :label="$t('dialogs.commandCreateDialog.required')" color="primary" density="compact" hide-details />
            </v-col>

            <v-col cols="12" md="2" class="text-right">
              <v-btn icon="mdi-delete" color="error" variant="text" @click="removeParam(index)" />
            </v-col>
          </v-row>
        </v-card>

        <v-expansion-panels v-model="openPanels" variant="accordion">
          <v-expansion-panel value="asset">
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 min-width-0">
                <v-icon icon="mdi-palette" />
                <span class="text-truncate">
                  {{ $t('dialogs.commandCreateDialog.asset') }}
                </span>
              </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text eager>
              <CommandAssetAccordion
                ref="assetAccordion"
                :key="`asset_${generatedAssetName}`"
                :name="generatedAssetName"
                :auto-load="false"
                :disabled="loading"
              />
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel value="macro">
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 min-width-0">
                <v-icon icon="mdi-code-braces" />
                <span class="text-truncate">
                  {{ $t('dialogs.commandCreateDialog.macro') }}
                </span>
              </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text eager>
              <CommandMacroAccordion
                ref="macroAccordion"
                :key="`macro_${generatedMacroName}`"
                :name="generatedMacroName"
                :initial-content="macroContent"
                disable-macro-read
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" variant="tonal" :loading="loading" :disabled="!canSave" @click="save">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import CommandAssetAccordion from '@/components/accordions/CommandAssetAccordion.vue'
import CommandMacroAccordion from '@/components/accordions/CommandMacroAccordion.vue'
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'

export default {
  name: 'CommandCreateDialog',

  components: { CommandAssetAccordion, CommandMacroAccordion, YamlImportExportButtons },

  props: {
    modelValue: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'save'],

  data() {
    return {
      openPanels: [],
      errorMessage: '',
      paramTypes: ['string', 'number', 'user', 'subcommand', 'all'],
      macroContent: '',
      form: this.defaultForm(),
    }
  },

  computed: {
    safeParams(): any[] {
      if (!Array.isArray((this.form as any).params)) {
        ;(this.form as any).params = []
      }

      return (this.form as any).params
    },

    normalizedName(): string {
      return this.normalizeName((this.form as any).name)
    },

    generatedAssetName(): string {
      return this.normalizedName ? `command_${this.normalizedName}` : 'command_'
    },

    generatedMacroName(): string {
      return this.normalizedName ? `command_${this.normalizedName}` : 'command_'
    },

    exportFilename(): string {
      return this.normalizedName ? `command_${this.normalizedName}.yaml` : 'command.yaml'
    },

    exportPayload(): any {
      return this.buildExportPayload()
    },

    canSave(): boolean {
      return this.normalizedName.length > 0 && !this.loading
    },
  },

  methods: {
    async open() {
      this.errorMessage = ''
      this.form = this.defaultForm()
      this.syncMacro()

      await this.$nextTick()
      ;(this.$refs.assetAccordion as any)?.setAsset?.({
        channel: 'general',
        duration: 5,
      })
    },

    defaultForm() {
      return {
        name: '',
        aliases: [] as string[],
        params: [] as any[],
        userCooldown: undefined as any,
        globalCooldown: undefined as any,
        enforce_primary: false,
        requiresBroadcaster: false,
        requiresMod: false,
        requiresVip: false,
      }
    },

    toArray(value: any): any[] {
      if (Array.isArray(value)) return value
      if (value === null || value === undefined || value === '') return []
      if (typeof value === 'object') return Object.values(value)
      return [value]
    },

    setForm(value: any = {}) {
      this.form = {
        ...this.defaultForm(),
        ...value,
        aliases: this.toArray(value.aliases),
        params: this.toArray(value.params),
      }
    },

    setMacroContent(content: string, name?: string) {
      this.macroContent = content || this.defaultMacroContent(name || this.generatedMacroName)
      this.$nextTick(() => {
        ;(this.$refs.macroAccordion as any)?.setContent?.(this.macroContent, name || this.generatedMacroName)
      })
    },

    normalizeName(value: any) {
      return String(value ?? '')
        .trim()
        .replace(/^!+/, '')
        .replace(/^command_/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
    },

    defaultMacroContent(name: string) {
      return `name: ${name}\ntasks: []\n`
    },

    syncMacro() {
      this.setMacroContent(this.defaultMacroContent(this.generatedMacroName), this.generatedMacroName)
    },

    addParam() {
      if (!Array.isArray((this.form as any).params)) {
        ;(this.form as any).params = []
      }

      ;(this.form as any).params.push({
        name: '',
        type: 'string',
        required: true,
        subcommandNames: [],
      })
    },

    removeParam(index: number) {
      if (!Array.isArray((this.form as any).params)) return
        ;(this.form as any).params.splice(index, 1)
    },

    normalizeParams() {
      return this.toArray((this.form as any).params)
        .map((param: any) => {
          if (!param || typeof param !== 'object') {
            return null
          }

          return {
            name: param.name,
            type: param.type || 'string',
            required: param.required !== false,
            subcommands:
              param.type === 'subcommand'
                ? this.toArray(param.subcommandNames)
                  .filter(Boolean)
                  .map((name: string) => ({ name }))
                : undefined,
          }
        })
        .filter((param: any) => param?.name)
    },

    async loadAsset(name: string) {
      await this.$nextTick()

      try {
        await (this.$refs.assetAccordion as any)?.open?.(name)
      } catch (_) {
        ;(this.$refs.assetAccordion as any)?.setAsset?.({
          channel: 'general',
          duration: 5,
        })
      }
    },

    getAssetPayload() {
      return (this.$refs.assetAccordion as any)?.getAssetPayload?.() ?? {}
    },

    getMacroContent() {
      return (
        (this.$refs.macroAccordion as any)?.getContent?.() ||
        this.macroContent ||
        this.defaultMacroContent(this.generatedMacroName)
      )
    },

    buildCommandPayload() {
      return {
        ...this.form,
        name: this.normalizedName,
        aliases: this.toArray((this.form as any).aliases),
        params: this.normalizeParams(),
        asset: this.generatedAssetName,
        macro: this.generatedMacroName,
      }
    },

    buildExportPayload() {
      const command = this.buildCommandPayload()

      return {
        name: command.name,
        path: command.name ? `command_${command.name}.yaml` : 'command.yaml',
        command,
        assetPayload: this.getAssetPayload(),
        macroContent: this.getMacroContent(),
      }
    },

    importCommand(payload: any) {
      try {
        const data = payload?.data ?? payload ?? {}
        const command = data.command && typeof data.command === 'object' ? data.command : data
        const importedName = data.name ?? command.name ?? ''
        const macroName = command.macro || `command_${this.normalizeName(importedName)}`

        this.setForm({
          name: importedName,
          aliases: command.aliases ?? command.alias,
          params: this.expandImportedParams(command.params),
          userCooldown: command.userCooldown,
          globalCooldown: command.globalCooldown,
          enforce_primary: command.enforce_primary === true || command.enforceSame === true,
          requiresBroadcaster: command.requiresBroadcaster === true,
          requiresMod: command.requiresMod === true,
          requiresVip: command.requiresVip === true,
        })

        this.setMacroContent(
          String(data.macroContent ?? data.macro?.content ?? this.defaultMacroContent(macroName)),
          macroName,
        )

        this.$nextTick(async () => {
          const importedAssetPayload = data.assetPayload ?? data.asset?.content

          if (importedAssetPayload && typeof importedAssetPayload === 'object') {
            ;(this.$refs.assetAccordion as any)?.setAsset?.(importedAssetPayload)
          } else {
            await this.loadAsset(command.asset || this.generatedAssetName)
          }
        })

        this.errorMessage = ''
      } catch (error: any) {
        this.handleImportError(error)
      }
    },

    expandImportedParams(params: any) {
      return this.toArray(params).map((param: any) => {
        if (!param || typeof param !== 'object') {
          return {
            name: String(param ?? ''),
            type: 'string',
            required: true,
            subcommandNames: [],
          }
        }

        return {
          ...param,
          subcommandNames: this.toArray(param.subcommands ?? param.subcommandNames)
            .map((sub: any) => (typeof sub === 'string' ? sub : sub?.name ?? ''))
            .filter(Boolean),
        }
      })
    },

    handleImportError(error: any) {
      this.errorMessage = error?.message
    },

    save() {
      if (!this.canSave) return

      const payload = this.buildExportPayload()

      this.$emit('save', {
        ...payload.command,
        path: payload.path,
        assetPayload: payload.assetPayload,
        macroContent: payload.macroContent,
      })
    },
  },
}
</script>

<style scoped>
.min-width-0 {
  min-width: 0;
}
</style>
