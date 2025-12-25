<script>

import {mapActions, mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus.js";

export default {
  data () {
    return {
      rail: true
    }
  },
  computed: {
    ...mapState(useAppStore, [
      'getRestApi',
      'isShieldActive',
      'getSystemInfo',
      'isThrottled',
      'getConnections',
      'getCurrentGame',
      'getParsedBackendConfig'
    ]),
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
      await fetch(`${this.getRestApi}/api/system/restart`)
    },
    async reloadBrowserSources() {
      await fetch(`${this.getRestApi}/api/obs/reload_browsers`)
    },
    showPowerMenu() {
      eventBus.$emit('dialog:show', 'power')
    },
    reloadCommander() {
      window.location.reload()
    },
    updateBot() {
      eventBus.$emit('websocket:send', {
        method: 'update',
        params: {}
      })
    }
  }
}
</script>

<template>
  <v-app-bar
    prominent
    rounded="0"
    density="compact"
    class="topbar"
    color="grey-darken-3"
    extended
    extension-height="10"
  >
    <v-app-bar-nav-icon variant="text" @click.stop="rail = !rail"></v-app-bar-nav-icon>

    <v-app-bar-title>{{ currentRouteName }}</v-app-bar-title>

    <v-spacer></v-spacer>

    <v-btn
      class="mr-1"
      color="grey-darken-4"
      variant="flat"
      :to="{ path: '/connections' }"
      :active="false"
      active-class=""
    >
      <v-icon icon="mdi-webhook"></v-icon>
      <p class="ml-2">{{ Object.keys(getConnections).length }}</p>
    </v-btn>

    <template v-if="!isThrottled && !isShieldActive">
      <template v-for="(systemInfo) in getSystemInfo" :key="systemInfo.short">
        <v-btn
          class="mr-1"
          color="grey-darken-4"
          variant="flat"
          style="min-width: 150px;"
        >
          <v-icon :icon="'mdi-' + systemInfo.icon"></v-icon>
          <p class="ml-2">{{ systemInfo.short }} {{ systemInfo.data }}</p>
        </v-btn>
      </template>
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
            title="Vollbild umschalten"
            @click="toggleFullscreen"
            prepend-icon="mdi-fullscreen"
          ></v-list-item>
          <v-divider></v-divider>
          <v-list-item
            title="Commander neuladen"
            @click="reloadCommander"
            prepend-icon="mdi-restart"
          ></v-list-item>
          <v-list-item
            title="Service neustarten"
            @click="restartService"
            prepend-icon="mdi-restart"
          ></v-list-item>
          <v-list-item
            title="Browser Quellen neuladen"
            @click="reloadBrowserSources"
            prepend-icon="mdi-restart"
          ></v-list-item>
          <v-divider></v-divider>
          <v-list-item
            title="Bot Updaten"
            @click="updateBot"
            prepend-icon="mdi-download"
          ></v-list-item>
          <v-list-item
            title="System herunterfahren"
            @click="showPowerMenu"
            prepend-icon="mdi-power"
          ></v-list-item>
        </v-list>
      </v-menu>
    </v-btn>

    <template #extension>
      <v-progress-linear
        :model-value="100"
        :color="getCurrentGame?.theme?.color ?? 'grey-darken-3'"
        height="3"
      />
    </template>
  </v-app-bar>
  <v-navigation-drawer
    class="secondary"
    :model-value="rail"
  >
    <v-list color="transparent">
      <v-list-item
        prepend-icon="mdi-view-dashboard"
        title="/"
        color=""
        to="/"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>Automatisierungen</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-motion-play-outline"
        title="/channelPoints"
        color=""
        to="/channelPoints"></v-list-item>
      <v-list-item
        prepend-icon="mdi-volume-high"
        title="/audio"
        color=""
        to="/audio"></v-list-item>
      <v-list-item
        prepend-icon="mdi-dialpad"
        title="/macros"
        color=""
        to="/macros"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>Overlay</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-picture-in-picture-top-right"
        title="/overlay"
        color=""
        to="/overlay"></v-list-item>
      <v-list-item
        prepend-icon="mdi-multimedia"
        title="/assets"
        color=""
        to="/assets"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>Streaming Dienste</v-list-subheader>
      <v-list-item
        v-if="getParsedBackendConfig?.yolobox?.enable"
        prepend-icon="mdi-video-box"
        title="/yolobox"
        color=""
        to="/yolobox"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>System Werkzeuge</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-cog"
        title="/editConfig"
        color=""
        to="/editConfig"></v-list-item>
      <v-list-item
        prepend-icon="mdi-webhook"
        title="/connections"
        color=""
        to="/connections"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>SCHW31N Zone</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-controller"
        title="/gameScene"
        color=""
        to="/gameScene"></v-list-item>
    </v-list>
  </v-navigation-drawer>


</template>

<style scoped lang="scss">

</style>
