<template>
  <MacroTaskAccordionTemplate
    class="macro-theme-set-color-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-palette"
    :title="$t('macro.theme.setColor.title')"
    export-prefix="macro_theme_set_color"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-menu
      v-model="showColorPicker"
      :close-on-content-click="false"
      location="bottom"
    >
      <template #activator="{ props }">
        <v-text-field
          v-model="color"
          :label="$t('macro.theme.fields.color')"
          :hint="$t('macro.theme.setColor.hint')"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          prepend-inner-icon="mdi-palette"
          prefix="#"
          maxlength="6"
          v-bind="props"
          @blur="color = normalizeHexColor(color)"
        >
          <template #append-inner>
            <div
              class="theme-color-preview"
              :style="{ backgroundColor: normalizedColorPreview }"
            />
          </template>
        </v-text-field>
      </template>

      <v-card color="grey-darken-3">
        <v-color-picker
          v-model="colorPickerValue"
          hide-inputs
          mode="hex"
        />
      </v-card>
    </v-menu>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroThemeSetColorTaskAccordion',

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
      showColorPicker: false,
    }
  },

  computed: {
    color: {
      get(): string {
        return String((this.item as any).task?.data?.color ?? 'ff9800')
      },
      set(value: unknown) {
        ;(this.item as any).task.data ??= {}
        ;(this.item as any).task.data.color = String(value ?? '')
      },
    },

    colorPickerValue: {
      get(): string {
        return (this as any).normalizedColorPreview
      },
      set(value: string) {
        ;(this as any).color = (this as any).normalizeHexColor(value)
      },
    },

    normalizedColorPreview(): string {
      return `#${(this as any).normalizeHexColor((this as any).color || 'ff9800')}`
    },
  },

  created() {
    ;(this.item as any).task.data ??= {}
    ;(this.item as any).task.data.color = this.normalizeHexColor(
      String((this.item as any).task.data.color ?? 'ff9800'),
    )
  },

  methods: {
    normalizeHexColor(value: unknown): string {
      const normalized = String(value ?? '')
        .trim()
        .replace(/^#/, '')
        .toLowerCase()

      return /^[0-9a-f]{6}$/.test(normalized) ? normalized : 'ff9800'
    },
  },
}
</script>

<style scoped>
.theme-color-preview {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
}
</style>
