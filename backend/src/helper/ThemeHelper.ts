import getThemeData from "../clients/website/WebsiteClient";
import {logRegular} from "./LogHelper";
import getWebsocketServer from "../App";

const theme = {
    data: {},
    manual: ''
}

export default function getTheme() {
    const clonedTheme = structuredClone(theme)

    if(clonedTheme.manual !== '') {
        clonedTheme.data['color'] = clonedTheme.manual
    }

    return clonedTheme
}

export async function fetchTheme() {
    logRegular('fetch theme from website')
    theme.data = await getThemeData()
}

export function pushTheme() {
    getWebsocketServer().post('theme_update', getTheme())
}

export function setManual(value: string|undefined) {
    if(value) {
        logRegular(`set manual theme color: ${value}`);
        theme.manual = value
        return
    }

    logRegular('reset manual theme color');
    theme.manual = ''
}