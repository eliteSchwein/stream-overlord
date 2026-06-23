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

  methods: {
    async open(name = this.name) {
      return await (this.$refs.inner as any)?.open?.(name)
    },

    setAsset(asset: any) {
      return (this.$refs.inner as any)?.setAsset?.(asset)
    },

    getAssetPayload() {
      return (this.$refs.inner as any)?.getAssetPayload?.() ?? {}
    },
  },
}
</script>
