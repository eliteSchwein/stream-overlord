<template>
  <v-dialog v-model="dialogVisible" max-width="520">
    <v-card color="grey-darken-4">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ $t('integrations.wled.add')}}
        </v-toolbar-title>
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="close"
        />
      </v-toolbar>

      <v-card-text>
        <v-row density="comfortable">
          <v-col cols="12">
            <v-text-field
              v-model="form.name"
              :label="$t('integrations.wled.name') || 'Name'"
              placeholder="desk"
              variant="outlined"
              hide-details="auto"
              autofocus
            />
          </v-col>

          <v-col cols="12">
            <v-text-field
              v-model="form.ip"
              :label="$t('integrations.wled.ip') || 'IP / Host'"
              placeholder="192.168.178.50"
              variant="outlined"
              hide-details="auto"
              @keydown.enter="submit"
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn variant="text" :disabled="loading" @click="close">
          {{ $t('common.cancel') }}
        </v-btn>

        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ $t('common.add') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance.ts'

export default {
  name: 'WledIntegrationDialog',

  props: {
    modelValue: { type: Boolean, default: undefined },
  },

  emits: ['update:modelValue', 'created'],

  data() {
    return {
      internalVisible: false,
      loading: false,
      form: {
        name: '',
        ip: '',
      },
    }
  },

  computed: {
    dialogVisible: {
      get(): boolean {
        return this.modelValue === undefined
          ? this.internalVisible
          : this.modelValue
      },

      set(value: boolean) {
        this.internalVisible = value
        this.$emit('update:modelValue', value)
      },
    },

    canSubmit(): boolean {
      return Boolean(this.form.name.trim() && this.form.ip.trim())
    },
  },

  methods: {
    open(name = '') {
      this.form = {
        name: String(name ?? '').trim(),
        ip: '',
      }

      this.dialogVisible = true
    },

    close() {
      this.dialogVisible = false
    },

    async submit() {
      if (!this.canSubmit) return

      const client = getWebsocketClient()

      if (!client) {
        console.warn('websocket is not connected')
        return
      }

      this.loading = true

      try {
        await client.request('wled_add', {
          name: this.form.name.trim(),
          ip: this.form.ip.trim(),
        })

        this.$emit('created', this.form.name.trim())
        this.close()
      } finally {
        this.loading = false
      }
    },
  },
}
</script>
