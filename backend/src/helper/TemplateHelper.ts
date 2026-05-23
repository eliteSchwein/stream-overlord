import {getPrimaryChannel} from "./ConfigHelper";
import getGameInfo from "./GameHelper";
import getWebsocketServer from "../App";
import {getSystemComponents} from "./SystemInfoHelper";
import {getGiveaway} from "./GiveawayHelper";
import {
    getActiveMusicPath,
    getRegularMusicFiles,
    getSongCmd,
    getSongRequestState,
    getStatus,
    isSongRequestEnabled,
    isSongRequestQueryAlreadyPresent,
    isSongRequestQueryBlocked,
} from "./MusicHelper";

export default function fillTemplate(tpl: string, data: any) {
    const ctx = getTemplateVariables(data);

    const SAFE = new Set(["__proto__", "prototype", "constructor"]);
    const getByPath = (o: any, p: string) => p.split(".").every(k => !SAFE.has(k))
        ? p.split(".").reduce((a, k) => (a != null ? a[k] : undefined), o)
        : undefined;

    return tpl.replace(/\$\{([^}]+)\}/g, (m, raw) => {
        const expr = String(raw).trim();
        const [root, ...rest] = expr.split(".");
        const key = root.toLowerCase();

        if (!(key in ctx)) return m;

        const val = getByPath(ctx[key], rest.join("."));

        return val == null ? m : String(val);
    });
}

export function getTemplateVariables(data: any = {}) {
    const musicStatus = getStatus();
    const musicText = getSongCmd();
    const songRequest = getSongRequestState();
    const songRequestUrl = data?.url ?? data?.input ?? "";

    const songRequestTemplateState = {
        ...songRequest,
        query: songRequestUrl,
        query_blocked: isSongRequestQueryBlocked(songRequestUrl),
        query_already_present: isSongRequestQueryAlreadyPresent(songRequestUrl),
    };

    const ctx: Record<string, any> = {
        data,
        primarychannel: getPrimaryChannel(),
        gameinfo: getGameInfo(),

        musicinfo: musicStatus,
        musictext: musicText,

        music: {
            status: musicStatus,
            text: musicText,
            active_path: getActiveMusicPath(),
            regular_files: getRegularMusicFiles(),
            songrequest: songRequestTemplateState,
            songrequest_enabled: isSongRequestEnabled(),
        },

        songrequest: songRequestTemplateState,

        systeminfo: getSystemComponents(),
        giveaway: getGiveaway(),
    };

    return ctx;
}

export function updateTemplateVariables() {
    getWebsocketServer().send("notify_variables_update", getTemplateVariables());
}