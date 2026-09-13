import {removeEventFromQuery} from "../clients/twitch/helper/CooldownHelper";
import getWebsocketServer from "../App";
import {pushGameInfo, setManualColor} from "./GameHelper";
import {setLedColor} from "./WledHelper";
import {speak} from "./TTShelper";
import {logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {unlinkEvent} from "./MessageEventLinkHelper";
import {beginInteractionWork, endInteractionWork, extendInteraction, getCurrentInteractionUuid, hasInteraction, markInteractionAlertStarted} from "./InteractionHelper";

const alertQuery: any[] = [];
const activeAlerts: string[] = [];
let activeSound: string | null = null;
let alertLoopRunning = false;
const alertDeadlines = new WeakMap<object, number>();
const alertIdlePromises = new WeakMap<object, Promise<void>>();
const alertInteractionWork = new WeakMap<object, { uuid: string; label: string }>();

export default function initialAlerts() {
    const websocketServer = getWebsocketServer();

    setInterval(async () => {
        if (alertLoopRunning) return;

        alertLoopRunning = true;

        try {
            websocketServer.send("notify_alert_query", alertQuery);

            if (alertQuery.length === 0) return;

            const activeAlert = alertQuery[0];

            if (activeAlert.active) {
                const deadline = alertDeadlines.get(activeAlert);

                if (deadline !== undefined) {
                    const remainingMs = deadline - Date.now();

                    if (remainingMs > 0) {
                        // The alert countdown and the interaction ETA now use the
                        // same wall-clock deadline. This avoids drift from counting
                        // setInterval ticks, especially on longer alerts.
                        activeAlert.duration = Math.max(1, Math.ceil(remainingMs / 1000));
                        websocketServer.send("notify_alert", { ...activeAlert, action: "show" });
                        alertQuery[0] = activeAlert;
                        return;
                    }

                    activeAlert.duration = 0;
                } else if (activeAlert.duration > 0) {
                    // Compatibility fallback for an alert that became active before
                    // this timing state was created.
                    const durationSeconds = Math.max(0, Number(activeAlert.duration) || 0);
                    const fallbackDeadline = Date.now() + durationSeconds * 1000;
                    alertDeadlines.set(activeAlert, fallbackDeadline);
                    markInteractionAlertStarted(
                        activeAlert.interaction_uuid ?? activeAlert.variables?.interactionUuid,
                        durationSeconds,
                        activeAlert["event-uuid"]
                    );
                    websocketServer.send("notify_alert", { ...activeAlert, action: "show" });
                    alertQuery[0] = activeAlert;
                    return;
                }
            } else if (activeAlert.duration > 0) {
                activeAlert.active = true;
                activeAlert.ending = false;
                activeAlert.speakFinished = !activeAlert.speak;
                activeAlert.idleRunId = (activeAlert.idleRunId ?? 0) + 1;
                activeAlert.variables = buildAlertVariables(activeAlert);

                if (!activeAlerts.includes(activeAlert["event-uuid"])) {
                    activeAlerts.push(activeAlert["event-uuid"]);
                }

                if (activeAlert.color) {
                    setManualColor(activeAlert.color);
                    pushGameInfo();
                }

                if (activeAlert.wled) {
                    await setLedColor(activeAlert.wled);
                }

                await startAlertLifecycle(activeAlert);

                if (!activeAlert.active || activeAlert.ending) {
                    alertQuery[0] = activeAlert;
                    return;
                }

                const durationSeconds = Math.max(0, Number(activeAlert.duration) || 0);
                const deadline = Date.now() + durationSeconds * 1000;
                alertDeadlines.set(activeAlert, deadline);

                // Start both clocks at the same instant: immediately before the
                // first visible alert notification is dispatched.
                markInteractionAlertStarted(
                    activeAlert.interaction_uuid ?? activeAlert.variables?.interactionUuid,
                    durationSeconds,
                    activeAlert["event-uuid"]
                );

                websocketServer.send("notify_alert", { ...activeAlert, action: "show" });
                startAlertSpeech(activeAlert);

                alertQuery[0] = activeAlert;
                return;
            }

            await finishAlertLifecycle(activeAlert);

            websocketServer.send("notify_alert", { ...activeAlert, action: "hide" });
            completeAlertInteractionWork(activeAlert);

            if (activeAlert.ending) return;

            activeAlert.ending = true;
            activeAlert.idleRunId = (activeAlert.idleRunId ?? 0) + 1;
        } finally {
            alertLoopRunning = false;
        }
    }, 1000);
}

async function startAlertLifecycle(alert: any) {
    try {
        await runAlertMacros(alert.start_macros ?? alert.startMacros, alert.variables, "start");
    } catch (error) {
        logWarn(`alert start macro failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!alert.active || alert.ending) return;

    const idlePromise = runIdleMacros(alert).catch(error => {
        logWarn(`alert idle macro failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    alertIdlePromises.set(alert, idlePromise);
}

async function runIdleMacros(alert: any) {
    const runId = alert.idleRunId;
    const macros = alert.idle_macros ?? alert.idleMacros;

    if (!getMacroList(macros).length) return;
    if (!alert.active || alert.ending || runId !== alert.idleRunId) return;

    await runAlertMacros(macros, alert.variables, "idle");
}

async function finishAlertLifecycle(alert: any) {
    alert.active = false;
    alert.ending = true;
    alert.idleRunId = (alert.idleRunId ?? 0) + 1;

    await runAlertMacros(alert.end_macros ?? alert.endMacros, alert.variables ?? buildAlertVariables(alert), "end");

    while (alert.speak && !alert.speakFinished) {
        await sleep(100);
    }

    const idlePromise = alertIdlePromises.get(alert);
    if (idlePromise) {
        await idlePromise;
        alertIdlePromises.delete(alert);
    }

    removeAlert(alert, false);

    if (alertQuery.length > 0) return;

    setManualColor();
    pushGameInfo();
}

async function runAlertMacros(macros: any, variables: any = {}, phase: string = "") {
    const macroList = getMacroList(macros);

    if (!macroList.length) return;

    const { triggerMacro } = await import("./MacroHelper");

    for (const macro of macroList) {
        if (!macro) continue;

        logRegular(`trigger alert ${phase} macro: ${macro}`);
        await triggerMacro(String(macro), variables);
    }
}

function getMacroList(macros: any): string[] {
    if (!macros) return [];

    if (Array.isArray(macros)) {
        return macros.map(String).filter(Boolean);
    }

    if (typeof macros === "string") {
        const trimmed = macros.trim();

        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            return getMacroList(parsed);
        } catch (_) {
            return [trimmed];
        }
    }

    logWarn(`invalid alert macro config: ${JSON.stringify(macros)}`);
    return [];
}

function buildAlertVariables(alert: any) {
    const {
        variables,
        start_macros,
        startMacros,
        idle_macros,
        idleMacros,
        end_macros,
        endMacros,
        startMacrosFinished,
        ...safeAlert
    } = alert;

    return {
        ...(variables ?? {}),
        alert: safeAlert,
        eventUuid: alert["event-uuid"],
        message: alert.message,
        asset: alert.asset,
        channel: alert.channel,
    };
}

export function isAlertActive(eventUuid: string | undefined = undefined) {
    if (!eventUuid) {
        return activeAlerts.length > 0;
    }

    return activeAlerts.indexOf(eventUuid) > -1;
}

export function addAlert(alert: any) {
    if (alert.video) alert.video = `${alert.video}`;
    if (alert.sound) alert.sound = `${alert.sound}`;
    if (!alert.channel) alert.channel = "general";

    const eventUuid = alert["event-uuid"] ?? alert.eventUuid;
    const interactionUuid =
        alert.interaction_uuid ??
        alert.interactionUuid ??
        alert.variables?.interactionUuid ??
        getCurrentInteractionUuid() ??
        (hasInteraction(eventUuid) ? eventUuid : undefined);

    if (interactionUuid) {
        alert.interaction_uuid = interactionUuid;
        alert.variables = {
            ...(alert.variables ?? {}),
            interactionUuid,
        };
        extendInteraction(interactionUuid, Number(alert.duration ?? 0), eventUuid);

        const label = `alert ${eventUuid ?? alert.asset ?? "unknown"}`;
        if (beginInteractionWork(interactionUuid, label)) {
            alertInteractionWork.set(alert, { uuid: interactionUuid, label });
        }
    }

    alertQuery.push(alert);

    return alertQuery.length === 1;
}

export function removeAlert(alert: any, releaseInteractionWork = true) {
    const exactAlert = alertQuery.includes(alert);
    const matchingAlerts = alertQuery.filter((alertPartial: any) =>
        exactAlert
            ? alertPartial === alert
            : alert["event-uuid"] === alertPartial["event-uuid"]
    );

    for (const alertPartial of matchingAlerts) {
        const alertIndex = alertQuery.indexOf(alertPartial);
        if (alertIndex < 0) continue;

        alertPartial.active = false;
        alertPartial.ending = true;
        alertPartial.idleRunId = (alertPartial.idleRunId ?? 0) + 1;
        alertDeadlines.delete(alertPartial);
        alertIdlePromises.delete(alertPartial);

        alertQuery.splice(alertIndex, 1);

        const activeAlertIndex = activeAlerts.indexOf(alertPartial["event-uuid"]);
        if (activeAlertIndex > -1) {
            activeAlerts.splice(activeAlertIndex, 1);
        }

        if (releaseInteractionWork) {
            completeAlertInteractionWork(alertPartial);
        }
    }

    const eventUuid = alert["event-uuid"];
    if (eventUuid && !alertQuery.some((item: any) => item["event-uuid"] === eventUuid)) {
        removeEventFromQuery(eventUuid);
        unlinkEvent(eventUuid);
    }
}

function completeAlertInteractionWork(alert: any) {
    const interactionWork = alertInteractionWork.get(alert);
    if (!interactionWork) return;

    alertInteractionWork.delete(alert);
    endInteractionWork(interactionWork.uuid, interactionWork.label);
}

export function getActiveSound() {
    return activeSound;
}

export function setActiveSound(sound: string | null) {
    activeSound = sound;
}

export function removeAlertByEventUuid(eventUuid: string | undefined) {
    if (!eventUuid) return;

    removeAlert({
        "event-uuid": eventUuid,
    });
}

function startAlertSpeech(activeAlert: any) {
    if (!activeAlert.speak) {
        activeAlert.speakFinished = true;
        return;
    }

    const speakMessage = activeAlert.speak_message ?? activeAlert.message;

    if (!speakMessage) {
        activeAlert.speakFinished = true;
        return;
    }

    activeAlert.speakFinished = false;

    void (async () => {
        try {
            await speak(
                speakMessage,
                activeAlert["event-uuid"],
                activeAlert.locale,
                activeAlert.voice
            );
        } catch (error) {
            logWarn(`alert speak failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            activeAlert.speakFinished = true;
        }
    })();
}