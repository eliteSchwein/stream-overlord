import BaseEvent from "./BaseEvent";
import {CommunitySubEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";
import {waitUntil} from "async-wait-until";
import {hasEventHash, isEventQueried} from "../helper/CooldownHelper";
import {getAssetConfig, getConfig} from "../../../helper/ConfigHelper";
import {addAlert} from "../../../helper/AlertHelper";

export default class CommunitySubEvent extends BaseEvent {
    name = 'CommunitySub'
    eventTypes = ['onCommunitySub']

    async handle(event: EasyEvent) {
        const theme = getAssetConfig('sub')

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.gifterDisplayName} haut ${event.plan} subs raus`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}