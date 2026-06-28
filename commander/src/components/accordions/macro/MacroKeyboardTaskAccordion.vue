<template>
  <MacroTaskAccordionTemplate
    class="macro-keyboard-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-keyboard-outline"
    :title="'Keyboard: ' + (formatKeyPress(selectedKeys) || 'Empty key press')"
    export-prefix="macro_keyboard"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="keyboardData.name"
          label="Name"
          placeholder="macro"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-number-input
          v-model="keyboardData.duration"
          label="Duration"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-col>

      <v-col cols="12">
        <div class="d-flex align-center mb-3 ga-2">
          <div class="text-subtitle-2">Key press</div>
          <v-spacer />

          <v-btn
            size="small"
            variant="tonal"
            :color="recordingKeys ? 'error' : undefined"
            :prepend-icon="recordingKeys ? 'mdi-stop-circle-outline' : 'mdi-record-circle-outline'"
            @click.prevent.stop="toggleKeyRecording"
          >
            {{ recordingKeys ? 'Stop recording' : 'Record key press' }}
          </v-btn>

          <v-btn
            size="small"
            variant="text"
            prepend-icon="mdi-close"
            @click="clearKeys"
          >
            Clear
          </v-btn>
        </div>

        <v-alert
          v-if="recordingKeys"
          type="warning"
          variant="tonal"
          density="comfortable"
          class="mb-3"
        >
          Press all keys you want, then click <strong>Stop recording</strong>.
        </v-alert>

        <div class="keyboard-shell">
          <div class="keyboard-layout">
            <div class="keyboard-main">
              <div
                v-for="(row, rowIndex) in mainKeyboardRows"
                :key="`main-${rowIndex}`"
                class="keyboard-row"
              >
                <button
                  v-for="(key, keyIndex) in row"
                  :key="`${rowIndex}-${keyIndex}-${key.value}`"
                  type="button"
                  :class="[
                    'keyboard-key',
                    `keyboard-key--${key.size || 'normal'}`,
                    isKeySelected(key.value) ? 'keyboard-key--active' : '',
                  ]"
                  @click="toggleKey(key.value)"
                >
                  {{ key.label }}
                </button>
              </div>
            </div>

            <div class="keyboard-side">
              <div class="keyboard-side-row">
                <button
                  v-for="key in systemKeys"
                  :key="key.value"
                  type="button"
                  :class="[
                    'keyboard-key',
                    'keyboard-key--side',
                    isKeySelected(key.value) ? 'keyboard-key--active' : '',
                  ]"
                  @click="toggleKey(key.value)"
                >
                  {{ key.label }}
                </button>
              </div>

              <div class="keyboard-arrow-grid">
                <div />

                <button
                  type="button"
                  :class="[
                    'keyboard-key',
                    'keyboard-key--side',
                    isKeySelected('UP') ? 'keyboard-key--active' : '',
                  ]"
                  @click="toggleKey('UP')"
                >
                  ↑
                </button>

                <div />

                <button
                  type="button"
                  :class="[
                    'keyboard-key',
                    'keyboard-key--side',
                    isKeySelected('LEFT') ? 'keyboard-key--active' : '',
                  ]"
                  @click="toggleKey('LEFT')"
                >
                  ←
                </button>

                <button
                  type="button"
                  :class="[
                    'keyboard-key',
                    'keyboard-key--side',
                    isKeySelected('DOWN') ? 'keyboard-key--active' : '',
                  ]"
                  @click="toggleKey('DOWN')"
                >
                  ↓
                </button>

                <button
                  type="button"
                  :class="[
                    'keyboard-key',
                    'keyboard-key--side',
                    isKeySelected('RIGHT') ? 'keyboard-key--active' : '',
                  ]"
                  @click="toggleKey('RIGHT')"
                >
                  →
                </button>
              </div>
            </div>

            <div class="keyboard-numpad">
              <button
                v-for="key in numpadKeys"
                :key="key.value"
                type="button"
                :class="[
                  'keyboard-key',
                  'keyboard-key--numpad',
                  key.size ? `keyboard-key--numpad-${key.size}` : '',
                  isKeySelected(key.value) ? 'keyboard-key--active' : '',
                ]"
                @click="toggleKey(key.value)"
              >
                {{ key.label }}
              </button>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroKeyboardTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      recordingKeys: false,
      pressedKeys: new Set<string>(),
      keyRecorderCleanup: null as null | (() => void),
    }
  },

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'keyboard'
      task.method = 'press'
      task.data ??= {}
      task.data.name ??= 'macro'

      if (!Array.isArray(task.data.keys)) {
        task.data.keys = []
      }

      if (Array.isArray(task.data.keys[0])) {
        task.data.keys = task.data.keys[0]
      }

      task.data.keys = task.data.keys
        .map((key: any) => String(key).trim())
        .filter(Boolean)

      return task
    },

    keyboardData(): any {
      return this.task.data
    },

    selectedKeys(): string[] {
      return this.keyboardData.keys
    },

    mainKeyboardRows(): any[] {
      return [
        [
          { label: 'Esc', value: 'ESC' },
          { label: 'F1', value: 'F1' },
          { label: 'F2', value: 'F2' },
          { label: 'F3', value: 'F3' },
          { label: 'F4', value: 'F4' },
          { label: 'F5', value: 'F5' },
          { label: 'F6', value: 'F6' },
          { label: 'F7', value: 'F7' },
          { label: 'F8', value: 'F8' },
          { label: 'F9', value: 'F9' },
          { label: 'F10', value: 'F10' },
          { label: 'F11', value: 'F11' },
          { label: 'F12', value: 'F12' },
        ],
        [
          { label: 'F13', value: 'F13', size: 'fkey' },
          { label: 'F14', value: 'F14', size: 'fkey' },
          { label: 'F15', value: 'F15', size: 'fkey' },
          { label: 'F16', value: 'F16', size: 'fkey' },
          { label: 'F17', value: 'F17', size: 'fkey' },
          { label: 'F18', value: 'F18', size: 'fkey' },
          { label: 'F19', value: 'F19', size: 'fkey' },
          { label: 'F20', value: 'F20', size: 'fkey' },
          { label: 'F21', value: 'F21', size: 'fkey' },
          { label: 'F22', value: 'F22', size: 'fkey' },
          { label: 'F23', value: 'F23', size: 'fkey' },
          { label: 'F24', value: 'F24', size: 'fkey' },
        ],
        [
          { label: '`', value: '`' },
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '5', value: '5' },
          { label: '6', value: '6' },
          { label: '7', value: '7' },
          { label: '8', value: '8' },
          { label: '9', value: '9' },
          { label: '0', value: '0' },
          { label: '-', value: '-' },
          { label: '=', value: '=' },
          { label: 'Backspace', value: 'BACKSPACE', size: 'backspace' },
        ],
        [
          { label: 'Tab', value: 'TAB', size: 'tab' },
          { label: 'Q', value: 'Q' },
          { label: 'W', value: 'W' },
          { label: 'E', value: 'E' },
          { label: 'R', value: 'R' },
          { label: 'T', value: 'T' },
          { label: 'Y', value: 'Y' },
          { label: 'U', value: 'U' },
          { label: 'I', value: 'I' },
          { label: 'O', value: 'O' },
          { label: 'P', value: 'P' },
          { label: '[', value: '[' },
          { label: ']', value: ']' },
          { label: '\\', value: '\\', size: 'slash' },
        ],
        [
          { label: 'Caps', value: 'CAPSLOCK', size: 'caps' },
          { label: 'A', value: 'A' },
          { label: 'S', value: 'S' },
          { label: 'D', value: 'D' },
          { label: 'F', value: 'F' },
          { label: 'G', value: 'G' },
          { label: 'H', value: 'H' },
          { label: 'J', value: 'J' },
          { label: 'K', value: 'K' },
          { label: 'L', value: 'L' },
          { label: ';', value: ';' },
          { label: "'", value: "'" },
          { label: 'Enter', value: 'ENTER', size: 'enter' },
        ],
        [
          { label: 'Shift', value: 'SHIFT', size: 'shift-left' },
          { label: 'Z', value: 'Z' },
          { label: 'X', value: 'X' },
          { label: 'C', value: 'C' },
          { label: 'V', value: 'V' },
          { label: 'B', value: 'B' },
          { label: 'N', value: 'N' },
          { label: 'M', value: 'M' },
          { label: ',', value: ',' },
          { label: '.', value: '.' },
          { label: '/', value: '/' },
          { label: 'Shift', value: 'SHIFT', size: 'shift-right' },
        ],
        [
          { label: 'Ctrl', value: 'CTRL', size: 'mod' },
          { label: 'Win', value: 'META', size: 'mod' },
          { label: 'Alt', value: 'ALT', size: 'mod' },
          { label: 'Space', value: 'SPACE', size: 'space' },
          { label: 'Alt', value: 'ALT', size: 'mod' },
          { label: 'Win', value: 'META', size: 'mod' },
          { label: 'Menu', value: 'MENU', size: 'mod' },
          { label: 'Ctrl', value: 'CTRL', size: 'mod' },
        ],
      ]
    },

    systemKeys(): any[] {
      return [
        { label: 'Print', value: 'PRINTSCREEN' },
        { label: 'ScrLk', value: 'SCROLLLOCK' },
        { label: 'Pause', value: 'PAUSE' },
        { label: 'Ins', value: 'INSERT' },
        { label: 'Del', value: 'DELETE' },
        { label: 'Home', value: 'HOME' },
        { label: 'End', value: 'END' },
        { label: 'PgUp', value: 'PAGEUP' },
        { label: 'PgDn', value: 'PAGEDOWN' },
      ]
    },

    numpadKeys(): any[] {
      return [
        { label: 'Num', value: 'NUMLOCK' },
        { label: '/', value: 'NUMPAD_DIVIDE' },
        { label: '*', value: 'NUMPAD_MULTIPLY' },
        { label: '-', value: 'NUMPAD_SUBTRACT' },
        { label: '7', value: 'NUMPAD_7' },
        { label: '8', value: 'NUMPAD_8' },
        { label: '9', value: 'NUMPAD_9' },
        { label: '+', value: 'NUMPAD_ADD', size: 'tall' },
        { label: '4', value: 'NUMPAD_4' },
        { label: '5', value: 'NUMPAD_5' },
        { label: '6', value: 'NUMPAD_6' },
        { label: '1', value: 'NUMPAD_1' },
        { label: '2', value: 'NUMPAD_2' },
        { label: '3', value: 'NUMPAD_3' },
        { label: 'Enter', value: 'NUMPAD_ENTER', size: 'tall' },
        { label: '0', value: 'NUMPAD_0', size: 'wide' },
        { label: '.', value: 'NUMPAD_DECIMAL' },
      ]
    },
  },

  beforeUnmount() {
    this.stopKeyRecording(false)
  },

  methods: {
    formatKeyPress(value: any): string {
      if (!Array.isArray(value)) return ''
      return value.join(' + ')
    },

    isKeySelected(key: string): boolean {
      return this.selectedKeys.includes(key)
    },

    setSelectedKeys(keys: string[]) {
      this.keyboardData.keys.splice(0, this.keyboardData.keys.length, ...keys)
    },

    toggleKey(key: string) {
      const keys = [...this.selectedKeys]
      const keyIndex = keys.indexOf(key)

      if (keyIndex >= 0) {
        keys.splice(keyIndex, 1)
      } else {
        keys.push(key)
      }

      this.setSelectedKeys(keys)
    },

    clearKeys() {
      this.setSelectedKeys([])
    },

    toggleKeyRecording() {
      if (this.recordingKeys) {
        this.stopKeyRecording(true)
        return
      }

      this.startKeyRecording()
    },

    startKeyRecording() {
      this.recordingKeys = true
      this.pressedKeys = new Set<string>()

      const onKeyDown = (event: KeyboardEvent) => {
        event.preventDefault()
        event.stopPropagation()

        this.pressedKeys.add(this.normalizeRecordedKey(event.key))
      }

      const onKeyUp = (event: KeyboardEvent) => {
        event.preventDefault()
        event.stopPropagation()
      }

      window.addEventListener('keydown', onKeyDown, true)
      window.addEventListener('keyup', onKeyUp, true)

      this.keyRecorderCleanup = () => {
        window.removeEventListener('keydown', onKeyDown, true)
        window.removeEventListener('keyup', onKeyUp, true)
      }
    },

    stopKeyRecording(save: boolean) {
      this.keyRecorderCleanup?.()
      this.keyRecorderCleanup = null

      const keys = [...this.pressedKeys].filter(Boolean)

      this.recordingKeys = false
      this.pressedKeys = new Set<string>()

      if (save) {
        this.setSelectedKeys(keys)
      }
    },

    normalizeRecordedKey(key: string): string {
      const map: Record<string, string> = {
        Control: 'CTRL',
        Shift: 'SHIFT',
        Alt: 'ALT',
        Meta: 'META',
        Escape: 'ESC',
        ' ': 'SPACE',
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        Backspace: 'BACKSPACE',
        Delete: 'DELETE',
        Insert: 'INSERT',
        Home: 'HOME',
        End: 'END',
        PageUp: 'PAGEUP',
        PageDown: 'PAGEDOWN',
        PrintScreen: 'PRINTSCREEN',
        ScrollLock: 'SCROLLLOCK',
        Pause: 'PAUSE',
        Enter: 'ENTER',
        Tab: 'TAB',
        CapsLock: 'CAPSLOCK',
      }

      return map[key] ?? key.toUpperCase()
    },
  },
}
</script>

