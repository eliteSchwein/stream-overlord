import BaseMessage from "./BaseMessage";
import {getSourceFilters, saveSourceFilters} from "../../../../helper/SourceHelper";

export default class SaveSourceMessage extends BaseMessage {
    method = 'save_source'

    async handle(data: any) {
        await saveSourceFilters()

        this.send('notify_source_update', getSourceFilters())
    }
}