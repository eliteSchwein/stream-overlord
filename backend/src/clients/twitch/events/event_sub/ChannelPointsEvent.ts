import BaseEvent from "./BaseEvent";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {logError, logNotice, logRegular, logWarn} from "../../../../helper/LogHelper";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {addEventToCooldown, isEventFull, removeEventFromCooldown} from "../../helper/CooldownHelper";
import {v4 as uuidv4} from "uuid";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert} from "../../../../helper/AlertHelper";
import {isMacroPresent, triggerMacro} from "../../../../helper/MacroHelper";
import {enqueueInteraction} from "../../../../helper/InteractionHelper";
import isShieldActive from "../../../../helper/ShieldHelper";
import {
    getConfiguredChannelPoint,
    getConfiguredChannelPoints,
    updateChannelPoints
} from "../../../../helper/ChannelPointHelper";
import {getGameInfoData} from "../../../website/WebsiteClient";
import {stripEmotes} from "../../../../helper/DataHelper";
import {getAssetConfig} from "../../../../helper/AssetHelper";

export default class ChannelPointsEvent extends BaseEvent {
    name = "ChannelPointsEvent";
    eventTypes = ["onChannelRedemptionAdd"];

    protected channelPoints: any[] = [];

    private readonly processedRedemptions = new Map<string, number>();
    private readonly redemptionDeduplicationTtl = 30 * 60 * 1000;

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
                autoFulfill: channelPoint.auto_accept === true,
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

        const now = Date.now();

        for (const [redemptionId, processedAt] of this.processedRedemptions) {
            if (now - processedAt > this.redemptionDeduplicationTtl) {
                this.processedRedemptions.delete(redemptionId);
            }
        }

        if (this.processedRedemptions.has(event.id)) {
            logWarn(
                `ignore duplicate channel point redemption ${event.id} (${event.rewardTitle}) from ${event.userName}`,
            );
            return;
        }

        this.processedRedemptions.set(event.id, now);

        const eventUuid = uuidv4();

        if (isShieldActive()) {
            logWarn(`channel point denied for ${event.userName} because shield mode is active!`);

            if (event.broadcasterName !== event.userName) {
                await this.bot.whisper(
                    event.userName,
                    "Deine Kanalpunkte wurden dir zurück gegeben weil der Schild Modus aktiv ist.",
                );
            }

            await this.updateRedemptionStatus(event, "CANCELED");
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
            await this.updateRedemptionStatus(event, "CANCELED");
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
            await this.updateRedemptionStatus(event, "CANCELED");
            removeEventFromCooldown(eventUuid, this.name, event.broadcasterName);
            return;
        }

        await sleep(this.eventCooldown * 1000);

