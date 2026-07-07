// Utilities
import { defineStore } from 'pinia'
import { setI18nLanguage, setI18nLanguageFromConfig } from '@/plugins/i18n'

export const useAppStore = defineStore('app', {
  state: () => ({
    assets: {
      assets: [],
      wleds: []
    },
    wledConfigs: {},
    status: {},
    config: {
      websocketPort: 8100,
      webserverPort: 8105
    },
    systemConfig: {
      language: 'en'
    },
    games: [],
    alerts: [],
    websocket: {
      connected: false,
      connecting: false
    },
    shieldMode: false,
    currentGame: {},
    channelPoints: {
      active: [],
      all: []
    },
    audioData: {},
    audioOutputs: {},
    systemInfo: {
      components: {},
      config: {},
    },
    throttled: false,
    scene: {},
    connections: {},
    backendConfig: '',
    parsedBackendConfig: {},
    obsSceneData: [],
    testMode: false,
    voices: [],
    macros: {},
    autoMacros: [],
    variables: {},
    giveaway: {},
    yoloboxData: {},
    obsAudioData: {},
    musicData: {},
    musicCavaData: {},
    storage: {},
    integrations: {},
    settings: {},
  }),
  getters: {
    getConfig: (state) => state.config,
    getSystemConfig: (state) => state.systemConfig,
    getLanguage: (state) => state.systemConfig.language,
    getWebsocket: (state) => {
      return `ws://${location.hostname}:${state.config.websocketPort}`
    },
    getRestApi: (state) => {
      return `http://${location.hostname}:${state.config.webserverPort}`
    },
    getGames: (state) => state.games,
    getAlerts: (state) => state.alerts,
    isWebsocketConnected: (state) => state.websocket.connected,
    isWebsocketConnecting: (state) => state.websocket.connecting,
    getCurrentGame: (state) => state.currentGame,
    isShieldActive: (state) => state.shieldMode,
    getChannelPoints: (state) => state.channelPoints,
    getAudioData: (state) => state.audioData,
    getSystemInfo: (state) => state.systemInfo,
    isThrottled: (state) => state.throttled,
    getScene: (state) => state.scene,
    getConnections: (state) => state.connections,
    getBackendConfig: (state) => state.backendConfig,
    getParsedBackendConfig: (state) => state.parsedBackendConfig,
    getObsSceneData: (state) => state.obsSceneData,
    getTestMode: (state) => state.testMode,
    getVoices: (state) => state.voices,
    getMacros: (state) => state.macros,
    getAutoMacros: (state) => state.autoMacros,
    getVariables: (state) => state.variables,
    getGiveaway: (state) => state.giveaway,
    getYoloboxData: (state) => state.yoloboxData,
    getObsAudioData: (state) => state.obsAudioData,
    getAssets: (state) => state.assets,
    getWledConfigs: (state) => state.wledConfigs,
    getStatus: (state) => state.status,
    getMusicData: (state) => state.musicData,
    getMusicCavaData: (state) => state.musicCavaData,
    getAudioOutput: (state) => state.audioOutputs,
    getAudioOutputs: (state) => state.audioOutputs,
    getStorage: (state) => state.storage,
    getIntegrations: (state) => state.integrations,
    getSettings: (state) => state.settings,
    hasApiWebsite: (state) => {
      const parsedConfig: any = state.parsedBackendConfig ?? {}
      const rawConfig = String(state.backendConfig ?? '')

      if (parsedConfig?.api?.website) return true
      if (parsedConfig?.['api website']) return true
      if (parsedConfig?.api_website) return true
      if (parsedConfig?.website?.api) return true

      const hasRecursiveApiWebsite = (value: any): boolean => {
        if (!value || typeof value !== 'object') return false

        for (const key in value) {
          const normalizedKey = String(key).toLowerCase().replace(/[_.-]+/g, ' ').trim()

          if (normalizedKey === 'api website' && Boolean(value[key])) {
            return true
          }

          if (normalizedKey === 'api') {
            const apiValue = value[key]
            if (apiValue?.website) return true
            if (apiValue?.['website']) return true
          }

          if (hasRecursiveApiWebsite(value[key])) {
            return true
          }
        }

        return false
      }

      return hasRecursiveApiWebsite(parsedConfig) || /(^|\n)\s*\[?api\s+website\]?/i.test(rawConfig)
    },
  },
  actions: {
    async fetchConfig() {
      const request = await fetch(`/config.json`, { cache: "no-store" })
      const config = await request.json()

      this.$patch(state => state.config = {
        ...config,
        websocketPort: config?.websocket?.port ?? 8100,
        webserverPort: config?.webserver?.port ?? 8105,
      })
    },
    async fetchGames() {
      const request = await fetch(`${this.getRestApi}/api/games/all`, { cache: "no-store" })
      const data = (await request.json()).data

      this.games = data

      this.$patch(state => state.games = data)
    },
    setAlerts(alerts: []) {
      this.alerts = alerts
      this.$patch(state => state.alerts = alerts)
    },
    setWebsocketConnected(connected: boolean) {
      this.websocket.connected = connected
      this.$patch(state => state.websocket.connected = connected)
    },
    setWebsocketConnecting(connecting: boolean) {
      this.websocket.connecting = connecting
      this.$patch(state => state.websocket.connecting = connecting)
    },
    setCurrentGame(currentGame: any) {
      this.currentGame = currentGame
      this.$patch(state => state.currentGame = currentGame)
    },
    setShieldActive(shieldMode: boolean) {
      this.shieldMode = shieldMode
      this.$patch(state => state.shieldMode = shieldMode)
    },
    setChannelPoints(channelPoints: []) {
      this.channelPoints = channelPoints
      this.$patch(state => state.channelPoints = channelPoints)
    },
    setAudioData(audioData: {}) {
      this.audioData = audioData
      this.$patch(state => state.audioData = audioData)
    },
    setThrottled(throttled: boolean) {
      this.throttled = throttled
      this.$patch(state => state.throttled = throttled)
    },
    setSystemInfo(systemInfo: any) {
      this.systemInfo = systemInfo
      this.$patch(state => state.systemInfo = systemInfo)
    },
    setScene(scene: {}) {
      this.scene = scene
      this.$patch(state => state.scene = scene)
    },
    setConnections(connections: {}) {
      this.connections = connections
      this.$patch(state => state.connections = connections)
    },
    setBackendConfig(config: string, parsedConfig: any) {
      this.backendConfig = config
      this.parsedBackendConfig = parsedConfig

      this.$patch(state => state.backendConfig = config)
      this.$patch(state => state.parsedBackendConfig = parsedConfig)

      if (parsedConfig?.system_config) {
        this.setSystemConfig(parsedConfig.system_config)
      }
    },
    setSystemConfig(systemConfig: any) {
      const mergedSystemConfig = {
        ...this.systemConfig,
        ...systemConfig
      }

      if (mergedSystemConfig.language) {
        mergedSystemConfig.language = setI18nLanguageFromConfig(mergedSystemConfig.language)
      }

      this.systemConfig = mergedSystemConfig
      this.$patch(state => state.systemConfig = mergedSystemConfig)
    },
    setSystemLanguage(language: string) {
      const normalizedLanguage = setI18nLanguage(language)

      this.setSystemConfig({
        language: normalizedLanguage
      })
    },
    setObsSceneData(obsSceneData: []) {
      this.obsSceneData = obsSceneData
      this.$patch(state => state.obsSceneData = obsSceneData)
    },
    setTestMode(testMode: boolean) {
      this.testMode = testMode
      this.$patch(state => state.testMode = testMode)
    },
    setVoices(voices: []) {
      this.voices = voices
      this.$patch(state => state.voices = voices)
    },
    setMacros(macros: {}) {
      this.macros = macros
      this.$patch(state => state.macros = macros)
    },
    setAutoMacros(autoMacros: []) {
      this.autoMacros = autoMacros
      this.$patch(state => state.autoMacros = autoMacros)
    },
    setVariables(variables: {}) {
      this.variables = variables
      this.$patch(state => state.variables = variables)
    },
    setGiveaway(giveaway: {}) {
      this.giveaway = giveaway
      this.$patch(state => state.giveaway = giveaway)
    },
    setYoloboxData(yoloboxData: {}) {
      this.yoloboxData = yoloboxData
      this.$patch(state => state.yoloboxData = yoloboxData)
    },
    setObsAudioData(obsAudioData: {}) {
      this.obsAudioData = obsAudioData
      this.$patch(state => state.obsAudioData = obsAudioData)
    },
    setAssets(assets: any) {
      this.assets = assets
      this.$patch(state => state.assets = assets)
    },
    setWledConfigs(wledConfigs: any) {
      this.wledConfigs = wledConfigs
      this.$patch(state => state.wledConfigs = wledConfigs)
    },
    setStatus(status: any) {
      this.status = status
      this.$patch(state => state.status = status)
    },
    setMusicData(musicData: any) {
      this.musicData = musicData
      this.$patch(state => state.musicData = musicData)
    },
    setMusicCavaData(musicCavaData: any) {
      this.musicCavaData = musicCavaData
      this.$patch(state => state.musicCavaData = musicCavaData)
    },
    setAudioOutput(audioOutputs: any) {
      this.audioOutputs = audioOutputs
      this.$patch(state => state.audioOutputs = audioOutputs)
    },
    setAudioOutputs(audioOutputs: any) {
      this.audioOutputs = audioOutputs
      this.$patch(state => state.audioOutputs = audioOutputs)
    },
    setStorage(storage: any) {
      this.storage = storage
      this.$patch(state => state.storage = storage)
    },
    setIntegrations(integrations: any) {
      this.integrations = integrations
      this.$patch(state => state.integrations = integrations)
    },
    setSettings(settings: any) {
      this.settings = settings
      this.$patch(state => state.settings = settings)
    },
    async fetchStatus(): Promise<any> {
      let status = 'Unknown'
      try {
        status = (await (await fetch(`${this.getRestApi}/api/status`, { cache: "no-store" })).json()).data
      } catch (error) {
        console.warn(error)
      }

      this.setStatus(status)
      return status
    }
  }
})
