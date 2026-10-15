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
let systemInfoUpdateInFlight: Promise<void> | null = null
let componentUpdateInFlight: Promise<void> | null = null
let lastStaticHardwareUpdate = 0
let lastStorageUpdate = 0

const STATIC_HARDWARE_INTERVAL_MS = 5 * 60_000
const STORAGE_INTERVAL_MS = 10_000
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
    },
    process: {
        rss: 0,
        heap_total: 0,
        heap_used: 0,
        external: 0,
        array_buffers: 0,
        heap_usage_percent: 0
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
    if (systemInfoUpdateInFlight) {
        return systemInfoUpdateInFlight
    }

    systemInfoUpdateInFlight = (async () => {
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
                    case "systeminfo": {
                        logDebug(`update system info: ${data.method}().${data.entry}`)

                        // Reuse data that updateSystemComponents already fetched instead
                        // of invoking systeminformation (and spawning Linux helpers) twice.
                        const cachedMethodData: Record<string, any> = {
                            cpu: systemInformations.cpu,
                            cpuTemperature: systemInformations.cpu?.temp ?? {},
                            currentLoad: systemInformations.load,
                            mem: systemInformations.memory,
                            fsSize: [
                                ...(systemInformations.storage?.internal ? [systemInformations.storage.internal] : []),
                                ...(systemInformations.storage?.external ?? [])
                            ]
                        }

                        const mainData = Object.prototype.hasOwnProperty.call(cachedMethodData, data.method)
                            ? cachedMethodData[data.method]
                            : await si[data.method]()
                        rawValue = _.get(mainData, data.entry)
                        break
                    }
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
                if(data.decimal !== undefined && Number.isFinite(rawValue)) {
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
    })()

    try {
        await systemInfoUpdateInFlight
    } finally {
        systemInfoUpdateInFlight = null
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
    if (componentUpdateInFlight) {
        return componentUpdateInFlight
    }

    componentUpdateInFlight = (async () => {
        logDebug('update system components')
        const now = Date.now()
        const refreshStaticHardware = !lastStaticHardwareUpdate || now - lastStaticHardwareUpdate >= STATIC_HARDWARE_INTERVAL_MS
        const refreshStorage = !lastStorageUpdate || now - lastStorageUpdate >= STORAGE_INTERVAL_MS

        // Dynamic values may be refreshed frequently, but do them concurrently
        // and never allow scheduler ticks to overlap.
        const [temperature, load, memory] = await Promise.all([
            si.cpuTemperature(),
            si.currentLoad(),
            si.mem()
        ])

        if (refreshStaticHardware) {
            const [cpu, gpu] = await Promise.all([
                si.cpu(),
            ])
            systemInformations.cpu = cpu
            lastStaticHardwareUpdate = now
        }

        systemInformations.cpu.temp = temperature
        systemInformations.load = load
        systemInformations.memory = {
            total: Number(memory.total ?? 0) || 0,
            used: Number(memory.used ?? 0) || 0,
            available: Number(memory.available ?? 0) || 0,
            usage_percent: toUsagePercent(Number(memory.used ?? 0), Number(memory.total ?? 0))
        }

        const processMemory = process.memoryUsage()
        systemInformations.process = {
            rss: processMemory.rss,
            heap_total: processMemory.heapTotal,
            heap_used: processMemory.heapUsed,
            external: processMemory.external,
            array_buffers: processMemory.arrayBuffers,
            heap_usage_percent: toUsagePercent(processMemory.heapUsed, processMemory.heapTotal)
        }

        if (refreshStorage) {
            const filesystems = await si.fsSize()
            const rootFilesystem = filesystems.find((filesystem: any) => filesystem.mount === '/')
            systemInformations.storage = {
                internal: rootFilesystem ? normalizeFilesystem(rootFilesystem) : null,
                external: filesystems
                    .filter((filesystem: any) => isExternalMount(filesystem) && Number(filesystem.size ?? 0) > 0)
                    .map((filesystem: any) => normalizeFilesystem(filesystem))
            }
            lastStorageUpdate = now
        }

        delete systemInformations.cpu['flags']
        delete systemInformations.load['cpus']

        logDebug(JSON.stringify(systemInformations))
    })()

    try {
        await componentUpdateInFlight
    } finally {
        componentUpdateInFlight = null
    }
}

export function getCpu() {
    return systemInformations.cpu;
}

export function getGpu() {
}

export function getSystemComponents() {
    return systemInformations
}
