import 'colorts/lib/string';
import * as util from 'util'
import {getConfig} from "./ConfigHelper";

type LogConfig = {
    debug: boolean
    full_obs_log: boolean
}

const DEFAULT_LOG_CONFIG: LogConfig = {
    debug: false,
    full_obs_log: false,
}

export function logError(message: string) {
    console.log(`${getLevel('error')} ${getTimeStamp()} ${util.format(message)}`.red)
}

export function logSuccess(message: string) {
    console.log(`${getLevel('info')} ${getTimeStamp()} ${util.format(message)}`.green)
}

export function logRegular(message: string) {
    console.log(`${getLevel('info')} ${getTimeStamp()} ${util.format(message)}`.white)
}

export function logNotice(message: string) {
    console.log(`${getLevel('info')} ${getTimeStamp()} ${util.format(message)}`.magenta)
}

export function logDebug(message: string) {
    if(!isDebug()) return

    console.log(`${getLevel('debug')} ${getTimeStamp()} ${util.format(message)}`.grey)
}

export function logWarn(message: string) {
    console.log(`${getLevel('warn')} ${getTimeStamp()} ${util.format(message)}`.yellow)
}

export function logCustom(message: string, level = "info") {
    console.log(`${getLevel(level)} ${getTimeStamp()} ${util.format(message)}`)
}

export function logEmpty() {
    console.log('')
}

function getLevel(level: string) {
    return `[${level}]`.grey
}

function getTimeStamp() {
    const date = new Date()
    return `[${date.toISOString()}]`.grey
}

export function isDebug() {
    return getLogConfig().debug
}

export function getLogConfig(): LogConfig {
    const config = getConfig(/logging/g)[0] ?? {}

    return {
        ...DEFAULT_LOG_CONFIG,
        ...config,
    }
}