<style scoped>
.keyboard-shell {
  max-width: 100%;
  overflow-x: auto;
  display: flex;
  justify-content: center;
  padding: 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  background:
    radial-gradient(circle at 20% 0%, rgba(var(--v-theme-primary), 0.08), transparent 34%),
    rgba(255, 255, 255, 0.025);
}

.keyboard-layout {
  --key: 44px;
  --gap: 6px;
  display: flex;
  align-items: flex-end;
  gap: 26px;
  width: max-content;
  margin: 0 auto;
}

.keyboard-main {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.keyboard-row {
  display: grid;
  grid-template-columns: repeat(15, var(--key));
  grid-auto-rows: var(--key);
  gap: var(--gap);
}

.keyboard-key {
  position: relative;
  min-width: 0;
  height: var(--key);
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-bottom-color: rgba(0, 0, 0, 0.42);
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.045));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    0 2px 0 rgba(0, 0, 0, 0.28);
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}

.keyboard-key:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.07));
  border-color: rgba(255, 255, 255, 0.24);
}

.keyboard-key:active {
  transform: translateY(1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 1px 0 rgba(0, 0, 0, 0.24);
}

.keyboard-key--active {
  background: linear-gradient(180deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), 0.78));
  border-color: rgba(var(--v-theme-primary), 0.95);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 0 0 2px rgba(var(--v-theme-primary), 0.20),
    0 2px 0 rgba(0, 0, 0, 0.25);
  color: rgb(var(--v-theme-on-primary));
}

