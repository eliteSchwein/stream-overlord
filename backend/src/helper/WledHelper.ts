import {getWledConfigs} from "./AssetHelper";
import {logRegular, logWarn} from "./LogHelper";

export type WledControl = {
    red?: number;
    green?: number;
    blue?: number;
    white?: number;
    effect?: number;
    brightness?: number;
};

export type WledControls = Record<string, WledControl>;

export async function setLedColor(controls: WledControls = {}) {
    const wledConfigs = getWledConfigs();

    if (!controls || Object.keys(controls).length === 0) {
        logRegular("no wled controls");
        return;
    }

    for (const name in controls) {
        const lamp = wledConfigs[name];

        if (!lamp?.url) {
            logWarn(`unknown wled device ${name}`);
            continue;
        }

        const control = controls[name];

        const brightness = Number(control.brightness ?? 255);
        const red = Number(control.red ?? 0);
        const green = Number(control.green ?? 0);
        const blue = Number(control.blue ?? 0);
        const white = Number(control.white ?? 0);
        const effect = Number(control.effect ?? 0);

        logRegular(
            `update wled ${name}: ` +
            `R=${red} G=${green} B=${blue} W=${white} FX=${effect}`
        );

        try {
            await fetch(
                `${lamp.url}/win` +
                `&A=${brightness}` +
                `&R=${red}` +
                `&G=${green}` +
                `&B=${blue}` +
                `&W=${white}` +
                `&FX=${effect}`
            );
        } catch (error) {
            logWarn(`couldn't update lamp ${name}!`);
            logWarn(
                JSON.stringify(
                    error,
                    Object.getOwnPropertyNames(error)
                )
            );
        }
    }
}