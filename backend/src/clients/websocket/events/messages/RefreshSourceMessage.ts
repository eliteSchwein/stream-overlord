import BaseMessage from "./BaseMessage";
import {getSourceFilters, updateSourceFilters} from "../../../../helper/SourceHelper";

export default class RefreshSourceMessage extends BaseMessage {
    method = 'refresh_source'

    async handle(data: any) {
        await updateSourceFilters()

        this.send('notify_source_update', getSourceFilters())
    }
}