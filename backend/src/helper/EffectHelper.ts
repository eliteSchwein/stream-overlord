import getWebsocketServer from '../App'

let isActive = false
let activeEffect = ''
let effectPosition = 0
let effectInterval: ReturnType<typeof setInterval> | null = null

const target = '123'

const effects = [
    {
        effect: 'slide',
        content: '',
        options: {
            x: 0,
            y: 32,
            duration: 500,
        },
    },
    {
        effect: 'fade',
        content: '',
        options: {
            duration: 500,
        },
    },
]

export function getActiveEffect() {
    return {
        enabled: isActive,
        target,
        effect: activeEffect,
    }
}

export function activateEffect() {
    deactivateEffect()

    isActive = true
    effectPosition = 0

    sendCurrentEffect()

    effectInterval = setInterval(() => {
        effectPosition++

        if (effectPosition >= effects.length) {
            effectPosition = 0
        }

        sendCurrentEffect()
    }, 30 * 1000)
}

export function deactivateEffect() {
    if (effectInterval) {
        clearInterval(effectInterval)
        effectInterval = null
    }

    isActive = false
    activeEffect = ''

    getWebsocketServer().send('notify_effect', {
        target,
        effect: null,
        content: '',
        options: {},
    })
}

function sendCurrentEffect() {
    const currentEffect = effects[effectPosition]

    activeEffect = currentEffect.effect

    getWebsocketServer().send('notify_effect', {
        target,
        effect: currentEffect.effect,
        content: currentEffect.content,
        options: currentEffect.options,
    })
}