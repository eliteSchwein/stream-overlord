import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getConfig} from "../ConfigHelper";
import {logRegular} from "../LogHelper";

export default class RestMacroTask extends BaseMacroTask {
    channel = "rest"

    async handle(method: string, data: any = {}, variables: any = {}) {
        const config = getConfig(/^webserver/g)[0];

        logRegular(`trigger rest: ${method}`);

        const url = `http://localhost:${config.port}/api/${data.endpoint}`;

        await fetch(url, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                state: method,
                data,
            }),
        });
    }
}
