import BaseApi from "../../abstracts/BaseApi";
import {removeWebcamBlur} from "../../helper/webcam/WebcamStreamHelper";

export default class WebcamRemoveBlurApi extends BaseApi {
    restEndpoint = "webcam/blur/remove";
    restPost = true;
    websocketMethod = "webcam_remove_blur";

    async handle(): Promise<any> {
        try {
            return await removeWebcamBlur();
        } catch (error: any) {
            return {error: error?.message ?? "webcam_remove_blur failed"};
        }
    }
}
