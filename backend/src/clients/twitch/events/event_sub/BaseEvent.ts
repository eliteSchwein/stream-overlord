import registerEventCooldown, {
    addEventToCooldown,
    isEventFull,
    queryEvent,
    removeEventFromCooldown,
    removeEventFromQuery
} from "../../helper/CooldownHelper";
import {logError, logRegular} from "../../../../helper/LogHelper";
import {v4 as uuidv4} from 'uuid';
import {EventSubWsListener} from "@twurple/eventsub-ws";
import {Bot} from "@twurple/easy-bot";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {isMacroPresent, triggerMacro} from "../../../../helper/MacroHelper";
import {getAssetConfig, isAssetConfigPresent} from "../../../../helper/AssetHelper";
import {addAlert} from "../../../../helper/AlertHelper";
import {registerEventEntry} from "../../../../helper/EventHelper";

export default class BaseEvent {
    eventSubWs: EventSubWsListener
    bot: Bot

    name: string = ""
    eventTypes: string[] = []
    eventLimit = 25
    eventCooldown = 5
    eventUuid: string|undefined = undefined
    configName: string|undefined = undefined

    public constructor(eventSubWs: EventSubWsListener, bot: Bot) {
        this.eventSubWs = eventSubWs
        this.bot = bot
    }

    async register() {
        registerEventCooldown(this.name)

        const primaryChannel = getPrimaryChannel()

        logRegular(`register eventsub event: ${this.name}`)

        for(const eventType of this.eventTypes) {
            this.eventSubWs[eventType](primaryChannel.id, (event: any) => this.handleEvent(event))
        }

        void this.handleRegister()

        this.registerConfigEvent()
    }

    async handleRegister() {

    }

    registerConfigEvent(configName: string|undefined = undefined) {
        if(configName) {
            registerEventEntry(configName)

            return;
        }
        if(!this.configName) return

        registerEventEntry(this.configName)
    }

    async handleEvent(event: any) {
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

    async triggerConfiguredEvent(event: any, configName: string|undefined = undefined) {
        if(!this.configName && !configName) return
        if(this.configName && !configName) configName = this.configName
        if(!configName) return

        if(isMacroPresent(configName)) {
            void triggerMacro(configName, this.getMacroVariables(event))
        }

        if(isAssetConfigPresent(configName)) {
            const asset = getAssetConfig(configName)

            addAlert({
                'sound': asset.sound,
                'duration': asset.duration,
                'color': asset.color,
                'icon': asset.icon,
                'message': asset.message,
                'event-uuid': this.eventUuid,
                'video': asset.video,
                'lamp_color': asset.lamp_color,
                'volume': asset.volume,
                'image': asset.image,
                'channel': asset.channel,
            })
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
        if (depth >= 6) return undefined

        seen.add(value)

        return value.map(item => sanitizeMacroValue(item, seen, depth + 1))
            .filter(item => item !== undefined)
    }

    if (valueType !== "object") {
        return undefined
    }

    if (seen.has(value)) return undefined
    if (depth >= 6) return undefined

    seen.add(value)

    const output: any = {}

    for (const key of Object.keys(value)) {
        if (key.startsWith("_")) continue
        if (key === "eventSub" || key === "apiClient" || key === "client" || key === "bot") continue

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
        "userLogin",
        "moderatorId",
        "moderatorName",
        "moderatorDisplayName",
        "moderatorLogin",
        "targetUserId",
        "targetUserName",
        "targetUserDisplayName",
        "targetUserLogin",
        "bannedUserId",
        "bannedUserName",
        "bannedUserDisplayName",
        "bannedUserLogin",
        "gifterId",
        "gifterName",
        "gifterDisplayName",
        "gifterLogin",
        "recipientId",
        "recipientName",
        "recipientDisplayName",
        "recipientLogin",
        "fromBroadcasterId",
        "fromBroadcasterName",
        "fromBroadcasterDisplayName",
        "fromBroadcasterLogin",
        "toBroadcasterId",
        "toBroadcasterName",
        "toBroadcasterDisplayName",
        "toBroadcasterLogin",
        "hostBroadcasterId",
        "hostBroadcasterName",
        "hostBroadcasterDisplayName",
        "hostBroadcasterLogin",
        "viewerCount",
        "viewers",
        "bits",
        "count",
        "months",
        "cumulativeMonths",
        "streak",
        "streakMonths",
        "plan",
        "tier",
        "isGift",
        "isAnonymous",
        "isSystemMessage",
        "message",
        "messageText",
        "messageId",
        "reason",
        "rewardId",
        "rewardTitle",
        "rewardName",
        "rewardCost",
        "rewardPrompt",
        "input",
        "userInput",
        "status",
        "redemptionId",
        "title",
        "categoryId",
        "categoryName",
        "gameId",
        "gameName",
        "language",
        "isMature",
        "contentClassificationLabels",
        "sessionId",
        "participants",
        "startedAt",
        "endedAt",
        "lockedAt",
        "createdAt",
        "updatedAt",
        "expiresAt",
        "endsAt",
        "startDate",
        "endDate",
        "lockDate",
        "createdDate",
        "updatedDate",
        "pollId",
        "choices",
        "votes",
        "totalVotes",
        "channelPointsVotes",
        "bitsVotes",
        "predictionId",
        "outcomes",
        "winningOutcome",
        "predictionWindow",
        "channelPoints",
        "topPredictors",
        "users",
        "color",
        "streamId",
        "type",
        "startTime",
        "goalId",
        "goalType",
        "currentAmount",
        "targetAmount",
        "currentAmountValue",
        "targetAmountValue",
        "campaignId",
        "charityName",
        "charityDescription",
        "charityLogo",
        "charityWebsite",
        "amount",
        "donorId",
        "donorName",
        "donorDisplayName",
        "donorLogin",
        "donorMessage",
        "level",
        "total",
        "progress",
        "goal",
        "topContributions",
        "lastContribution",
        "contributors",

        // Hype Train v2 / contribution fields
        "topContribution",
        "contribution",
        "contributionType",
        "contributionTotal",
        "lastContributionType",
        "lastContributionTotal",
        "cooldownEndsAt",
        "cooldownEndDate",
        "expiresAt",
        "expiryDate",
        "isGoldenKappaTrain",
        "goldenKappaTrain",
        "sharedTrainParticipants",
        "participantCount",

        "isPaused",
        "isEnabled",
        "isInStock",
        "cost",
        "prompt",
        "cooldown",
        "globalCooldown",
        "maxRedemptionsPerStream",
        "maxRedemptionsPerUserPerStream",
        "backgroundColor",
        "autoAccept",
        "isUserInputRequired",
        "isInputRequired",
        "skipQueue",
        "paused",
        "enabled"
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
