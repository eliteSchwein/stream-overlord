import {logDebug} from "./LogHelper";
import {getConfig} from "./ConfigHelper";
import {existsSync} from "node:fs";
import {readFileSync} from "fs";
import getWebsocketServer from "../App";
import si = require('systeminformation');
import _ = require("lodash");

let currentSystemInfo = []
const systemInformations = {
    cpu: {},
    gpu: {
        controllers: []
    }
}

export async function updateSystemInfo() {
    try {
        const config = Object.assign({}, getConfig(/systeminfo/g)[0].entries)
        const newSystemInfo = []

        for(const index in config) {
            const entry = config[index]
            let data = entry.data
            let rawValue = 0

            switch(data.type) {
                case "systeminfo":
                    logDebug(`update system info: ${data.method}().${data.entry}`)
                    const mainData = await si[data.method]()
                    rawValue = _.get(mainData, data.entry)
                    break
                case "raw":
                    if(!existsSync(data.path)) {
                        break
                    }
                    logDebug(`update raw system info: ${data.path}`)

                    rawValue = Number.parseFloat(readFileSync(data.path).toString())
                    break
            }

            if(data.divide !== undefined) {
                rawValue = rawValue / data.divide
            }
            if(data.decimal !== undefined) {
                rawValue = Number.parseFloat(rawValue.toFixed(data.decimal))
            }

            let finalValue = `${rawValue}`

            if(data.end) {
                finalValue = `${finalValue} ${data.end}`
            }

            newSystemInfo.push({
                label: entry.label,
                icon: entry.icon,
                short: entry.short,
                data: finalValue
            })
        }

        currentSystemInfo = newSystemInfo

        notifySystemInfo()
    } catch (error) {
        logDebug('system info update failed:')
        logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export function getSystemInfo() {
    return currentSystemInfo;
}

export function notifySystemInfo() {
    const websocket = getWebsocketServer()

    websocket.send('notify_system_info', getSystemInfo())
}

export async function updateSystemComponents() {
    logDebug('update system components')
    systemInformations.cpu = await si.cpu()
    systemInformations.gpu = await si.graphics()

    delete systemInformations.cpu['flags']
    logDebug(JSON.stringify(systemInformations))
}

export function getCpu() {
    return systemInformations.cpu;
}

export function getGpu() {
    return systemInformations.gpu
}

export function getSystemComponents() {
    return systemInformations
}