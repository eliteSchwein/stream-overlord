import {getConfig} from "./ConfigHelper";
import {logRegular, logWarn} from "./LogHelper";

export async function setLedColor(color: string = undefined) {
    const wledLamps = getConfig(/wled /g, true);

    let wledColor = undefined

    if (color) {
        logRegular(`set lamp color: ${color}`)
        wledColor = getConfig(new RegExp(`^led_color ${color}`, 'g'))[0]
    } else {
        logRegular(`reset lamp color`)
    }

    for(const wledName in wledLamps) {
        const wledLamp = wledLamps[wledName];
        let newColor = wledColor

        if(!newColor) {
            newColor = getConfig(new RegExp(`^led_color ${wledLamp.default_color}`, 'g'))[0]
        }

        try {
            await fetch(`${wledLamp.url}/win&R=${newColor.red}&G=${newColor.green}&B=${newColor.blue}&W=${newColor.white}&FX=${newColor.effect}`)
        } catch (e) {
            logWarn(`couldn't update lamp ${wledName}!`)
        }
    }
}