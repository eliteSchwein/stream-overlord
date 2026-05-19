import {getPrimaryChannel} from "./ConfigHelper";
import getGameInfo from "./GameHelper";
import getWebsocketServer from "../App";
import {getSystemComponents} from "./SystemInfoHelper";
import {getGiveaway} from "./GiveawayHelper";
import {getSongCmd, getStatus} from "./MusicHelper";

export default function fillTemplate(tpl: string, data: any) {
    const ctx = getTemplateVariables(data);

    const SAFE = new Set(["__proto__","prototype","constructor"]);
    const getByPath = (o:any,p:string)=> p.split(".").every(k=>!SAFE.has(k))
        ? p.split(".").reduce((a,k)=>(a!=null?a[k]:undefined),o) : undefined;

    return tpl.replace(/\$\{([^}]+)\}/g, (m, raw) => {
        const expr = String(raw).trim();
        const [root, ...rest] = expr.split(".");
        const key = root.toLowerCase(); // << normalize once
        if (!(key in ctx)) return m;
        const val = getByPath(ctx[key], rest.join("."));
        return val == null ? m : String(val);
    });
}

export function getTemplateVariables(data: any = {}) {
    const ctx: Record<string, any> = {
        data,
        primarychannel: getPrimaryChannel(),
        gameinfo: getGameInfo(),
        musicinfo: getStatus(),
        systeminfo: getSystemComponents(),
        musictext: getSongCmd(),
        giveaway: getGiveaway()
    };

    return ctx;
}

export function updateTemplateVariables() {
    getWebsocketServer().send('notify_variables_update', getTemplateVariables())
}