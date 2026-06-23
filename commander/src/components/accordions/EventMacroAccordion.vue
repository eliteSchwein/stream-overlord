<template>
  <ChannelPointMacroAccordion
    ref="inner"
    :name="name"
    :initial-content="initialContent"
  />
</template>

<script lang="ts">
import ChannelPointMacroAccordion from '@/components/accordions/ChannelPointMacroAccordion.vue'

export default {
  name: 'EventMacroAccordion',

  components: {
    ChannelPointMacroAccordion,
  },

  props: {
    name: { type: String, default: '' },
    initialContent: { type: String, default: '' },
  },

  methods: {
    setContent(content: string, name = this.name) {
      return (this.$refs.inner as any)?.setContent?.(content, name)
    },

    getContent() {
      return (this.$refs.inner as any)?.getContent?.() ?? this.initialContent
    },
  },
}
</script>
