import {getConfig} from "./ConfigHelper";
import {activateTimer, deactivateTimer, registerTimerCallback, setTimerTime} from "./TimerHelper";
import getWebsocketServer, {getOBSClient} from "../App";
import {isDebug, logDebug, logRegular, logWarn} from "./LogHelper";

let targetSceneName: string = undefined
let targetSceneIndex: number = undefined

export function stopRotateScene() {
    if(!targetSceneName) return
    logRegular(`stopping rotating scene`)
    targetSceneName = undefined
    targetSceneIndex = undefined
    deactivateTimer('scene_rotation')
    registerTimerCallback('scene_rotation', undefined)
    getWebsocketServer().send('notify_visible_element', {target: 'rotating_scene', state: false})
}

export function getTargetRotateScene() { return targetSceneName }

export async function startRotateScene(name: string): Promise<boolean> {
    const rotatingScenes = getConfig((/^rotating_scene /g), true)

    if(!rotatingScenes[name]) return false

    const rotatingScene = rotatingScenes[name]
    const obsClient = getOBSClient()
    const websocketServer = getWebsocketServer()

    try {
        logRegular(`start rotating scene ${name}`)

        stopRotateScene()

        targetSceneIndex = 0
        targetSceneName = rotatingScene.scenes[targetSceneIndex]

        websocketServer.send('notify_visible_element', {target: 'rotating_scene', state: true})
        await obsClient.send('SetCurrentProgramScene', {sceneName: targetSceneName})

        registerTimerCallback('scene_rotation', async () => {
            targetSceneIndex++
            targetSceneName = rotatingScene.scenes[targetSceneIndex]

            if(!targetSceneName) {
                targetSceneIndex = 0
                targetSceneName = rotatingScene.scenes[targetSceneIndex]
            }

            logDebug(`rotate to scene ${targetSceneName}`)

            await obsClient.send('SetCurrentProgramScene', {sceneName: targetSceneName})

            setTimerTime('scene_rotation', rotatingScene.interval * 60)
            activateTimer('scene_rotation')
        })

        setTimerTime('scene_rotation', rotatingScene.interval * 60)
        activateTimer('scene_rotation')
    } catch (error) {
        stopRotateScene()

        if(!isDebug()) {
            logWarn(`rotating scene ${name} failed`)
            return false
        }

        logWarn(`rotating scene ${name} failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return false
    }

    return true
}