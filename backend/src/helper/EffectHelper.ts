import getWebsocketServer from "../App";

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

    getWebsocketServer().send('notify_effect', {action: 'show', effect: activeEffect})

    effectInterval = setInterval(() => {
        if(effectPosition === effects.length) {
            effectPosition = 0
        }

        activeEffect = effects[effectPosition]

        getWebsocketServer().send('notify_effect', {action: 'show', effect: activeEffect})

        effectPosition++
    }, 30 * 1000)
}

export function deactivateEffect() {
    clearInterval(effectInterval)
    isActive = false
    getWebsocketServer().send('notify_effect', {action: 'hide'})
}