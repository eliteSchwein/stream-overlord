<template>
  <ChannelPointMacroAccordion
    ref="inner"
    :name="name"
    :initial-content="currentContent"
    :disable-macro-read="disableMacroRead"
  />
</template>

<script lang="ts">
import ChannelPointMacroAccordion from '@/components/accordions/ChannelPointMacroAccordion.vue'

export default {
  name: 'EventMacroAccordionLoad',

  components: {
    ChannelPointMacroAccordion,
  },

  props: {
    name: { type: String, default: '' },
    initialContent: { type: String, default: '' },
    disableMacroRead: { type: Boolean, default: false },
  },

  data() {
    return {
      currentContent: this.initialContent,
      pendingContent: null as string | null,
    }
  },

  watch: {
    initialContent(value: string) {
      this.currentContent = value || ''
      this.applyPendingContent()
    },
  },

  mounted() {
    this.applyPendingContent()
  },

  methods: {
    async applyPendingContent() {
      await this.$nextTick()

      const inner = this.$refs.inner as any
      if (!inner?.setContent) return

      if (this.pendingContent !== null) {
        inner.setContent(this.pendingContent, this.name)
        this.pendingContent = null
        return
      }

      if (this.currentContent && this.disableMacroRead) {
        inner.setContent(this.currentContent, this.name)
      }
    },

    setContent(content: string, name = this.name) {
      this.currentContent = content || ''

      const inner = this.$refs.inner as any
      if (!inner?.setContent) {
        this.pendingContent = this.currentContent
        return
      }

      return inner.setContent(this.currentContent, name)
    },

    loadMacro(name = this.name) {
      return (this.$refs.inner as any)?.loadMacro?.(name)
    },

    getContent() {
      return (this.$refs.inner as any)?.getContent?.() ?? this.currentContent
    },
  },
}
</script>
