import getWebsocketServer from "../App";
import {sleep} from "../../../helper/GeneralHelper";
import {logNotice} from "./LogHelper";

const visibleElements = {}
let testModeActive = false

export function isElementVisible(id: string) {
    return visibleElements[id];
}

export function toggleElementVisiblity(id: string, state: boolean) {
    visibleElements[id] = state;
}

export function getAllVisibleElements() {
    return visibleElements;
}

export async function setTestModeActive(state: boolean) {
    testModeActive = state
    logNotice(`toggle test mode: ${state ? 'on' : 'off'}`)
    getWebsocketServer().send('notify_test_mode', {active: state})
    if(state === false) {
        await sleep(250)
        getWebsocketServer().sendUpdate()
    }
}
export function isTestModeActive() { return testModeActive }