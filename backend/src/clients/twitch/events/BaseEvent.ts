import {Bot} from "@twurple/easy-bot";
import registerEventCooldown, {
    addEventToCooldown,
    isEventFull,
    queryEvent,
    removeEventFromCooldown,
    removeEventFromQuery
} from "../helper/CooldownHelper";
import {logError, logRegular} from "../../../helper/LogHelper";
import {v4 as uuidv4} from 'uuid';
import {sleep} from "../../../../../helper/GeneralHelper";

export default class BaseEvent {
    bot: Bot

    name: string
    eventTypes = []
    eventLimit = 25
    eventCooldown = 5
    eventUuid: string

    public constructor(bot: Bot) {
        this.bot = bot;
    }

    register() {
        registerEventCooldown(this.name)

        logRegular(`register event: ${this.name}`)

        for(const eventType of this.eventTypes) {
            this.bot[eventType]((event: any) => void this.handleEvent(event))
        }
    }

    private async handleEvent(event: any) {
        if(isEventFull(this.name, event.broadcasterName, this.eventLimit)) return

        this.eventUuid = `${this.name}_${uuidv4()}`

        queryEvent(this.eventUuid)
        addEventToCooldown(this.eventUuid, this.name, event.broadcasterName)

        try {
            await this.handle(event)
        } catch (error) {
            logError(`event ${this.name} failed:`)
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }

        await sleep(this.eventCooldown * 1000)

        removeEventFromCooldown(this.eventUuid, this.name, event.broadcasterName)
        removeEventFromQuery(this.eventUuid)
    }

    protected sanitizeMacroEvent(event: any): any {
        return sanitizeMacroValue(event)
    }

    protected getMacroVariables(event: any, variables: any = {}) {
        const {event: _event, eventUuid, ...safeVariables} = variables

        return {
            ...safeVariables,
            event: this.sanitizeMacroEvent(event),
            eventUuid: eventUuid ?? this.eventUuid,
        }
    }

    async handle(event: any) {}
}

function sanitizeMacroValue(value: any, seen = new WeakSet<object>(), depth = 0): any {
    if (value === null || value === undefined) return value

    const valueType = typeof value

    if (valueType === "string" || valueType === "number" || valueType === "boolean") {
        return value
    }

    if (valueType === "bigint") {
        return value.toString()
    }

    if (value instanceof Date) {
        return value.toISOString()
    }

    if (Array.isArray(value)) {
        if (seen.has(value)) return undefined
        if (depth >= 4) return undefined

        seen.add(value)
        return value.map(item => sanitizeMacroValue(item, seen, depth + 1))
            .filter(item => item !== undefined)
    }

    if (valueType !== "object") {
        return undefined
    }

    if (seen.has(value)) return undefined
    if (depth >= 4) return undefined

    seen.add(value)

    const output: any = {}

    for (const key of Object.keys(value)) {
        if (key.startsWith("_")) continue

        const sanitized = sanitizeMacroValue(value[key], seen, depth + 1)

        if (sanitized !== undefined) {
            output[key] = sanitized
        }
    }

    const twitchEventKeys = [
        "id",
        "broadcasterId",
        "broadcasterName",
        "broadcasterDisplayName",
        "userId",
        "userName",
        "userDisplayName",
        "gifterId",
        "gifterName",
        "gifterDisplayName",
        "recipientId",
        "recipientName",
        "recipientDisplayName",
        "viewerCount",
        "bits",
        "count",
        "months",
        "streak",
        "plan",
        "isGift",
        "isAnonymous",
        "message",
        "rewardId",
        "rewardTitle",
        "rewardCost",
        "input",
        "status",
        "title",
        "categoryId",
        "categoryName",
        "messageId",
    ]

    for (const key of twitchEventKeys) {
        if (output[key] !== undefined) continue

        try {
            const sanitized = sanitizeMacroValue(value[key], seen, depth + 1)

            if (sanitized !== undefined) {
                output[key] = sanitized
            }
        } catch (_) {
            // Some Twurple fields are getters around runtime internals. Ignore unsafe fields.
        }
    }

    return output
}
