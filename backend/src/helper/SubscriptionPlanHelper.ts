import type {ApiClient} from "@twurple/api";
import type {EventSimulationField} from "./EventHelper";
import {updateSimulationSelectOptions} from "./EventHelper";
import {logWarn} from "./LogHelper";

const fallbackPlanNames = [
    "Prime",
    "Tier 1",
    "Tier 2",
    "Tier 3",
];

let planNames = new Set<string>(fallbackPlanNames);

export function getSubscriptionPlanOptions(): NonNullable<EventSimulationField["options"]> {
    return [
        {title: "Prime", value: "Prime"},
        {title: "Tier 1", value: "1000"},
        {title: "Tier 2", value: "2000"},
        {title: "Tier 3", value: "3000"},
    ];
}

export function getSubscriptionPlanNameOptions(): NonNullable<EventSimulationField["options"]> {
    return [...planNames]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({
            title: name,
            value: name,
        }));
}

export async function refreshSubscriptionPlanNames(api: ApiClient, broadcasterId: string) {
    try {
        const result = await api.subscriptions.getSubscriptions(broadcasterId, {
            limit: 100,
        });

        const names = new Set<string>(fallbackPlanNames);

        for (const subscription of result.data ?? []) {
            const raw = subscription as any;

            // Twitch returns `plan_name`. Depending on Twurple version this may
            // be exposed directly as planName or only be present in wrapped raw data.
            const planName = String(
                raw.planName
                ?? raw._data?.plan_name
                ?? raw.data?.plan_name
                ?? ""
            ).trim();

            if (planName) {
                names.add(planName);
            }
        }

        planNames = names;

        updateSimulationSelectOptions(
            "planName",
            getSubscriptionPlanNameOptions(),
        );
    } catch (error) {
        logWarn("failed to load Twitch subscription plan names");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}
