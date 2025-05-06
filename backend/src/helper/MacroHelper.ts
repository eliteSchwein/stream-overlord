import {getConfig} from "./ConfigHelper";
import getWebsocketServer, {getOBSClient, getTwitchClient} from "../App";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {editGameTracker, getGameInfoData} from "../clients/website/WebsiteClient";

const macros = {}

export default function loadMacros() {
    const config = getConfig((/^macro /g), true)

    for(const macroName in config) {
        macros[macroName] = config[macroName];
    }
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
            }
        } catch (error) {
            logWarn(`task failed:`)
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }

    return true
}

async function handleWebhook(method: string, data: any) {
    logRegular(`send webhook: ${method}`)

    let webhookContent: any = {}
    let webhookUrl: string = ''

    const primaryChannel = await getTwitchClient().getBot().api.users.getUserByName(
        getConfig(/twitch/g)[0]['channels'][0])

    const streamInfo = await primaryChannel.getStream()

    const gameInfo = await getGameInfoData()

    switch (method) {
        case 'start': {
            const config = getConfig(/api start_webhook_url/g)[0]
            webhookUrl = config.url

            webhookContent = {
                "content": `<@&${config.role_id}>`,
                "embeds": [
                    {
                        "color": 16754085,
                        "fields": [
                            {
                                "name": "Spiel",
                                "value": streamInfo.gameName
                            },
                            {
                                "name": "Titel",
                                "value": streamInfo.title
                            }
                        ],
                        "author": {
                            "name": "eliteSCHW31N ist nun live!",
                            "icon_url": primaryChannel.profilePictureUrl
                        },
                        "image": {
                            "url": gameInfo.media.static_background
                        }
                    }
                ],
                "attachments": []
            }
        }

        await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(webhookContent),
        })
    }
}

async function handleFunction(method: string, data: any) {
    logRegular(`trigger function: ${method}`)
    switch (method) {
        case 'sleep': {
            await sleep(data.time)
            break
        }
        case 'send_message': {
            const primaryChannel = await getTwitchClient().getBot().api.users.getUserByName(
                getConfig(/twitch/g)[0]['channels'][0])

            await getTwitchClient().getBot().api.chat.sendChatMessage(primaryChannel, data.content)
            break
        }
        case 'track': {
            const themeData = await getGameInfoData()
            let mode = 'add'

            if(data.mode) {
                mode = data.mode
            }

            await editGameTracker(themeData.game_id, mode)
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