<script>

import {mapActions, mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus.js";
import {sleep} from "@/helper/GeneralHelper.ts";
import {getWebsocketClient} from "@/plugins/websocketInstance";

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
      'getParsedBackendConfig',
      'getObsAudioData',
      'getIntegrations'
    ]),
    currentRouteTitle() {
      const path = this.$route.path || '/';
      const firstPathPart = path.split('?')[0].split('#')[0].split('/').filter(Boolean)[0] || 'dashboard';

      const titleMap = {
        dashboard: 'dashboard',
        channelPoints: 'channelPoints',
        events: 'events',
        macros: 'macros',
        rotatingscenes: 'rotatingscene',
        variables: 'variables',
        audio: 'audio',
        music: 'music',
        overlay: 'overlay',
        assets: 'assets',
        media: 'media',
        yolobox: 'yolobox',
        editConfig: 'config',
        connections: 'connections',
        recovery: 'recovery',
        gameScene: 'gameScene',
        obs: 'obs'
      };

      const titleKey = titleMap[firstPathPart] || firstPathPart;
      const translationKey = `navigation.tabs.${titleKey}`;

      return this.$te(translationKey)
        ? this.$t(translationKey)
        : this.$t('navigation.tabs.dashboard');
    },
    hasObsConfig() {
      const integrations = this.getIntegrations || {}
      const obsIntegrations = integrations.obs || {}

      if(obsIntegrations && typeof obsIntegrations === 'object' && Object.keys(obsIntegrations).length > 0) {
        return true
      }

      const config = this.getParsedBackendConfig || {}

      return Object.entries(config).some(([key, value]) => {
        if(!/^obs/i.test(key)) return false

        if(Array.isArray(value)) {
          return value.some((entry) => !!entry?.ip)
        }

        if(value && typeof value === 'object') {
          return !!value.ip || Object.values(value).some((entry) => !!entry?.ip)
        }

        return false
      })
    },
    hasYoloboxEnabled() {
      const integrations = this.getIntegrations || {}

      return Boolean(integrations.yolobox?.enabled)
    }
  },
  methods: {
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
    async updateBot() {
      getWebsocketClient()?.send("update")

      // wait until /api/status is NOT reachable (connection lost)
      for (;;) {
        try {
          const r = await fetch(`${this.getRestApi}/api/status`, { cache: "no-store" })
          if (!r.ok) break
        } catch {
          break
        }
        await sleep(500)
      }

      // wait until /api/status is reachable again (connection back)
      for (;;) {
        try {
          const r = await fetch(`${this.getRestApi}/api/status`, { cache: "no-store" })
          if (r.ok) break
        } catch {
          // still down
        }
        await sleep(500)
      }

      window.location.reload()
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

    <v-app-bar-title>{{ currentRouteTitle }}</v-app-bar-title>

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
      <p class="ml-2 ubuntu-mono">{{ Object.keys(getConnections).length }}</p>
    </v-btn>

    <v-btn
      class="mr-1"
      color="grey-darken-4"
      variant="flat"
      style="min-width: 175px;"
    >
      <span class="py-0 my-0 cpu-entry ubuntu-mono">
        <v-icon size="18" icon="mdi-cpu-64-bit"></v-icon>
        <span class="ml-1 mr-2 mt-0 mb-0">{{ Math.round(getSystemInfo?.components?.load?.currentLoad) }} %</span>
      </span>
      <span class="py-0 my-0 cpu-entry ubuntu-mono">
        <v-icon size="18" icon="mdi-thermometer"></v-icon>
        <span class="ml-1 mr-1 mt-0 mb-0">{{ Math.round(getSystemInfo?.components?.cpu?.temp?.main)}} °C</span>
      </span>
    </v-btn>

    <!--
    <template v-if="!isThrottled && !isShieldActive">
      <template v-for="(systemInfo) in getSystemInfo?.config" :key="systemInfo.short">
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
    -->

    <v-btn
      class="mr-1"
      color="grey-darken-4"
      variant="flat"
      v-if="isThrottled"
    >
      <v-icon icon="mdi-flash" color="warning"></v-icon>
      <p class="text-warning ml-2">{{ $t('navigation.status.throttled') }}</p>
    </v-btn>

    <v-btn
      color="grey-darken-4"
      variant="flat"
      v-if="isShieldActive"
    >
      <v-icon icon="mdi-shield" color="error"></v-icon>
      <p class="text-error ml-2">{{ $t('navigation.status.shield') }}</p>
    </v-btn>

    <v-btn
      icon
      text="test"
    >
      <v-icon icon="mdi-dots-vertical"></v-icon>
      <v-menu activator="parent">
        <v-list>
          <v-list-item
            :title="$t('navigation.actions.reloadPage')"
            @click="reloadCommander"
            prepend-icon="mdi-restart"
          ></v-list-item>
          <v-list-item
            :title="$t('navigation.actions.restartBot')"
            @click="restartService"
            prepend-icon="mdi-robot"
          ></v-list-item>
          <template v-if="Object.keys(getObsAudioData).length > 0">
            <v-list-item
              :title="$t('navigation.actions.reloadBrowserSources')"
              @click="reloadBrowserSources"
              prepend-icon="mdi-application-outline"
            ></v-list-item>
          </template>
          <v-divider></v-divider>
          <v-list-item
            :title="$t('navigation.actions.updateBot')"
            @click="updateBot"
            prepend-icon="mdi-download"
          ></v-list-item>
          <v-list-item
            :title="$t('navigation.actions.shutdownSystem')"
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
        :title="$t('navigation.tabs.dashboard')"
        color=""
        to="/"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>{{ $t('navigation.sections.automation') }}</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-motion-play-outline"
        :title="$t('navigation.tabs.channelPoints')"
        color=""
        to="/channelPoints"></v-list-item>
      <v-list-item
        prepend-icon="mdi-lightning-bolt"
        :title="$t('navigation.tabs.events') || 'Events'"
        color=""
        to="/events"></v-list-item>
      <v-list-item
        prepend-icon="mdi-console-line"
        :title="$t('navigation.tabs.commands')"
        color=""
        to="/commands"></v-list-item>
      <v-list-item
        prepend-icon="mdi-dialpad"
        :title="$t('navigation.tabs.macros')"
        color=""
        to="/macros"></v-list-item>
      <v-list-item
        prepend-icon="mdi-auto-mode"
        :title="$t('navigation.tabs.automacros')"
        color=""
        to="/automacros"></v-list-item>
      <v-list-item
        prepend-icon="mdi-filmstrip"
        :title="$t('navigation.tabs.rotatingscene')"
        color=""
        to="/rotatingscenes"></v-list-item>
      <v-list-item
        prepend-icon="mdi-variable"
        :title="$t('navigation.tabs.variables')"
        color=""
        to="/variables"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>{{ $t('navigation.sections.audio') }}</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-volume-high"
        :title="$t('navigation.tabs.audio')"
        color=""
        to="/audio"></v-list-item>
      <v-list-item
        prepend-icon="mdi-music"
        :title="$t('navigation.tabs.music')"
        color=""
        to="/music"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>{{ $t('navigation.sections.overlay') }}</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-picture-in-picture-top-right"
        :title="$t('navigation.tabs.overlay')"
        color=""
        to="/overlay"></v-list-item>
      <v-list-item
        prepend-icon="mdi-palette"
        :title="$t('navigation.tabs.assets')"
        color=""
        to="/assets"></v-list-item>
      <v-list-item
        prepend-icon="mdi-multimedia"
        :title="$t('navigation.tabs.media')"
        color=""
        to="/media"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>{{ $t('navigation.sections.streamingServices') }}</v-list-subheader>
      <v-list-item
        v-if="hasObsConfig"
        prepend-icon="mdi-video-box"
        :title="$t('navigation.tabs.obs')"
        color=""
        to="/obs"></v-list-item>
      <v-list-item
        v-if="hasYoloboxEnabled"
        prepend-icon="mdi-video-box"
        :title="$t('navigation.tabs.yolobox')"
        color=""
        to="/yolobox"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>{{ $t('navigation.sections.systemTools') }}</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-cog"
        :title="$t('navigation.tabs.config')"
        color=""
        to="/editConfig"></v-list-item>
      <v-list-item
        prepend-icon="mdi-vector-link"
        :title="$t('navigation.tabs.integrations')"
        color=""
        to="/integrations"></v-list-item>
      <v-list-item
        prepend-icon="mdi-webhook"
        :title="$t('navigation.tabs.connections')"
        color=""
        to="/connections"></v-list-item>
      <v-list-item
        prepend-icon="mdi-heart-cog"
        :title="$t('navigation.tabs.recovery')"
        color=""
        to="/recovery"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>{{ $t('navigation.sections.schw31nZone') }}</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-controller"
        :title="$t('navigation.tabs.gameScene')"
        color=""
        to="/gameScene"></v-list-item>
    </v-list>
  </v-navigation-drawer>


</template>

<style scoped lang="scss">
.cpu-entry {
  width: 65px;
  max-width: 65px;
  display: flex;
  align-items: flex-start;

  i {
    margin-top: 4px;
  }

  span {
    margin-top: 2px;
    font-size: 15px;
  }
}
</style>
