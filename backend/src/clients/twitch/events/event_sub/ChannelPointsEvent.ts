import BaseEvent from "./BaseEvent";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {logError, logNotice, logRegular, logWarn} from "../../../../helper/LogHelper";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {addEventToCooldown, isEventFull, removeEventFromCooldown} from "../../helper/CooldownHelper";
import {v4 as uuidv4} from "uuid";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert} from "../../../../helper/AlertHelper";
import {triggerMacro} from "../../../../helper/MacroHelper";
import isShieldActive from "../../../../helper/ShieldHelper";
import {getConfiguredChannelPoint, getConfiguredChannelPoints, updateChannelPoints} from "../../../../helper/ChannelPointHelper";
import {getGameInfoData} from "../../../website/WebsiteClient";
import {stripEmotes} from "../../../../helper/DataHelper";
import {getAssetConfig} from "../../../../helper/AssetHelper";

export default class ChannelPointsEvent extends BaseEvent {
    name = "ChannelPointsEvent";
    eventTypes = ["onChannelRedemptionAdd"];

    protected channelPoints: any[] = [];

    async handleRegister() {
        const primaryChannel = getPrimaryChannel();

        const presentChannelPoints = await this.bot.api.channelPoints.getCustomRewards(primaryChannel.id);
        const rewardNames = presentChannelPoints.map(reward => reward.title);
        const configChannelPoints = getConfiguredChannelPoints();
        const gameData = await getGameInfoData();
        const gameChannelPoints = gameData?.channel_points ?? [];

        for (const channelPoint of this.channelPoints) {
            if (typeof channelPoint.getTitle !== "function") continue;

            const channelPointTitle = channelPoint.getTitle();

            if (rewardNames.includes(channelPointTitle)) continue;

            logNotice(`create channel point: ${channelPointTitle}`);

            await this.bot.api.channelPoints.createCustomReward(primaryChannel.id, {
                title: channelPointTitle,
                cost: 991,
                userInputRequired:
                    typeof channelPoint.hasInput === "function"
                        ? channelPoint.hasInput()
                        : false,
            });
        }

        for (const channelPoint of configChannelPoints) {
            if (rewardNames.includes(channelPoint.label)) continue;

            logNotice(`create config channel point: ${channelPoint.label}`);

            await this.bot.api.channelPoints.createCustomReward(primaryChannel.id, {
                title: channelPoint.label,
                cost: typeof channelPoint.cost === "number" ? channelPoint.cost : 992,
                userInputRequired: channelPoint.input_required === true,
            });
        }

        for (const channelPoint of gameChannelPoints) {
            if (!channelPoint?.name) continue;
            if (rewardNames.includes(channelPoint.name)) continue;

            logNotice(`create website channel point: ${channelPoint.name}`);

            await this.bot.api.channelPoints.createCustomReward(primaryChannel.id, {
                title: channelPoint.name,
                cost: typeof channelPoint.cost === "number" ? channelPoint.cost : 993,
                userInputRequired: channelPoint.input_required === true,
            });
        }

        await updateChannelPoints();
    }

    async handle(event: EventSubChannelRedemptionAddEvent) {
        let isValid = false;

        const eventUuid = uuidv4();

        if (isShieldActive()) {
            logWarn(`channel point denied for ${event.userName} because shield mode is active!`);

            if (event.broadcasterName !== event.userName) {
                await this.bot.whisper(
                    event.userName,
                    "Deine Kanalpunkte wurden dir zurück gegeben weil der Schild Modus aktiv ist.",
                );
            }

            await event.updateStatus("CANCELED");
            return;
        }

        if (isEventFull(this.name, event.broadcasterName, this.eventLimit)) {
            if (event.broadcasterName !== event.userName) {
                await this.bot.whisper(
                    event.userName,
                    "Deine Kanalpunkte wurden dir zurück gegeben weil aktuell die Punkte Warteschlange voll ist.",
                );
            }

            logWarn(`channel point denied for ${event.userName} because global spam protection is active!`);
            await event.updateStatus("CANCELED");
            return;
        }

        const configChannelPoint = getConfiguredChannelPoint(event.rewardTitle);

        if (configChannelPoint) {
            await this.handleConfiguredChannelPoint(configChannelPoint, event, eventUuid, "file");
            return;
        }

        const gameData = await getGameInfoData();
        const gameChannelPoint = (gameData?.channel_points ?? []).find(channelPoint => channelPoint?.name === event.rewardTitle);

        if (gameChannelPoint) {
            await this.handleConfiguredChannelPoint({
                label: gameChannelPoint.name,
                asset: gameChannelPoint.asset,
                macro: gameChannelPoint.macro,
                auto_accept: gameChannelPoint.auto_accept,
                strip_emotes: gameChannelPoint.strip_emotes,
                input_required: gameChannelPoint.input_required,
            }, event, eventUuid, "api");
            return;
        }

        for (const channelPoint of this.channelPoints) {
            if (typeof channelPoint.getTitle !== "function") continue;
            if (channelPoint.getTitle() !== event.rewardTitle) continue;

            isValid = true;
            break;
        }

        if (!isValid) return;

        addEventToCooldown(eventUuid, this.name, event.broadcasterName);

        try {
            for (const channelPoint of this.channelPoints) {
                if (typeof channelPoint.handleChannelPoint !== "function") continue;

                await channelPoint.handleChannelPoint(event);
            }
        } catch (error) {
            if (event.broadcasterName !== event.userName) {
                await this.bot.whisper(
                    event.userName,
                    "Deine Kanalpunkte wurden dir zurück gegeben weil ein Fehler aufgetreten ist.",
                );
            }

            logError(`channel point denied for ${event.userName} because of a exception:`);
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            await event.updateStatus("CANCELED");
            removeEventFromCooldown(eventUuid, this.name, event.broadcasterName);
            return;
        }

        await sleep(this.eventCooldown * 1000);

        removeEventFromCooldown(eventUuid, this.name, event.broadcasterName);
    }

