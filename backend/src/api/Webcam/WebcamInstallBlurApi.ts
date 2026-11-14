import BaseApi from "../../abstracts/BaseApi";
import {installWebcamBlur} from "../../helper/webcam/WebcamStreamHelper";

export default class WebcamInstallBlurApi extends BaseApi {
    restEndpoint = "webcam/blur/install";
    restPost = true;
    websocketMethod = "webcam_install_blur";

    async handle(data: any): Promise<any> {
        try {
            return await installWebcamBlur();
        } catch (error: any) {
            return {error: error?.message ?? "webcam_install_blur failed"};
        }
    }
}
