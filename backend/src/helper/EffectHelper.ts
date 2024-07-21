import getWebsocketServer, {getWebServer} from "../App";

let isActive = false
let activeEffect = ''
let effectPosition = 0
let effectInterval: ReturnType<typeof setInterval> = null

const effects = [
    'bluescreen'
]

export function getActiveEffect() {
    return {
        enabled: isActive,
        effect: activeEffect,
    }
}

export function activateEffect() {
    deactivateEffect()

    isActive = true

    activeEffect = effects[0]
    effectPosition = 1

    getWebsocketServer().send('effect', {enabled: true, effect: activeEffect})

    effectInterval = setInterval(() => {
        if(effectPosition === effects.length) {
            effectPosition = 0
        }

        activeEffect = effects[effectPosition]

        getWebsocketServer().send('effect', {enabled: true, effect: activeEffect})

        effectPosition++
    }, 30 * 1000)
}

export function deactivateEffect() {
    clearInterval(effectInterval)
    isActive = false
    getWebsocketServer().send('effect', {enabled: false})
}