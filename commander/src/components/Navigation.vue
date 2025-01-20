<script>
export default {
  data () {
    return {
      rail: true,
    }
  },
  computed: {
    currentRouteName() {
      return this.$route.name;
    }
  }
}
</script>

<template>
  <v-app-bar
    color="primary"
    prominent
    rounded="0"
  >
    <v-app-bar-nav-icon variant="text" @click.stop="rail = !rail"></v-app-bar-nav-icon>

    <v-toolbar-title>{{ currentRouteName }}</v-toolbar-title>

    <v-spacer></v-spacer>

    <template v-if="$vuetify.display.mdAndUp">
      <v-btn icon="mdi-magnify" variant="text"></v-btn>

      <v-btn icon="mdi-filter" variant="text"></v-btn>
    </template>

    <v-btn icon="mdi-dots-vertical" variant="text"></v-btn>
  </v-app-bar>
  <v-navigation-drawer
    class="secondary"
    :model-value="rail"
    @click="rail = false"
  >
    <v-list color="transparent">
      <v-list-item
        prepend-icon="mdi-view-dashboard"
        title="/"
        color=""
        @click.stop="rail = false"
        to="/"></v-list-item>
      <v-list-item
        prepend-icon="mdi-view-dashboard"
        title="/test"
        color=""
        @click.stop="rail = false"
        to="/test"></v-list-item>
      <v-list-item
        prepend-icon="mdi-controller"
        title="/games"
        color=""
        @click.stop="rail = false"
        to="/games"></v-list-item>
    </v-list>
  </v-navigation-drawer>


</template>

<style scoped lang="sass">

</style>
