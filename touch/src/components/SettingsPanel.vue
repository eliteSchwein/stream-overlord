<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import WifiSettingsCard from './WifiSettingsCard.vue'
import WiredSettingsCard from './WiredSettingsCard.vue'

const panelHeight = ref(window.innerHeight)
const OPEN_THRESHOLD = 110

const panelOffset = ref(-panelHeight.value)
const dragging = ref(false)

let activePointerId: number | null = null
let dragStartY = 0
let dragStartOffset = -panelHeight.value

const isOpen = computed(() => panelOffset.value === 0)

const panelStyle = computed(() => ({
  transform: `translateY(${panelOffset.value}px)`,
  transition: dragging.value ? 'none' : 'transform 220ms ease',
}))

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function open() {
  dragging.value = false
  panelOffset.value = 0
}

function close() {
  dragging.value = false
  panelOffset.value = -panelHeight.value
}

function toggle() {
  if (panelOffset.value === 0) {
    close()
  } else {
    open()
  }
}

function startDrag(event: PointerEvent) {
  activePointerId = event.pointerId
  dragging.value = true
  dragStartY = event.clientY
  dragStartOffset = panelOffset.value
}

function handleActivatorPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  startDrag(event)
}

function handleFooterPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  startDrag(event)
}

function onGlobalPointerMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== activePointerId) return

  const deltaY = event.clientY - dragStartY
  panelOffset.value = clamp(dragStartOffset + deltaY, -panelHeight.value, 0)
}

function onGlobalPointerUp(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return

  const openedAmount = panelHeight.value + panelOffset.value

  dragging.value = false
  activePointerId = null

  if (openedAmount > OPEN_THRESHOLD) {
    open()
  } else {
    close()
  }
}

function onResize() {
  const wasOpen = panelOffset.value === 0
  panelHeight.value = window.innerHeight
  panelOffset.value = wasOpen ? 0 : -panelHeight.value
  dragStartOffset = panelOffset.value
}

onMounted(() => {
  window.addEventListener('pointermove', onGlobalPointerMove)
  window.addEventListener('pointerup', onGlobalPointerUp)
  window.addEventListener('pointercancel', onGlobalPointerUp)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('pointermove', onGlobalPointerMove)
  window.removeEventListener('pointerup', onGlobalPointerUp)
  window.removeEventListener('pointercancel', onGlobalPointerUp)
  window.removeEventListener('resize', onResize)
})

defineExpose({
  open,
  close,
  toggle,
  handleActivatorPointerDown,
})
</script>

<template>
  <teleport to="body">
    <div class="settings-panel" :style="panelStyle">
      <div class="settings-panel__content">
        <v-container fluid class="pa-0">
          <v-row no-gutters class="settings-panel__row">
            <v-col cols="12" md="6" class="settings-panel__col">
              <WifiSettingsCard :panel-open="isOpen" />
            </v-col>

            <v-col cols="12" md="6" class="settings-panel__col">
              <WiredSettingsCard :panel-open="isOpen" />
            </v-col>
          </v-row>
        </v-container>
      </div>

      <div
          class="settings-panel__footer"
          @pointerdown="handleFooterPointerDown"
      >
        <v-btn
            block
            variant="tonal"
            class="settings-panel__footer-btn"
            @click="close"
        >
          <v-icon icon="mdi-chevron-up" size="24" />
        </v-btn>
      </div>
    </div>
  </teleport>
</template>

<style scoped lang="scss">
.settings-panel {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
  user-select: none;
  will-change: transform;
}

.settings-panel__content {
  height: calc(100vh - 92px);
  overflow: auto;
  padding: 8px 12px 12px;
}

.settings-panel__row {
  margin: 0;
}

.settings-panel__col {
  padding: 0;
}

@media (max-width: 959px) {
  .settings-panel__col + .settings-panel__col {
    margin-top: 12px;
  }
}

@media (min-width: 960px) {
  .settings-panel__col:first-child {
    padding-right: 6px;
  }

  .settings-panel__col:last-child {
    padding-left: 6px;
  }
}

.settings-panel__footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 56px;
  background: rgb(var(--v-theme-surface));
  touch-action: none;
}

.settings-panel__footer-btn {
  width: 100%;
  height: 56px;
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
}
</style>