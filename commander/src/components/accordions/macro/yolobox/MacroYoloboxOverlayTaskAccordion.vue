<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-layers-outline"
    :title="task.data.isSelected ? 'Enable YoloBox overlay' : 'Disable YoloBox overlay'"
    export-prefix="macro_yolobox_overlay"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12" md="8">
        <v-autocomplete
          v-model="task.data.id"
          :items="overlays"
          item-title="title"
          item-value="value"
          label="Overlay"
          variant="outlined"
          clearable
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-select
          v-model="task.data.isSelected"
          :items="stateItems"
          item-title="title"
          item-value="value"
          label="State"
          variant="outlined"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroYoloboxOverlayTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  data() {
    return {
      stateItems: [
        { title: 'Enable', value: true },
        { title: 'Disable', value: false },
      ],
    }
  },
  computed: {
    ...mapState(useAppStore, ['getYoloboxData']),
    task(): any {
      return (this.item as any).task
    },
    overlays(): Array<{ title: string; value: string }> {
      const items = (this.getYoloboxData?.MaterialList ?? []).map((overlay: any) => ({
        title: overlay.name || overlay.materialName || overlay.id,
        value: String(overlay.id),
      }))

      return [{ title: 'All overlays', value: 'all' }, ...items]
    },
  },
  created() {
    this.task.channel = 'yolobox'
    this.task.method = 'set_overlay'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.id ??= ''
    this.task.data.isSelected ??= true
  },
}
</script>
