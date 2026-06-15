import * as yaml from "js-yaml";
import {editAssetConfigFile} from "../../helper/AssetHelper";
import BaseApi from "../../abstracts/BaseApi";

function defaultAssetConfig() {
    return {
        sound: "",
        icon: "",
        message: "",
        duration: 5,
        color: "66BB6A",
        channel: "raid",
        start_macros: [],
        idle_macros: [],
        end_macros: [],
        wled: {},
    };
}

function toYamlContent(data: any) {
    return yaml.dump(data ?? {}, {
        noRefs: true,
        lineWidth: -1,
        sortKeys: false,
    });
}

export default class AssetsEditApi extends BaseApi {
    restEndpoint = "assets/edit";
    restPost = true;
    websocketMethod = "assets_edit";

    async handle(data: any): Promise<any> {
        try {
            const pathOrName = data?.path ?? data?.name;

            if (!pathOrName) {
                throw new Error("asset path or name is required");
            }

            const content = typeof data?.content === "string"
                ? data.content
                : toYamlContent(data?.asset ?? defaultAssetConfig());

            return {
                status: "okay",
                ...await editAssetConfigFile(pathOrName, content),
            };
        } catch (error: any) {
            return { error: error?.message ?? "edit asset failed" };
        }
    }
}
