import BaseEvent from "./BaseEvent";
import {CommunitySubEvent as EasyEvent} from "@twurple/easy-bot";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {getAssetConfig} from "../../../helper/ConfigHelper";
import {addAlert} from "../../../helper/AlertHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class CommunitySubEvent extends BaseEvent {
    name = 'CommunitySub'
    eventTypes = ['onCommunitySub']

    async handle(event: EasyEvent) {
        const theme = getAssetConfig('sub')

        logRegular(`${event.count} subs gifted from ${event.gifterDisplayName} on tier ${event.plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.gifterDisplayName} haut ${event.count} subs raus`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}