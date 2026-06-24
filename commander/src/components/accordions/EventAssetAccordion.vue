<template>
  <ChannelPointAssetAccordion
    ref="inner"
    :name="name"
    :disabled="disabled"
  />
</template>

<script lang="ts">
import ChannelPointAssetAccordion from '@/components/accordions/ChannelPointAssetAccordion.vue'

export default {
  name: 'EventAssetAccordion',

  components: {
    ChannelPointAssetAccordion,
  },

  props: {
    name: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },

  data() {
    return {
      currentAsset: {} as any,
    }
  },

  methods: {
    async open(name = this.name) {
      const inner = this.$refs.inner as any
      if (!inner?.open) return

      await inner.open(name)

      if (this.currentAsset && Object.keys(this.currentAsset).length) {
        inner.setAsset?.(this.currentAsset)
      }
    },

    async setAsset(asset: any) {
      this.currentAsset = asset ?? {}

      const inner = this.$refs.inner as any
      await inner?.ensureMediaEntries?.()

      return inner?.setAsset?.(this.currentAsset)
    },

    getAssetPayload() {
      return (this.$refs.inner as any)?.getAssetPayload?.() ?? {}
    },
  },
}
</script>
