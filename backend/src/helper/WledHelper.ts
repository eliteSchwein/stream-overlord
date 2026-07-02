import {getWledIntegrations} from "./IntegrationsHelper";
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
    const wledConfigs = getWledIntegrations();

    if (!controls || Object.keys(controls).length === 0) {
        logRegular("no wled controls");
        return;
    }

    for (const name in controls) {
        const lamp = wledConfigs[name];

        if (!lamp?.ip) {
            logWarn(`unknown wled device "${name}"`);
            continue;
        }

        const control = controls[name];

        const brightness = Number(control.brightness ?? 255);
        const red = Number(control.red ?? 0);
        const green = Number(control.green ?? 0);
        const blue = Number(control.blue ?? 0);
        const white = Number(control.white ?? 0);
        const effect = Number(control.effect ?? 0);

        const baseUrl = `http://${lamp.ip}`;
        const requestUrl =
            `${baseUrl}/win` +
            `&A=${brightness}` +
            `&R=${red}` +
            `&G=${green}` +
            `&B=${blue}` +
            `&W=${white}` +
            `&FX=${effect}`;

        logRegular(`updating wled "${name}"`);
        logRegular(`  address    : ${lamp.ip}`);
        logRegular(`  brightness : ${brightness}`);
        logRegular(`  color      : R=${red} G=${green} B=${blue} W=${white}`);
        logRegular(`  effect     : ${effect}`);
        logRegular(`  request    : ${requestUrl}`);

        try {
            const response = await fetch(requestUrl);

            if (!response.ok) {
                logWarn(
                    `wled "${name}" responded with ${response.status} ${response.statusText}`
                );
                continue;
            }

            logRegular(`wled "${name}" updated successfully`);
        } catch (error) {
            logWarn(`failed to update wled "${name}" (${lamp.ip})`);
            logWarn(
                JSON.stringify(
                    error,
                    Object.getOwnPropertyNames(error)
                )
            );
        }
    }
}