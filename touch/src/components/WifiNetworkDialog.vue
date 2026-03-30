<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type WifiNetwork = {
  ssid: string
  secured: boolean
  saved: boolean
  signalPercent: number | null
}

const props = defineProps<{
  modelValue: boolean
  mode: 'connect' | 'forget' | 'hidden'
  network: WifiNetwork | null
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: { ssid?: string; password?: string }): void
}>()

const password = ref('')
const hiddenSsid = ref('')

const isSavedConnect = computed(() => {
  return props.mode === 'connect' && Boolean(props.network?.saved)
})

watch(
    () => props.modelValue,
    (open) => {
      if (open) {
        password.value = ''
        hiddenSsid.value = ''
      }
    }
)

const title = computed(() => {
  if (props.mode === 'forget') return 'Remove saved Wi-Fi'
  if (props.mode === 'hidden') return 'Connect to hidden Wi-Fi'
  return 'Connect to Wi-Fi'
})

const submitLabel = computed(() => {
  if (props.mode === 'forget') return 'Remove'
  return 'Connect'
})

const submitDisabled = computed(() => {
  if (props.busy) return true

  if (props.mode === 'hidden') {
    return hiddenSsid.value.trim().length === 0
  }

  if (
      props.mode === 'connect' &&
      props.network?.secured &&
      !props.network?.saved
  ) {
    return password.value.trim().length === 0
  }

  return false
})

function close() {
  emit('update:modelValue', false)
}

function submit() {
  emit('submit', {
    ssid: props.mode === 'hidden' ? hiddenSsid.value.trim() : undefined,
    password: password.value.trim() || undefined,
  })
}
</script>

<template>
  <v-dialog
      :model-value="modelValue"
      max-width="420"
      @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ title }}</v-card-title>

      <v-card-text>
        <template v-if="mode === 'hidden'">
          <v-text-field
              v-model="hiddenSsid"
              label="SSID"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              class="mb-4"
          />

          <v-text-field
              v-model="password"
              label="Password"
              type="password"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
          />
        </template>

        <template v-else-if="network">
          <div class="dialog-network-name">
            {{ network.ssid }}
          </div>

          <template v-if="mode === 'connect'">
            <div class="dialog-text">
              <template v-if="network.saved">
                This network is already saved. Connect directly, or enter a new password if you want to update it.
              </template>
              <template v-else-if="network.secured">
                Enter the password for this network.
              </template>
              <template v-else>
                This network is open.
              </template>
            </div>

            <v-text-field
                v-if="network.secured"
                v-model="password"
                :label="isSavedConnect ? 'Password (optional)' : 'Password'"
                type="password"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mt-4"
            />
          </template>

          <template v-else>
            <div class="dialog-text">
              Remove this saved network from the device?
            </div>
          </template>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn
            color="primary"
            variant="text"
            :loading="busy"
            :disabled="submitDisabled"
            @click="submit"
        >
          {{ submitLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
.dialog-network-name {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.dialog-text {
  opacity: 0.82;
}
</style>