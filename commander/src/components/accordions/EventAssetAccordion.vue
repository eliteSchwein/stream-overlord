<template>
  <ChannelPointAssetAccordion
    ref="inner"
    :name="name"
    :disabled="disabled"
    :initial-asset="currentAsset"
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
      pendingAsset: null as any,
    }
  },

  mounted() {
    if (this.pendingAsset !== null) {
      this.setAsset(this.pendingAsset)
      this.pendingAsset = null
    }
  },

  methods: {
    async setAsset(asset: any) {
      // Keep support for parents that manually inject an asset object,
      // but the normal load path is now inner.open() -> websocket assets_read.
      this.currentAsset = asset ?? {}

      await this.$nextTick()

      const inner = this.$refs.inner as any
      if (!inner?.setAsset) {
        this.pendingAsset = this.currentAsset
        return
      }

      await inner.ensureMediaEntries?.()
      return inner.setAsset(this.currentAsset)
    },

    getAssetPayload() {
      return (this.$refs.inner as any)?.getAssetPayload?.() ?? {}
    },
  },
}
</script>
