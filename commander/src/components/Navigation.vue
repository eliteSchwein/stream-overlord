<script>

import {mapActions, mapState} from "pinia";
import {useAppStore} from "@/stores/app";

export default {
  data () {
    return {
      rail: true
    }
  },
  computed: {
    ...mapState(useAppStore, ['getRestApi', 'isShieldActive', 'getSystemInfo', 'isThrottled']),
    currentRouteName() {
      return this.$route.name;
    }
  },
  methods: {
    toggleFullscreen() {
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
    },
    async restartService() {
      await fetch(`${this.getRestApi}/api/restart`)
    },
    async reloadBrowserSources() {
      await fetch(`${this.getRestApi}/api/obs/reload_browsers`)
    },
    reloadCommander() {
      window.location.reload()
    }
  }
}
</script>

<template>
  <v-app-bar
    color="grey-darken-3"
    prominent
    rounded="0"
    density="compact"
    class="topbar"
  >
    <v-app-bar-nav-icon variant="text" @click.stop="rail = !rail"></v-app-bar-nav-icon>

    <v-toolbar-title>{{ currentRouteName }}</v-toolbar-title>

    <v-spacer></v-spacer>

    <template v-for="(systemInfo) in getSystemInfo">
      <v-btn
        class="mr-1"
        color="grey-darken-4"
        variant="flat"
        style="min-width: 120px;"
      >
        <v-icon :icon="'mdi-'+systemInfo.icon"></v-icon>
        <p class="ml-2">{{systemInfo.short}} {{systemInfo.data}}</p>
      </v-btn>
    </template>

    <v-btn
      class="mr-1"
      color="grey-darken-4"
      variant="flat"
      v-if="isThrottled"
    >
      <v-icon icon="mdi-flash" color="warning"></v-icon>
      <p class="text-warning ml-2">Throttled</p>
    </v-btn>

    <v-btn
      color="grey-darken-4"
      variant="flat"
      v-if="isShieldActive"
    >
      <v-icon icon="mdi-shield" color="error"></v-icon>
      <p class="text-error ml-2">Shield</p>
    </v-btn>

    <v-btn
      icon
      text="test"
    >
      <v-icon icon="mdi-dots-vertical"></v-icon>
      <v-menu activator="parent">
        <v-list>
          <v-list-item
            title="Toggle Fullscreen"
            @click="toggleFullscreen"
            prepend-icon="mdi-fullscreen"
          ></v-list-item>
          <v-list-item
            title="Reload Commander"
            @click="reloadCommander"
            prepend-icon="mdi-restart"
          ></v-list-item>
          <v-list-item
            title="Restart Service"
            @click="restartService"
            prepend-icon="mdi-restart"
          ></v-list-item>
          <v-list-item
            title="Reload Browser Sources"
            @click="reloadBrowserSources"
            prepend-icon="mdi-restart"
          ></v-list-item>
        </v-list>
      </v-menu>
    </v-btn>
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
        prepend-icon="mdi-motion-play-outline"
        title="/channelPoints"
        color=""
        @click.stop="rail = false"
        to="/channelPoints"></v-list-item>
      <v-list-item
        prepend-icon="mdi-controller"
        title="/games"
        color=""
        @click.stop="rail = false"
        to="/games"></v-list-item>
      <v-list-item
        prepend-icon="mdi-volume-high"
        title="/audio"
        color=""
        @click.stop="rail = false"
        to="/audio"></v-list-item>
    </v-list>
  </v-navigation-drawer>


</template>

<style scoped lang="scss">

</style>
