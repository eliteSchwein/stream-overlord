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
  },
  methods: {
    async toggleFullscreen() {
      const target = document.documentElement;

      if (!document.fullscreenElement) {
        if (target.requestFullscreen) {
          target.requestFullscreen();
        } else if (target.mozRequestFullScreen) { // Firefox
          target.mozRequestFullScreen();
        } else if (target.webkitRequestFullscreen) { // Safari
          target.webkitRequestFullscreen();
        } else if (target.msRequestFullscreen) { // IE/Edge
          target.msRequestFullscreen();
        }
        return
      }

      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
      }
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

    <v-menu>
      <template v-slot:activator="{ props }">
        <v-btn icon="mdi-dots-vertical" v-bind="props" variant="text"></v-btn>
      </template>
      <v-list>
        <v-list-item
          title="Toggle Fullscreen"
          @click.stop="toggleFullscreen"
          prepend-icon="mdi-fullscreen"
        ></v-list-item>
      </v-list>
    </v-menu>
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
