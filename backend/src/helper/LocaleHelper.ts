import de from "../locales/de.json";
import en from "../locales/en.json";
import {getLanguage} from "./ConfigHelper";

const locales: Record<string, any> = {de, en};

function getPath(object: any, key: string) {
    return String(key ?? "").split(".").reduce((current, part) => current?.[part], object);
}

export function translate(key: string, variables: Record<string, any> = {}) {
    const language = getLanguage();
    const value = getPath(locales[language] ?? locales.en, key)
        ?? getPath(locales.en, key)
        ?? getPath(locales.de, key)
        ?? key;

    return String(value).replace(/\{([^}]+)}/g, (_match, name) => {
        const replacement = variables[name];
        return replacement === undefined || replacement === null ? `{${name}}` : String(replacement);
    });
}

export default translate;
