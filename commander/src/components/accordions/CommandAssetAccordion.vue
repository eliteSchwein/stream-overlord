<template>
  <ChannelPointAssetAccordion
    ref="assetAccordion"
    :name="name"
    :auto-load="autoLoad"
    :disabled="disabled"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import ChannelPointAssetAccordion from '@/components/accordions/ChannelPointAssetAccordion.vue'

export default defineComponent({
  name: 'CommandAssetAccordion',

  components: {
    ChannelPointAssetAccordion,
  },

  props: {
    name: {
      type: String,
      required: true,
    },

    autoLoad: {
      type: Boolean,
      default: true,
    },

    disabled: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    getAccordion(): any {
      return this.$refs.assetAccordion as any
    },

    async open(name?: string) {
      const accordion = this.getAccordion()

      if (!accordion?.open) {
        return
      }

      await accordion.open(name ?? this.name)
    },

    setAsset(asset: Record<string, any>) {
      const accordion = this.getAccordion()

      if (!accordion?.setAsset) {
        return
      }

      accordion.setAsset(asset)
    },

    getAssetPayload(): Record<string, any> {
      const accordion = this.getAccordion()

      if (!accordion?.getAssetPayload) {
        return {}
      }

      return accordion.getAssetPayload()
    },

    async save() {
      const accordion = this.getAccordion()

      if (!accordion?.save) {
        return
      }

      return await accordion.save()
    },

    reset() {
      const accordion = this.getAccordion()

      if (accordion?.reset) {
        accordion.reset()
        return
      }

      accordion?.setAsset?.({
        channel: 'general',
        duration: 5,
      })
    },
  },
})
</script>
