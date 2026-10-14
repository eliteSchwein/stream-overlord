import {logDebug} from "./LogHelper";
import {getConfig} from "./ConfigHelper";
import {existsSync} from "node:fs";
import {readFileSync} from "fs";
import getWebsocketServer from "../App";
import si = require('systeminformation');
import _ = require("lodash");

const defaultSystemInfoConfig = {
    entries: [
        {
            label: "CPU Usage",
            short: "CPU",
            icon: "cpu-64-bit",
            data: {
                type: "systeminfo",
                method: "currentLoad",
                entry: "currentLoad",
                decimal: 0,
                end: "%"
            }
        },
        {
            label: "CPU Temp",
            short: "CPU",
            icon: "thermometer",
            data: {
                type: "systeminfo",
                method: "cpuTemperature",
                entry: "main",
                decimal: 0,
                end: "°C"
            }
        }
    ]
}

let currentSystemInfo = []
const systemInformations: any = {
    cpu: {
        temp: undefined
    },
    gpu: {
        controllers: []
    },
    load: {},
    memory: {
        total: 0,
        used: 0,
        available: 0,
        usage_percent: 0
    },
    storage: {
        internal: null,
        external: []
    }
}

function toUsagePercent(used: number, total: number) {
    if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
        return 0
    }

    return Number.parseFloat(((used / total) * 100).toFixed(1))
}

function normalizeFilesystem(filesystem: any) {
    const total = Number(filesystem?.size ?? 0) || 0
    const used = Number(filesystem?.used ?? 0) || 0
    const available = Math.max(0, total - used)

    return {
        fs: filesystem?.fs ?? '',
        type: filesystem?.type ?? '',
        mount: filesystem?.mount ?? '',
        total,
        used,
        available,
        usage_percent: Number.isFinite(Number(filesystem?.use))
            ? Number.parseFloat(Number(filesystem.use).toFixed(1))
            : toUsagePercent(used, total)
    }
}

function isExternalMount(filesystem: any) {
    const mount = String(filesystem?.mount ?? '')
    if (!mount || mount === '/') return false

    return mount === '/mnt'
        || mount.startsWith('/mnt/')
        || mount === '/media'
        || mount.startsWith('/media/')
        || mount === '/run/media'
        || mount.startsWith('/run/media/')
}

export async function updateSystemInfo() {
    try {
        await updateSystemComponents()
        const configuredSystemInfo = getConfig(/systeminfo/g)?.[0]
        const config = configuredSystemInfo?.entries?.length
            ? configuredSystemInfo.entries
            : defaultSystemInfoConfig.entries
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
    return {config: currentSystemInfo, components: systemInformations};
}

export function notifySystemInfo() {
    const websocket = getWebsocketServer()

    websocket.send('notify_system_info', getSystemInfo())
}

export async function updateSystemComponents() {
    logDebug('update system components')
    systemInformations.cpu = await si.cpu()
    systemInformations.gpu = await si.graphics()

    systemInformations.cpu.temp = await si.cpuTemperature()

    systemInformations.load = await si.currentLoad()

    const memory = await si.mem()
    systemInformations.memory = {
        total: Number(memory.total ?? 0) || 0,
        used: Number(memory.used ?? 0) || 0,
        available: Number(memory.available ?? 0) || 0,
        usage_percent: toUsagePercent(Number(memory.used ?? 0), Number(memory.total ?? 0))
    }

    const filesystems = await si.fsSize()
    const rootFilesystem = filesystems.find((filesystem: any) => filesystem.mount === '/')
    systemInformations.storage = {
        internal: rootFilesystem ? normalizeFilesystem(rootFilesystem) : null,
        external: filesystems
            .filter((filesystem: any) => isExternalMount(filesystem) && Number(filesystem.size ?? 0) > 0)
            .map((filesystem: any) => normalizeFilesystem(filesystem))
    }

    delete systemInformations.cpu['flags']
    delete systemInformations.load['cpus']

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