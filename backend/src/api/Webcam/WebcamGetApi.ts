import BaseApi from "../../abstracts/BaseApi";
import {getWebcamUpdate} from "../../helper/webcam/WebcamStreamHelper";

export default class WebcamGetApi extends BaseApi {
    restEndpoint = "webcam";
    restPost = false;
    websocketMethod = "webcam_get";

    async handle(data: any): Promise<any> {
        try {
            return getWebcamUpdate();
        } catch (error: any) {
            return {error: error?.message ?? "webcam_get failed"};
        }
    }
}