        removeEventFromCooldown(eventUuid, this.name, event.broadcasterName);
    }

    private async handleConfiguredChannelPoint(
        configChannelPoint: any,
        event: EventSubChannelRedemptionAddEvent,
        eventUuid: string,
        source: string,
    ) {
        let cooldownAdded = false;

        try {
            if (!configChannelPoint.asset && !configChannelPoint.macro) {
                await this.denyConfiguredChannelPoint(
                    event,
                    `${source} channel point asset and macro are missing`,
                );
                return;
            }

            let asset: any = null;

            if (configChannelPoint.asset) {
                asset = getAssetConfig(configChannelPoint.asset);

                if (!asset) {
                    await this.denyConfiguredChannelPoint(
                        event,
                        `${source} channel point asset was not found: ${configChannelPoint.asset}`,
                    );
                    return;
                }
            }

            if (!configChannelPoint.auto_accept) {
                addEventToCooldown(
                    eventUuid,
                    this.name,
                    event.broadcasterName,
                );

                cooldownAdded = true;
            }

            const macroVariables = this.getMacroVariables(event, {
                eventUuid,
                interactionUuid: eventUuid,
                channelPoint: {
                    title: event.rewardTitle,
                    userId: event.userId,
                    userName: event.userName,
                    userDisplayName: event.userDisplayName,
                    broadcasterName: event.broadcasterName,
                    input:
                        configChannelPoint.strip_emotes === true
                            ? stripEmotes(
                                String(event.input ?? ""),
                                event as any,
                            )
                            : event.input,
                },
            });

            if (configChannelPoint.macro && !isMacroPresent(configChannelPoint.macro)) {
                if (cooldownAdded) {
                    removeEventFromCooldown(eventUuid, this.name, event.broadcasterName);
                    cooldownAdded = false;
                }

                await this.denyConfiguredChannelPoint(
                    event,
                    `${source} channel point macro was not found: ${configChannelPoint.macro}`,
                );
                return;
            }

            enqueueInteraction({
                uuid: eventUuid,
                name: `Channel Point: ${event.rewardTitle}`,
                source: "channel_point",
                estimatedDuration: asset && !configChannelPoint.macro ? Number(asset.duration ?? 15) || 0 : 0,
                execute: async () => {
                    if (
                        asset &&
                        (asset.video || asset.sound || asset.image || asset.message)
                    ) {
                        addAlert({
                            ...asset,
                            asset: configChannelPoint.asset,
                            variables: macroVariables,
                            interaction_uuid: eventUuid,
                            "event-uuid": eventUuid,
                        });
                    }

                    if (configChannelPoint.macro) {
                        await triggerMacro(configChannelPoint.macro, macroVariables);
                    }
                },
            });

            logRegular(
                `channel point redeemed by ${event.userName}: ${event.rewardTitle} ${event.input}`,
            );

            if (configChannelPoint.auto_accept) {
                await this.updateRedemptionStatus(event, "FULFILLED");
                return;
            }

            await sleep(this.eventCooldown * 1000);

            removeEventFromCooldown(
                eventUuid,
                this.name,
                event.broadcasterName,
            );

            cooldownAdded = false;
        } catch (error) {
            if (cooldownAdded) {
                removeEventFromCooldown(
                    eventUuid,
                    this.name,
                    event.broadcasterName,
                );
            }

            if (event.broadcasterName !== event.userName) {
                await this.bot.whisper(
                    event.userName,
                    "Deine Kanalpunkte wurden dir zurück gegeben weil ein Fehler aufgetreten ist.",
                );
            }

            logError(
                `channel point denied for ${event.userName} because of a exception:`,
            );
            logError(
                JSON.stringify(
                    error,
                    Object.getOwnPropertyNames(error),
                ),
            );

            await this.updateRedemptionStatus(event, "CANCELED");
        }
    }

    private async updateRedemptionStatus(
        event: EventSubChannelRedemptionAddEvent,
        status: "FULFILLED" | "CANCELED",
    ): Promise<boolean> {
        const currentStatus = String((event as any).status ?? "").toUpperCase();

        if (currentStatus && currentStatus !== "UNFULFILLED") {
            logRegular(
                `skip channel point status update ${event.rewardTitle} (${event.id}): already ${currentStatus}`,
            );
            return false;
        }

        try {
            await event.updateStatus(status);
            return true;
        } catch (error: any) {
            /*
             * Twitch only permits redemption updates while the redemption is
             * UNFULFILLED. A duplicate EventSub delivery, a reward configured
             * to skip the request queue, or another client resolving it first
             * can therefore legitimately make this request return 404.
             *
             * That must not turn an otherwise successful interaction into a
             * failed ChannelPointsEvent.
             */
            const statusCode = Number(error?._statusCode ?? error?.statusCode ?? error?.status ?? 0);
            const body = String(error?._body ?? error?.message ?? "");

            if (
                statusCode === 404 &&
                (body.includes("weren't marked as UNFULFILLED") ||
                    body.includes("were not found"))
            ) {
                logWarn(
                    `skip channel point status update ${event.rewardTitle} (${event.id}) -> ${status}: redemption is already resolved or unavailable`,
                );
                return false;
            }

            throw error;
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
        await this.updateRedemptionStatus(event, "CANCELED");
    }
}
