<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import SettingsPanel from './SettingsPanel.vue'

type NetworkStatus = {
  ethernetConnected: boolean
  wifiConnected: boolean
  ssid: string | null
  signalPercent: number | null
  quality: string | null
}

type SettingsPanelExposed = {
  open: () => void
  close: () => void
  toggle: () => void
  handleActivatorPointerDown: (event: PointerEvent) => void
}

const settingsPanel = ref<SettingsPanelExposed | null>(null)

const network = ref<NetworkStatus | null>(null)
const primaryIp = ref<string | null>(null)
const error = ref<string | null>(null)

let intervalId: number | null = null

const headerTitle = computed(() => {
  return primaryIp.value
      ? `http://${primaryIp.value}:8105/commander`
      : 'http://—:8105/commander'
})

const wifiIcon = computed(() => {
  if (!network.value?.wifiConnected) {
    return 'mdi-wifi-off'
  }

  const signal = network.value.signalPercent ?? 0

  if (signal >= 75) return 'mdi-wifi-strength-4'
  if (signal >= 50) return 'mdi-wifi-strength-3'
  if (signal >= 25) return 'mdi-wifi-strength-2'
  return 'mdi-wifi-strength-1'
})

const ethernetIcon = computed(() => {
  return 'mdi-ethernet'
})

const wifiTitle = computed(() => {
  if (error.value) return `Network error: ${error.value}`
  if (!network.value?.wifiConnected) return 'Wi-Fi disconnected'

  const parts = ['Wi-Fi connected']

  if (network.value.ssid) parts.push(network.value.ssid)
  if (network.value.signalPercent !== null) parts.push(`${network.value.signalPercent}%`)
  if (network.value.quality) parts.push(network.value.quality)

  return parts.join(' • ')
})

const ethernetTitle = computed(() => {
  if (error.value) return `Network error: ${error.value}`
  return network.value?.ethernetConnected
      ? 'Ethernet connected'
      : 'Ethernet disconnected'
})

async function refreshNetwork() {
  try {
    network.value = await invoke<NetworkStatus>('get_network_status')
    error.value = null
  } catch (err) {
    error.value = String(err)
  }
}

async function refreshPrimaryIp() {
  try {
    primaryIp.value = await invoke<string>('get_primary_ip_address')
  } catch {
    primaryIp.value = null
  }
}

function onBarPointerDown(event: PointerEvent) {
  settingsPanel.value?.handleActivatorPointerDown(event)
}

onMounted(() => {
  void refreshNetwork()
  void refreshPrimaryIp()

  intervalId = window.setInterval(() => {
    void refreshNetwork()
    void refreshPrimaryIp()
  }, 5000)
})

onUnmounted(() => {
  if (intervalId !== null) {
    window.clearInterval(intervalId)
  }
})
</script>

<template>
  <v-app-bar
      density="compact"
      class="header-bar"
      @pointerdown="onBarPointerDown"
  >
    <v-app-bar-title class="header-title">
      {{ headerTitle }}
    </v-app-bar-title>

    <v-spacer />

    <div class="network-icons">
      <div
          class="network-icon"
          :class="{ 'network-icon--inactive': !network?.ethernetConnected }"
          :title="ethernetTitle"
      >
        <v-icon :icon="ethernetIcon" size="20" />
      </div>

      <div
          class="network-icon"
          :class="{ 'network-icon--inactive': !network?.wifiConnected }"
          :title="wifiTitle"
      >
        <v-icon :icon="wifiIcon" size="20" />
      </div>
    </div>
  </v-app-bar>

  <SettingsPanel ref="settingsPanel" />
</template>

<style scoped lang="scss">
.header-bar {
  touch-action: none;
  user-select: none;
}

.header-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 14px;
  color: white;
}

.network-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.network-icon--inactive {
  opacity: 0.35;
}
</style>