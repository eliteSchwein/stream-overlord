import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {pushGameInfo, setManualColor} from "../GameHelper";

export default class ThemeTask extends BaseMacroTask {
    getChannel(): string {
        return "theme";
    }

    async run(channel: string, method: string, data: any = {}): Promise<any> {
        switch (method) {
            case "set_color": {
                const color = String(data?.color ?? "")
                    .trim()
                    .replace(/^#/, "")
                    .toLowerCase();

                if (!/^[0-9a-f]{6}$/.test(color)) {
                    return false;
                }

                setManualColor(color);
                pushGameInfo();
                return true;
            }

            case "restore_color":
                setManualColor(undefined);
                pushGameInfo();
                return true;

            default:
                return false;
        }
    }
}
