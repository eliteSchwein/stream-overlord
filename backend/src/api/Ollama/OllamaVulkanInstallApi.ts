import BaseApi from "../../abstracts/BaseApi";
import {installOllamaVulkanExtension} from "../../helper/OllamaHelper";

export default class OllamaVulkanInstallApi extends BaseApi {
    restEndpoint = "ollama/vulkan/install";
    restPost = true;
    websocketMethod = "ollama_vulkan_install";

    async handle(): Promise<any> {
        try {
            return await installOllamaVulkanExtension();
        } catch (error: any) {
            return {error: error?.message ?? "failed to install the vulkan extension"};
        }
    }
}
