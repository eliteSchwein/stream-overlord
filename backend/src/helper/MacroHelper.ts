import {getConfig, getPrimaryChannel} from "./ConfigHelper";
import getWebsocketServer, {getOBSClient, getTauonmbClient, getTwitchClient, getYoloboxClient} from "../App";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {parsePlaceholders} from "./DataHelper";
import fillTemplate from "./TemplateHelper";

let macros = {}

export default function loadMacros() {
    logRegular('load macros')
    macros = {}
    const config = getConfig((/^macro /g), true)

    for(const macroName in config) {
        macros[macroName] = config[macroName];
    }

    getWebsocketServer().send("notify_macro_update", { macros: macros })
}

export function getMacros() {
    return macros
}

export function isMacroPresent(name: string) {
    return macros[name] !== undefined
}

export async function triggerMacro(name: string) {
    if(!macros[name]) {
        return false
    }

    const tasks = macros[name]['tasks']

    logNotice(`trigger ${tasks.length} tasks from ${name} macro`)

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
                case "macro": {
                    await triggerMacro(task.method)
                    break
                }
                case "webhook": {
                    await handleWebhook(task.method, task.data)
                    break
                }
                case "yolobox": {
                    await handleYolobox(task.method, task.data)
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

async function handleYolobox(method: string, data: any) {
    logRegular(`send yolobox command: ${method}`)

    const yoloboxData = getYoloboxClient()?.getData()

    if(!yoloboxData) {
        logWarn(`yolobox is currently not connected`)
        return
    }

    if(method === "order_material_change") {
        for(const material of yoloboxData.MaterialList) {
            if(data.id === 'all' && material.isSelected !== data.isSelected) {
                getYoloboxClient()?.sendCommand({'data': {id: material.id, isSelected: data.isSelected}, 'orderID': 'order_material_change'})
            }

            if(material.id !== data.id) continue
            if(material.isSelected === data.isSelected) return
        }
    }

    if(data.id === 'all') return

    getYoloboxClient()?.sendCommand({'data': data, 'orderID': method})
}

async function handleWebhook(method: string, data: any) {
    logRegular(`send webhook: ${method}`)

    let webhookContent: any = {}
    let webhookUrl: string = ''

    const regex = new RegExp(`webhook ${method}`, "g");
    const config = getConfig(regex)[0];

    if(!config) {
        logWarn(`no webhook config found for ${method}`)
        return
    }

    webhookUrl = config.url

    webhookContent = JSON.parse(await parsePlaceholders(JSON.stringify(config.content), config.additional_data))


    console.log(JSON.stringify(webhookContent))
    await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookContent),
    })
}

async function handleFunction(method: string, data: any) {
    logRegular(`trigger function: ${method}`)
    switch (method) {
        case 'sleep': {
            await sleep(data.time)
            break
        }
        case 'send_message': {
            const primaryChannel = getPrimaryChannel()

            data.content = fillTemplate(data.content, {})

            await getTwitchClient().getBot().api.chat.sendChatMessage(primaryChannel, data.content)
            break
        }
    }
}

async function handleObs(method: string, data: any) {
    const obsClient = getOBSClient()

    logRegular(`trigger obs: ${method}`)

    if(method === 'reload_browser_sources') {
        await obsClient.reloadAllBrowserScenes()
        return
    }

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
        body: JSON.stringify({state: method, data: data})
    })
}

function handleWebsocket(method: string, data: any) {
    const websocket = getWebsocketServer()

    logRegular(`trigger websocket: ${method}`)

    websocket.send(method, data)
}