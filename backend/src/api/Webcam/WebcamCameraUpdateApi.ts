import BaseApi from "../../abstracts/BaseApi";
import {updateWebcamCamera} from "../../helper/webcam/WebcamStreamHelper";

export default class WebcamCameraUpdateApi extends BaseApi {
    restEndpoint = "webcam/camera/update";
    restPost = true;
    websocketMethod = "webcam_camera_update";

    async handle(data: any): Promise<any> {
        try {
            return await updateWebcamCamera(data ?? {});
        } catch (error: any) {
            return {error: error?.message ?? "webcam_camera_update failed"};
        }
    }
}
