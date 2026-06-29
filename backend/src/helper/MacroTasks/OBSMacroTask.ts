import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getOBSClient} from "../../App";
import {logRegular} from "../LogHelper";

export default class OBSMacroTask extends BaseMacroTask {
    channel = 'obs'

    async handle(method: string, data: any = {}, variables: any = {}) {
        const obsClient = getOBSClient();
        const connection = data.connection ?? data.obs ?? data.target ?? 'default';

        logRegular(`trigger obs (${connection}): ${method}`);

        const obsData = {...data};
        delete obsData.connection;
        delete obsData.obs;
        delete obsData.target;

        if (method === "reload_browser_sources") {
            await obsClient.reloadAllBrowserScenes(connection);
            return;
        }

        await obsClient.send(method, obsData, connection);
    }
}