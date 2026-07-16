<template>
  <v-dialog :model-value="modelValue" fullscreen scrollable @update:model-value="$emit('update:modelValue', $event)">
    <v-card class="command-dialog">
      <v-toolbar flat density="comfortable">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-console-line" class="mr-2" />
          <span class="text-truncate">{{ $t('commands.create') || 'Add command' }}</span>
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
            <v-text-field v-model="form.name" label="Command" prefix="!" variant="outlined" density="comfortable" hide-details @update:model-value="syncMacro" />
          </v-col>

          <v-col cols="12" md="6">
            <v-combobox v-model="form.aliases" label="Aliases" variant="outlined" density="comfortable" multiple chips closable-chips hide-details />
          </v-col>
        </v-row>

        <v-row density="comfortable" class="mt-3 px-3">
          <v-col cols="12" md="6">
            <v-text-field v-model.number="form.userCooldown" label="User cooldown" type="number" variant="outlined" density="comfortable" hide-details />
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field v-model.number="form.globalCooldown" label="Global cooldown" type="number" variant="outlined" density="comfortable" hide-details />
          </v-col>
        </v-row>

        <div class="d-flex flex-wrap ga-2 my-3 px-3">
          <v-switch v-model="form.enforce_primary" label="Primary only" color="primary" hide-details density="comfortable" />
          <v-switch v-model="form.requiresBroadcaster" label="Broadcaster" color="primary" hide-details density="comfortable" />
          <v-switch v-model="form.requiresMod" label="Mod" color="primary" hide-details density="comfortable" />
          <v-switch v-model="form.requiresVip" label="VIP" color="primary" density="comfortable" hide-details />
        </div>

        <v-card color="grey-darken-4" variant="flat" class="pa-3 mb-3">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-subtitle-2">Params</div>
            <v-btn size="small" prepend-icon="mdi-plus" variant="tonal" @click="addParam">Add param</v-btn>
          </div>

          <v-alert v-if="safeParams.length === 0" type="info" density="compact" variant="tonal" text="No params configured" />

          <v-row v-for="(param, index) in safeParams" :key="index" density="compact" class="align-center mb-1">
            <v-col cols="12" md="3">
              <v-text-field v-model="param.name" label="Name" variant="outlined" density="compact" hide-details />
            </v-col>

            <v-col cols="12" md="3">
              <v-select v-model="param.type" :items="paramTypes" label="Type" variant="outlined" density="compact" hide-details />
            </v-col>

            <v-col cols="12" md="4">
              <v-combobox
                v-if="param.type === 'subcommand'"
                v-model="param.subcommandNames"
                label="Subcommands"
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
                hide-details
              />
              <v-switch v-else v-model="param.required" label="Required" color="primary" density="compact" hide-details />
            </v-col>

            <v-col cols="12" md="2" class="text-right">
              <v-btn icon="mdi-delete" color="error" variant="text" @click="removeParam(index)" />
            </v-col>
          </v-row>
        </v-card>

        <v-card variant="flat" class="px-0" color="grey-darken-3">
          <v-card-text>
            <CommandMacroAccordion ref="macroAccordion" :name="generatedMacroName" :initial-content="macroContent" disable-macro-read />
          </v-card-text>
        </v-card>


      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">
          {{ $t('common.cancel') || 'Cancel' }}
        </v-btn>
        <v-btn color="primary" variant="tonal" :loading="loading" :disabled="!canSave" @click="save">
          {{ $t('common.save') || 'Save' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import CommandMacroAccordion from '@/components/accordions/CommandMacroAccordion.vue'
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'

export default {
  name: 'CommandCreateDialog',

  components: { CommandMacroAccordion, YamlImportExportButtons },

  props: {
    modelValue: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'save'],

  data() {
    return {
      openPanels: ['macro'],
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
    open() {
      this.errorMessage = ''
      this.form = this.defaultForm()
      this.syncMacro()
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
        macro: this.generatedMacroName,
      }
    },

    buildExportPayload() {
      const command = this.buildCommandPayload()

      return {
        name: command.name,
        path: command.name ? `command_${command.name}.yaml` : 'command.yaml',
        command,
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
      this.errorMessage = error?.message || 'Import failed'
    },

    save() {
      if (!this.canSave) return

      const payload = this.buildExportPayload()

      this.$emit('save', {
        ...payload.command,
        path: payload.path,
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
