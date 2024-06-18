import getThemeData from "../clients/website/WebsiteClient";
import {logRegular} from "./LogHelper";
import getWebsocketServer from "../App";
import {getConfig} from "./ConfigHelper";
import {Websocket} from "websocket-ts";

const theme = {
    data: {},
    manual: ''
}

export default function getTheme() {
    const config = getConfig(/theme/g)[0]
    const clonedTheme = structuredClone(theme)

    if(clonedTheme.manual !== '') {
        clonedTheme.data['color'] = clonedTheme.manual
    }

    if(clonedTheme.data['color'] === '') {
        clonedTheme.data['color'] = config.default_color
    }

    return clonedTheme
}

export async function fetchTheme() {
    logRegular('fetch theme from website')
    theme.data = await getThemeData()
}

export function pushTheme(websocket: Websocket|undefined = undefined) {
    if(websocket) {
        websocket.send(JSON.stringify({method: 'theme_update', data: getTheme()}))
        return
    }
    getWebsocketServer().send('theme_update', getTheme())
}

export function setManual(value: string|undefined = undefined) {
    if(value) {
        logRegular(`set manual theme color: ${value}`);
        theme.manual = value
        return
    }

    logRegular('reset manual theme color');
    theme.manual = ''
}