import BaseEvent from "./BaseEvent";
import {CommunitySubEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";

export default class CommunitySubEvent extends BaseEvent {
    name = 'CommunitySub'
    eventTypes = ['onCommunitySub']

    async handle(event: EasyEvent) {
        getWebsocketServer().send('twitch_community_sub', {
            count: event.count,
            userName: event.gifterDisplayName,
            plan: event.plan
        })
    }
}