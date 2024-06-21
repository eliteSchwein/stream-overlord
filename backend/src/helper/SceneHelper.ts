import {getConfig} from "./ConfigHelper";
import getWebsocketServer, {getOBSClient} from "../App";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";

const scenes = {}

export default function loadScenes() {
    const config = getConfig((/^scene /g), true)

    for(const sceneName in config) {
        scenes[sceneName] = config[sceneName];
    }
}

export async function triggerScene(name: string) {
    if(!scenes[name]) {
        return false
    }

    const tasks = scenes[name]['tasks']

    logNotice(`trigger ${tasks.length} tasks from ${name} scene`)

    for (const task of tasks) {
        try {
            switch (task.channel) {
                case "obs": {
                    await handleObs(task.method, task.data)
                    break
                }
                case "rest": {
                    await handleRest(task.method, task.endpoint, task.data)
                    break
                }
                case "websocket": {
                    handleWebsocket(task.method, task.data)
                    break
                }
                case "function": {
                    await handleFunction(task.method, task.data)
                    break
                }
            }
        } catch (error) {
            logWarn(`task failed:`)
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }

    return true
}

async function handleFunction(method: string, data: any) {
    logRegular(`trigger function: ${method}`)
    switch (method) {
        case 'sleep': {
            await sleep(data.time)
            break
        }
    }
}

async function handleObs(method: string, data: any) {
    const obsClient = getOBSClient()

    logRegular(`trigger obs: ${method}`)

    await obsClient.send(method, data)
}

async function handleRest(method: string, endpoint: string, data: any) {
    const config = getConfig((/^webserver/g))[0]

    logRegular(`trigger rest: ${method}`)

    const url = `http://localhost:${config.port}/api/${endpoint}`

    await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({method: method, data: data})
    })
}

function handleWebsocket(method: string, data: any) {
    const websocket = getWebsocketServer()

    logRegular(`trigger websocket: ${method}`)

    websocket.send(method, data)
}