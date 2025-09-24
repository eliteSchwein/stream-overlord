// Utilities
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    config: {
      websocketPort: 8100,
      webserverPort: 8105
    },
    games: [],
    alerts: [],
    websocket: {
      connected: false,
      connecting: false
    },
    shieldMode: false,
    currentGame: {},
    channelPoints: [],
    audioData: {},
    systemInfo: {},
    throttled: false,
    scene: {},
    connections: {},
    backendConfig: ''
  }),
  getters: {
    getConfig: (state) => state.config,
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
    getBackendConfig: (state) => state.backendConfig
  },
  actions: {
    async fetchConfig() {
      const request = await fetch(`/config.json`)
      const config = await request.json()

      this.$patch(state => state.config = {
        websocketPort: config.websocket.port,
        webserverPort: config.webserver.port,
      })
    },
    async fetchGames() {
      const request = await fetch(`${this.getRestApi}/api/game/all`)
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
    setSystemInfo(systemInfo: {}) {
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
    setBackendConfig(config: string) {
      this.backendConfig = config
      this.$patch(state => state.backendConfig = config)
    }
  }
})