    private async handleConfiguredChannelPoint(configChannelPoint: any, event: EventSubChannelRedemptionAddEvent, eventUuid: string, source: string) {
        let cooldownAdded = false;

        try {
            if (!configChannelPoint.asset) {
                await this.denyConfiguredChannelPoint(event, `${source} channel point asset is missing`);
                return;
            }

            if (!configChannelPoint.macro) {
                await this.denyConfiguredChannelPoint(event, `${source} channel point macro is missing`);
                return;
            }

            const asset = getAssetConfig(configChannelPoint.asset);

            if (!asset) {
                await this.denyConfiguredChannelPoint(event, `${source} channel point asset was not found: ${configChannelPoint.asset}`);
                return;
            }

            if (!configChannelPoint.auto_accept) {
                addEventToCooldown(eventUuid, this.name, event.broadcasterName);
                cooldownAdded = true;
            }

            const macroVariables = this.getMacroVariables(event, {
                eventUuid,
                channelPoint: {
                    title: event.rewardTitle,
                    userName: event.userName,
                    userDisplayName: event.userDisplayName,
                    broadcasterName: event.broadcasterName,
                    input: configChannelPoint.strip_emotes === true
                        ? stripEmotes(String(event.input ?? ""), event as any)
                        : event.input,
                },
            });

            addAlert({
                ...asset,
                asset: configChannelPoint.asset,
                variables: macroVariables,
                "event-uuid": `alert-${configChannelPoint.label}_${eventUuid}`,
            });

            const macroTriggered = await triggerMacro(configChannelPoint.macro, macroVariables);

            if (!macroTriggered) {
                await this.denyConfiguredChannelPoint(event, `${source} channel point macro was not found: ${configChannelPoint.macro}`);
                return;
            }

            logRegular(`channel point redeemed by ${event.userName}: ${event.rewardTitle} ${event.input}`);

            if (configChannelPoint.auto_accept) {
                await event.updateStatus("FULFILLED");
                return;
            }

            await sleep(this.eventCooldown * 1000);
            removeEventFromCooldown(eventUuid, this.name, event.broadcasterName);
        } catch (error) {
            if (cooldownAdded) {
                removeEventFromCooldown(eventUuid, this.name, event.broadcasterName);
            }

            if (event.broadcasterName !== event.userName) {
                await this.bot.whisper(
                    event.userName,
                    "Deine Kanalpunkte wurden dir zurück gegeben weil ein Fehler aufgetreten ist.",
                );
            }

            logError(`channel point denied for ${event.userName} because of a exception:`);
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            await event.updateStatus("CANCELED");
        }
    }

    private async denyConfiguredChannelPoint(event: EventSubChannelRedemptionAddEvent, reason: string) {
        if (event.broadcasterName !== event.userName) {
            await this.bot.whisper(
                event.userName,
                "Deine Kanalpunkte wurden dir zurück gegeben weil ein Fehler aufgetreten ist.",
            );
        }

        logWarn(`channel point denied for ${event.userName} because ${reason}!`);
        await event.updateStatus("CANCELED");
    }
}
