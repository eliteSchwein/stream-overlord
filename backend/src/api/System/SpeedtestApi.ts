import BaseApi from "../../abstracts/BaseApi";
import {
    getSpeedtestState,
    isSpeedtestRunning,
    startSpeedtest,
} from "../../helper/SpeedtestHelper";

export default class SpeedtestApi extends BaseApi {
    restEndpoint = "speedtest";
    restPost = true;
    websocketMethod = "speedtest";

    async handle(data: any): Promise<any> {
        const action = String(data?.action ?? "start").toLowerCase();

        if (action === "status" || action === "get") {
            return {
                status: "okay",
                speedtest: getSpeedtestState(),
            };
        }

        if (action !== "start" && action !== "run") {
            return {
                error: `unknown speedtest action: ${action}`,
            };
        }

        if (isSpeedtestRunning()) {
            return {
                status: "busy",
                speedtest: getSpeedtestState(),
            };
        }

        return {
            status: "okay",
            speedtest: startSpeedtest(),
        };
    }
}
