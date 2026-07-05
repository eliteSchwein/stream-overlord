<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-connection" />
        <span>Integrations</span>
      </div>
    </v-card-title>

    <v-card-text class="px-3 pb-3">
      <v-row density="comfortable" align="stretch">
        <v-col cols="12" lg="6">
          <v-card class="integration-card" color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-twitch" />
              <span>Twitch</span>
            </v-card-title>

            <v-card-text class="pt-2">
              <v-row density="comfortable" class="integration-form">
                <v-col cols="12" md="6">
                  <v-card variant="tonal">
                    <v-card-title class="d-flex align-center justify-space-between text-subtitle-1">
                      <span>Control Auth</span>
                      <v-chip
                        size="x-small"
                        :color="twitchStatus.control ? 'success' : 'warning'"
                        variant="tonal"
                      >
                        {{ twitchStatus.control ? 'Logged in' : 'Missing' }}
                      </v-chip>
                    </v-card-title>

                    <v-card-text>
                      Full access auth for EventSub, channel points, moderation and API actions.
                    </v-card-text>

                    <v-card-actions>
                      <v-btn
                        color="primary"
                        variant="flat"
                        prepend-icon="mdi-login"
                        @click="openTwitchAuth('control')"
                      >
                        Auth control
                      </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-col>

                <v-col cols="12" md="6">
                  <v-card variant="tonal">
                    <v-card-title class="d-flex align-center justify-space-between text-subtitle-1">
                      <span>Message Auth</span>
                      <v-chip
                        size="x-small"
                        :color="twitchStatus.message ? 'success' : 'grey'"
                        variant="tonal"
                      >
                        {{ twitchStatus.message ? 'Logged in' : 'Optional' }}
                      </v-chip>
                    </v-card-title>

                    <v-card-text>
                      Optional auth for chat messages, replies, whispers and announcements.
                    </v-card-text>

                    <v-card-actions>
                      <v-btn
                        color="secondary"
                        variant="flat"
                        prepend-icon="mdi-message-text-outline"
                        @click="openTwitchAuth('message')"
                      >
                        Auth message
                      </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" lg="6">
          <v-card class="integration-card" color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center ga-2">
                <v-icon icon="mdi-led-strip-variant" />
                <span>WLED</span>
              </div>
            </v-card-title>

            <v-card-text class="pt-2">
              <v-row density="comfortable" class="integration-form">
                <v-col cols="12" sm="6" md="5">
                  <v-text-field
                    v-model="wledForm.name"
                    label="Name"
                    placeholder="desk"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" sm="6" md="5">
                  <v-text-field
                    v-model="wledForm.ip"
                    label="IP / Host"
                    placeholder="192.168.178.50"
                    density="compact"
                    variant="outlined"
                    hide-details
                    @keydown.enter="addWled"
                  />
                </v-col>

                <v-col cols="12" sm="12" md="2">
                  <v-btn
                    block
                    class="integration-action-btn"
                    color="primary"
                    variant="flat"
                    prepend-icon="mdi-plus"
                    :loading="loading.wledAdd"
                    :disabled="!canAddWled"
                    @click="addWled"
                  >
                    Add
                  </v-btn>
                </v-col>
              </v-row>

              <v-divider class="my-4" />

              <v-alert
                v-if="!wledEntries.length"
                type="info"
                variant="tonal"
                density="compact"
              >
                No WLED integrations configured yet.
              </v-alert>

              <v-list v-else bg-color="transparent" density="compact">
                <v-list-item
                  v-for="entry in wledEntries"
                  :key="entry.name"
                  rounded
                  class="mb-2 bg-grey-darken-3"
                >
                  <template #prepend>
                    <v-avatar color="primary" variant="tonal">
                      <v-icon icon="mdi-led-strip-variant" />
                    </v-avatar>
                  </template>

                  <v-list-item-title>
                    {{ entry.name }}
                  </v-list-item-title>

                  <v-list-item-subtitle>
                    {{ entry.ip }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      icon="mdi-delete-outline"
                      color="error"
                      variant="text"
                      :loading="loading.wledRemove === entry.name"
                      @click="removeWled(entry.name)"
                    />
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" lg="6">
          <v-card class="integration-card" color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center ga-2">
                <v-icon icon="mdi-video-box" />
                <span>Yolobox</span>
              </div>
            </v-card-title>

            <v-card-text class="pt-2">
              <v-card variant="tonal" class="integration-inner-card">
                <v-card-title class="d-flex align-center justify-space-between text-subtitle-1">
                  <span>Auto discovery</span>
                  <v-switch
                    :model-value="yoloboxStatus.enabled"
                    color="primary"
                    density="compact"
                    hide-details
                    :loading="loading.yoloboxToggle"
                    @update:model-value="toggleYolobox"
                  />
                </v-card-title>

                <v-card-text>
                  <div class="mb-2">
                    Enables Yolobox discovery and connection handling on the backend.
                  </div>

                  <div class="d-flex ga-2 flex-wrap">
                    <v-chip
                      size="x-small"
                      :color="yoloboxStatus.enabled ? 'success' : 'grey'"
                      variant="tonal"
                    >
                      {{ yoloboxStatus.enabled ? 'Enabled' : 'Disabled' }}
                    </v-chip>

                    <v-chip
                      size="x-small"
                      :color="yoloboxStatus.connected ? 'success' : 'grey'"
                      variant="tonal"
                    >
                      {{ yoloboxStatus.connected ? 'Connected' : 'Offline' }}
                    </v-chip>
                  </div>
                </v-card-text>
              </v-card>
            </v-card-text>
          </v-card>
        </v-col>


        <v-col cols="12" lg="6">
          <v-card class="integration-card" color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center ga-2">
                <v-icon icon="mdi-led-on" />
                <span>Neopixel</span>
              </div>
            </v-card-title>

            <v-card-text class="pt-2">
              <v-row density="comfortable" class="integration-form">
                <v-col cols="12" sm="6" md="3">
                  <v-text-field
                    v-model="neopixelForm.name"
                    label="Name"
                    placeholder="tablet_leds"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" sm="6" md="2">
                  <v-text-field
                    v-model.number="neopixelForm.gpio"
                    label="GPIO"
                    type="number"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" sm="6" md="2">
                  <v-text-field
                    v-model.number="neopixelForm.amount"
                    label="Amount"
                    type="number"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" sm="6" md="3">
                  <v-text-field
                    v-model.number="neopixelForm.heartbeat_index"
                    label="Heartbeat index"
                    type="number"
                    density="compact"
                    variant="outlined"
                    hide-details
                    @keydown.enter="saveNeopixel"
                  />
                </v-col>

                <v-col cols="12" sm="12" md="2">
                  <v-btn
                    block
                    class="integration-action-btn"
                    color="primary"
                    variant="flat"
                    prepend-icon="mdi-content-save-outline"
                    :loading="loading.neopixelSave"
                    :disabled="!canSaveNeopixel"
                    @click="saveNeopixel"
                  >
                    Save
                  </v-btn>
                </v-col>
              </v-row>

              <v-divider class="my-4" />

              <v-alert
                v-if="!neopixelEntries.length"
                type="info"
                variant="tonal"
                density="compact"
              >
                No Neopixel strips configured yet. Saving without changing the name creates tablet_leds.
              </v-alert>

              <v-list v-else bg-color="transparent" density="compact">
                <v-list-item
                  v-for="entry in neopixelEntries"
                  :key="entry.name"
                  rounded
                  class="mb-2 bg-grey-darken-3"
                >
                  <template #prepend>
                    <v-avatar color="primary" variant="tonal">
                      <v-icon icon="mdi-led-on" />
                    </v-avatar>
                  </template>

                  <v-list-item-title>
                    {{ entry.name }}
                  </v-list-item-title>

                  <v-list-item-subtitle>
                    GPIO {{ entry.gpio }} · {{ entry.amount }} LEDs · heartbeat {{ entry.heartbeat_index ?? 'none' }}
                  </v-list-item-subtitle>

                  <template #append>
                    <div class="d-flex align-center ga-2">
                      <v-btn
                        icon="mdi-pencil-outline"
                        variant="text"
                        @click="editNeopixel(entry)"
                      />

                      <v-btn
                        icon="mdi-delete-outline"
                        color="error"
                        variant="text"
                        :loading="loading.neopixelRemove === entry.name"
                        @click="removeNeopixel(entry.name)"
                      />
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" lg="6">
          <v-card class="integration-card" color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center ga-2">
                <v-icon icon="mdi-video-box" />
                <span>OBS</span>
              </div>
            </v-card-title>

            <v-card-text class="pt-2">
              <v-row density="comfortable" class="integration-form">
                <v-col cols="12" sm="6" md="3">
                  <v-text-field
                    v-model="obsForm.name"
                    label="Name"
                    placeholder="default"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" sm="6" md="3">
                  <v-text-field
                    v-model="obsForm.ip"
                    label="IP / Host"
                    placeholder="127.0.0.1"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" sm="6" md="2">
                  <v-text-field
                    v-model.number="obsForm.port"
                    label="Port"
                    type="number"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" sm="6" md="2">
                  <v-text-field
                    v-model="obsForm.password"
                    label="Password"
                    type="password"
                    density="compact"
                    variant="outlined"
                    hide-details
                    @keydown.enter="addObs"
                  />
                </v-col>

                <v-col cols="12" sm="12" md="2">
                  <v-btn
                    block
                    class="integration-action-btn"
                    color="primary"
                    variant="flat"
                    prepend-icon="mdi-plus"
                    :loading="loading.obsAdd"
                    :disabled="!canAddObs"
                    @click="addObs"
                  >
                    Add
                  </v-btn>
                </v-col>
              </v-row>

              <v-divider class="my-4" />

              <v-alert
                v-if="!obsEntries.length"
                type="info"
                variant="tonal"
                density="compact"
              >
                No OBS integrations configured yet.
              </v-alert>

              <v-list v-else bg-color="transparent" density="compact">
                <v-list-item
                  v-for="entry in obsEntries"
                  :key="entry.name"
                  rounded
                  class="mb-2 bg-grey-darken-3"
                >
                  <template #prepend>
                    <v-avatar :color="entry.connected ? 'success' : 'grey'" variant="tonal">
                      <v-icon icon="mdi-monitor" />
                    </v-avatar>
                  </template>

                  <v-list-item-title>
                    {{ entry.name }}
                  </v-list-item-title>

                  <v-list-item-subtitle>
                    {{ entry.ip }}:{{ entry.port }}
                  </v-list-item-subtitle>

                  <template #append>
                    <div class="d-flex align-center ga-2">
                      <v-chip
                        size="x-small"
                        :color="entry.connected ? 'success' : 'grey'"
                        variant="tonal"
                      >
                        {{ entry.connected ? 'Connected' : 'Offline' }}
                      </v-chip>

                      <v-btn
                        icon="mdi-delete-outline"
                        color="error"
                        variant="text"
                        :loading="loading.obsRemove === entry.name"
                        @click="removeObs(entry.name)"
                      />
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>



      </v-row>
    </v-card-text>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="2500"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </v-card>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'

type TwitchAuthType = 'control' | 'message'

type ObsEntry = {
  name: string
  ip: string
  port: number
  connected: boolean
}

type NeopixelEntry = {
  name: string
  gpio: number
  amount: number
  heartbeat_index?: number
}

export default {
  name: 'IntegrationsPage',

  data() {
    return {
      appStore: useAppStore(),

      wledForm: {
        name: '',
        ip: '',
      },

      obsForm: {
        name: 'default',
        ip: '127.0.0.1',
        port: 4455,
        password: '',
      },

      neopixelForm: {
        name: 'tablet_leds',
        gpio: 17,
        amount: 2,
        heartbeat_index: 1 as number | null,
      },

      loading: {
        wledAdd: false,
        wledRemove: '',
        obsAdd: false,
        obsRemove: '',
        yoloboxToggle: false,
        neopixelSave: false,
        neopixelRemove: '',
      },

      snackbar: {
        show: false,
        text: '',
        color: 'success',
      },
    }
  },

  computed: {
    integrations(): any {
      return this.appStore.getIntegrations ?? {}
    },

    wledIntegrations(): Record<string, any> {
      return this.integrations?.wled ?? {}
    },

    obsIntegrations(): Record<string, any> {
      return this.integrations?.obs ?? {}
    },

    neopixelIntegrations(): Record<string, any> {
      return this.integrations?.neopixel ?? {}
    },

    wledEntries(): any[] {
      return Object.entries(this.wledIntegrations)
        .map(([name, data]: any) => ({
          name,
          ip: data?.ip ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    obsEntries(): ObsEntry[] {
      return Object.entries(this.obsIntegrations)
        .map(([name, data]: any) => ({
          name,
          ip: data?.ip ?? '',
          port: Number(data?.port ?? 4455),
          connected: Boolean(data?.connected),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    neopixelEntries(): NeopixelEntry[] {
      return Object.entries(this.neopixelIntegrations)
        .map(([name, data]: any) => ({
          name,
          gpio: Number(data?.gpio ?? 0),
          amount: Number(data?.amount ?? 0),
          heartbeat_index: data?.heartbeat_index === undefined || data?.heartbeat_index === null
            ? undefined
            : Number(data.heartbeat_index),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    yoloboxStatus(): { enabled: boolean; connected: boolean } {
      return {
        enabled: Boolean(this.integrations?.yolobox?.enabled),
        connected: Boolean(this.integrations?.yolobox?.connected),
      }
    },

    canAddWled(): boolean {
      return Boolean(this.wledForm.name.trim() && this.wledForm.ip.trim())
    },

    canAddObs(): boolean {
      return Boolean(
        this.obsForm.name.trim()
        && this.obsForm.ip.trim()
        && Number(this.obsForm.port) > 0,
      )
    },

    canSaveNeopixel(): boolean {
      return Boolean(
        this.neopixelForm.name.trim()
        && Number.isInteger(Number(this.neopixelForm.gpio))
        && Number(this.neopixelForm.gpio) >= 0
        && Number.isInteger(Number(this.neopixelForm.amount))
        && Number(this.neopixelForm.amount) > 0,
      )
    },

    twitchStatus(): { control: boolean; message: boolean } {
      return {
        control: Boolean(this.integrations?.twitch?.control),
        message: Boolean(this.integrations?.twitch?.message),
      }
    },
  },

  methods: {
    async sendWebsocket(method: string, params: any = {}) {
      const websocketClient = getWebsocketClient()

      if (!websocketClient) {
        this.showError('WebSocket is not connected')
        return false
      }

      try {
        const response = await websocketClient.request(method, params)

        if (response?.error) {
          this.showError(response.error?.message ?? response.error ?? 'Request failed')
          return false
        }

        return true
      } catch (error) {
        this.showError(error instanceof Error ? error.message : String(error))
        return false
      }
    },

    async addWled() {
      const name = this.wledForm.name.trim()
      const ip = this.wledForm.ip.trim()

      if (!name || !ip) {
        this.showError('Name and IP are required')
        return
      }

      this.loading.wledAdd = true

      const sent = await this.sendWebsocket('wled_add', {
        name,
        ip,
      })

      this.loading.wledAdd = false

      if (!sent) return

      this.wledForm.name = ''
      this.wledForm.ip = ''
      this.showSuccess('WLED saved')
    },

    async removeWled(name: string) {
      if (!name) return

      this.loading.wledRemove = name

      const sent = await this.sendWebsocket('wled_remove', {
        name,
      })

      this.loading.wledRemove = ''

      if (!sent) return

      this.showSuccess('WLED removed')
    },

    async addObs() {
      const name = this.obsForm.name.trim()
      const ip = this.obsForm.ip.trim()
      const port = Number(this.obsForm.port)
      const password = this.obsForm.password.trim()

      if (!name || !ip || !port) {
        this.showError('Name, IP and port are required')
        return
      }

      this.loading.obsAdd = true

      const sent = await this.sendWebsocket('obs_add', {
        name,
        ip,
        port,
        password,
      })

      this.loading.obsAdd = false

      if (!sent) return

      this.obsForm.password = ''
      this.showSuccess('OBS saved')
    },

    async removeObs(name: string) {
      if (!name) return

      this.loading.obsRemove = name

      const sent = await this.sendWebsocket('obs_remove', {
        name,
      })

      this.loading.obsRemove = ''

      if (!sent) return

      this.showSuccess('OBS removed')
    },

    async toggleYolobox(enabled: boolean | null) {
      const nextEnabled = Boolean(enabled)

      this.loading.yoloboxToggle = true

      const sent = await this.sendWebsocket('yolobox_toggle', {
        enabled: nextEnabled,
      })

      this.loading.yoloboxToggle = false

      if (!sent) return

      this.showSuccess(nextEnabled ? 'Yolobox enabled' : 'Yolobox disabled')
    },

    editNeopixel(entry: NeopixelEntry) {
      this.neopixelForm = {
        name: entry.name,
        gpio: entry.gpio,
        amount: entry.amount,
        heartbeat_index: entry.heartbeat_index ?? null,
      }
    },

    async saveNeopixel() {
      const name = this.neopixelForm.name.trim()
      const gpio = Number(this.neopixelForm.gpio)
      const amount = Number(this.neopixelForm.amount)
      const heartbeatIndex = this.neopixelForm.heartbeat_index === null || this.neopixelForm.heartbeat_index === undefined
        ? undefined
        : Number(this.neopixelForm.heartbeat_index)

      if (!name || !Number.isInteger(gpio) || gpio < 0 || !Number.isInteger(amount) || amount <= 0) {
        this.showError('Name, GPIO and amount are required')
        return
      }

      if (heartbeatIndex !== undefined && (!Number.isInteger(heartbeatIndex) || heartbeatIndex < 0 || heartbeatIndex >= amount)) {
        this.showError('Heartbeat index must be inside the LED amount')
        return
      }

      this.loading.neopixelSave = true

      const sent = await this.sendWebsocket('neopixel_add', {
        name,
        gpio,
        amount,
        heartbeat_index: heartbeatIndex,
      })

      this.loading.neopixelSave = false

      if (!sent) return

      this.showSuccess('Neopixel saved')
    },

    async removeNeopixel(name: string) {
      if (!name) return

      this.loading.neopixelRemove = name

      const sent = await this.sendWebsocket('neopixel_remove', {
        name,
      })

      this.loading.neopixelRemove = ''

      if (!sent) return

      if (this.neopixelForm.name === name) {
        this.neopixelForm = {
          name: 'tablet_leds',
          gpio: 17,
          amount: 2,
          heartbeat_index: 1,
        }
      }

      this.showSuccess('Neopixel removed')
    },

    openTwitchAuth(type: TwitchAuthType) {
      const returnTo = encodeURIComponent(window.location.href)

      window.location.href = `${this.appStore.getRestApi}/api/auth/twitch?type=${type}&returnTo=${returnTo}`
    },

    showSuccess(text: string) {
      this.snackbar = {
        show: true,
        text,
        color: 'success',
      }
    },

    showError(text: string) {
      this.snackbar = {
        show: true,
        text,
        color: 'error',
      }
    },
  },
}
</script>


<style scoped>
.integration-card {
  height: 100%;
}

.integration-card :deep(.v-card-title) {
  min-height: 56px;
  padding-bottom: 8px;
}

.integration-card :deep(.v-card-text) {
  padding-top: 8px;
}

.integration-form {
  align-items: center;
}

.integration-action-btn {
  min-height: 40px;
}

.integration-inner-card {
  min-height: 118px;
}

.integration-card :deep(.v-list) {
  padding-top: 0;
}
</style>
