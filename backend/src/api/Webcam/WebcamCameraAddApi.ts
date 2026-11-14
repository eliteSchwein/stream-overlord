import BaseApi from "../../abstracts/BaseApi";
import {addWebcamCamera} from "../../helper/webcam/WebcamStreamHelper";

export default class WebcamCameraAddApi extends BaseApi {
    restEndpoint = "webcam/camera/add";
    restPost = true;
    websocketMethod = "webcam_camera_add";

    async handle(data: any): Promise<any> {
        try {
            return await addWebcamCamera(data ?? {});
        } catch (error: any) {
            return {error: error?.message ?? "webcam_camera_add failed"};
        }
    }
}
