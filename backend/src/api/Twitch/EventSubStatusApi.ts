import BaseApi from "../../abstracts/BaseApi";
import {getTwitchClient} from "../../App";

export default class EventSubStatusApi extends BaseApi {
    restEndpoint = "twitch-eventsub-status";
    restPost = false;
    websocketMethod = "twitch_eventsub_status";

    async handle(): Promise<any> {
        const twitchClient = getTwitchClient();

        if (!twitchClient) {
            return {
                listener_active: false,
                websocket_connections: 0,
                subscriptions: 0,
                auth_users: [],
                sockets: [],
            };
        }

        return twitchClient.logEventSubDiagnostics();
    }
}
