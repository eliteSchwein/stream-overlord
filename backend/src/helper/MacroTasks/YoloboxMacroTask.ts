import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getYoloboxClient} from "../../App";
import {logRegular, logWarn} from "../LogHelper";

export default class YoloboxMacroTask extends BaseMacroTask {
    channel = "yolobox"

    async handle(method: string, data: any = {}) {
        logRegular(`send yolobox command: ${method}`);

        const yoloboxClient = getYoloboxClient();
        const yoloboxData = yoloboxClient?.getData();

        if (!yoloboxClient || !yoloboxData) {
            logWarn(`yolobox is currently not connected`);
            return;
        }

        if (method === "order_material_change") {
            const materialList = Array.isArray(yoloboxData.MaterialList)
                ? yoloboxData.MaterialList
                : [];

            if (!Array.isArray(yoloboxData.MaterialList)) {
                logWarn(`yolobox MaterialList is missing or invalid - skipping material change`);
                return;
            }

            for (const material of materialList) {
                if (data.id === "all" && material.isSelected !== data.isSelected) {
                    yoloboxClient.sendCommand({
                        data: {
                            id: material.id,
                            isSelected: data.isSelected,
                        },
                        orderID: "order_material_change",
                    });
                }

                if (material.id !== data.id) continue;
                if (material.isSelected === data.isSelected) return;
            }
        }

        if (data.id === "all") return;

        yoloboxClient.sendCommand({
            data,
            orderID: method,
        });
    }
}