.keyboard-key--backspace { grid-column: span 2; }
.keyboard-key--tab { grid-column: span 2; }
.keyboard-key--slash { grid-column: span 1; }
.keyboard-key--caps { grid-column: span 2; }
.keyboard-key--enter { grid-column: span 2; }
.keyboard-key--shift-left { grid-column: span 2; }
.keyboard-key--shift-right { grid-column: span 3; }
.keyboard-key--mod { grid-column: span 1; }
.keyboard-key--fkey { grid-column: span 1; }
.keyboard-key--space { grid-column: span 6; }

.keyboard-side {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 1px;
}

.keyboard-side-row {
  display: grid;
  grid-template-columns: repeat(3, 54px);
  grid-auto-rows: var(--key);
  gap: var(--gap);
}

.keyboard-key--side {
  width: 54px;
  min-width: 54px;
  padding: 0 6px;
}

.keyboard-arrow-grid {
  display: grid;
  grid-template-columns: repeat(3, 54px);
  grid-auto-rows: var(--key);
  gap: var(--gap);
}

.keyboard-numpad {
  display: grid;
  grid-template-columns: repeat(4, 54px);
  grid-auto-rows: var(--key);
  gap: var(--gap);
  padding-bottom: 1px;
}

.keyboard-key--numpad {
  width: 54px;
  min-width: 54px;
  padding: 0 6px;
}

.keyboard-key--numpad-tall {
  grid-row: span 2;
  height: calc((var(--key) * 2) + var(--gap));
}

.keyboard-key--numpad-wide {
  grid-column: span 2;
  width: 100%;
}

@media (max-width: 900px) {
  .keyboard-shell {
    padding: 12px;
  }

  .keyboard-layout {
    --key: 40px;
    gap: 18px;
  }

  .keyboard-key {
    border-radius: 8px;
    font-size: 11px;
    padding-inline: 6px;
  }

  .keyboard-side-row,
  .keyboard-arrow-grid {
    grid-template-columns: repeat(3, 50px);
  }

  .keyboard-numpad {
    grid-template-columns: repeat(4, 50px);
  }

  .keyboard-key--side,
  .keyboard-key--numpad {
    width: 50px;
    min-width: 50px;
  }

  .keyboard-key--numpad-wide {
    width: 100%;
  }
}
</style>
