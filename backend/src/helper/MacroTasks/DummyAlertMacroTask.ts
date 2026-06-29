import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {v4 as uuidv4} from "uuid";
import {addAlert} from "../AlertHelper";
import {calculateTTSduration} from "../TTShelper";
import {logWarn} from "../LogHelper";

export default class DummyAlertMacroTask extends BaseMacroTask {
    channel = "dummy_alert"

    async handle(method: string, data: any = {}, variables: any = {}) {
        if (!data.message) {
            logWarn(`dummy_alert requires message`);
            return;
        }

        const eventUuid =
            data.event_uuid ??
            data.eventUuid ??
            variables.eventUuid ??
            `macro_${uuidv4()}`;

        const duration =
            data.duration === "tts"
                ? calculateTTSduration(data.message)
                : data.duration ?? 5;

        addAlert({
            dummy: true,
            duration: duration,
            icon: data.icon ?? "",
            message: data.message,
            "event-uuid": eventUuid,
            speak: data.speak ?? false,
        });
    }
}
