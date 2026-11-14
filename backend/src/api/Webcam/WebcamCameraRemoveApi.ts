import BaseApi from "../../abstracts/BaseApi";
import {removeWebcamCamera} from "../../helper/webcam/WebcamStreamHelper";

export default class WebcamCameraRemoveApi extends BaseApi {
    restEndpoint = "webcam/camera/remove";
    restPost = true;
    websocketMethod = "webcam_camera_remove";

    async handle(data: any): Promise<any> {
        try {
            return await removeWebcamCamera(String(data?.id ?? ""));
        } catch (error: any) {
            return {error: error?.message ?? "webcam_camera_remove failed"};
        }
    }
}
