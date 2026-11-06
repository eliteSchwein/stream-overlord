import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";
import {getLanguage} from "../ConfigHelper";

/**
 * Formatting helpers for macros. Every method reads data.value and writes the
 * formatted string to variables[data.key].
 *
 * date      value: date (ISO, unix seconds/ms, "now"/empty), format: preset or pattern, timezone?
 * duration  value + unit: seconds | milliseconds | minutes | since | until, style: long | short | clock,
 *           max_units, smallest_unit
 * case      mode: upper | lower | capitalize | title
 * truncate  length, suffix, words
 * replace   search, replacement, regex, ignore_case
 * pad       length, char, side: start | end | both
 * number    decimals, style: decimal | percent | compact
 */

type DurationUnit = "year" | "month" | "day" | "hour" | "minute" | "second";

const DURATION_UNITS: DurationUnit[] = ["year", "month", "day", "hour", "minute", "second"];

const UNIT_SECONDS: Record<DurationUnit, number> = {
    year: 365 * 24 * 60 * 60,
    month: 30 * 24 * 60 * 60,
    day: 24 * 60 * 60,
    hour: 60 * 60,
    minute: 60,
    second: 1,
};

const DATE_PRESETS: Record<string, Intl.DateTimeFormatOptions> = {
    date: {dateStyle: "medium"},
    date_short: {dateStyle: "short"},
    date_long: {dateStyle: "long"},
    time: {timeStyle: "short"},
    time_seconds: {timeStyle: "medium"},
    datetime: {dateStyle: "medium", timeStyle: "short"},
    datetime_long: {dateStyle: "long", timeStyle: "short"},
};

const DATE_TOKEN_REGEX = /\[([^\]]*)]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D|HH|H|hh|h|mm|m|ss|s|A/g;

function getLocale(data: any): string {
    return String(data.locale ?? "").trim() || getLanguage() || "en";
}

function toNumber(value: any, fallback: number): number {
    if (value === undefined || value === null || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value: any): boolean {
    return value === true || value === "true";
}

export function parseDate(value: any): Date | undefined {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value;
    }

    const text = String(value ?? "")
        .trim()
        .replace(/^"(.*)"$/, "$1");

    if (!text || text.toLowerCase() === "now") return new Date();

    if (/^-?\d+(\.\d+)?$/.test(text)) {
        const number = Number(text);
        // below 1e11 it can only sensibly be unix seconds (year 5138 in ms)
        return new Date(Math.abs(number) < 1e11 ? number * 1000 : number);
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function getDateParts(date: Date, timeZone?: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);

    return {
        year: get("year"),
        month: get("month"),
        day: get("day"),
        hour: get("hour"),
        minute: get("minute"),
        second: get("second"),
    };
}

function formatDatePattern(date: Date, pattern: string, locale: string, timeZone?: string) {
    const parts = getDateParts(date, timeZone);
    const name = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, {...options, timeZone}).format(date);
    const pad = (value: number, length = 2) => String(value).padStart(length, "0");
    const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;

    return pattern.replace(DATE_TOKEN_REGEX, (token, literal) => {
        if (literal !== undefined) return literal;

        switch (token) {
            case "YYYY": return pad(parts.year, 4);
            case "YY": return pad(parts.year % 100);
            case "MMMM": return name({month: "long"});
            case "MMM": return name({month: "short"});
            case "MM": return pad(parts.month);
            case "M": return String(parts.month);
            case "dddd": return name({weekday: "long"});
            case "ddd": return name({weekday: "short"});
            case "DD": return pad(parts.day);
            case "D": return String(parts.day);
            case "HH": return pad(parts.hour);
            case "H": return String(parts.hour);
            case "hh": return pad(hour12);
            case "h": return String(hour12);
            case "mm": return pad(parts.minute);
            case "m": return String(parts.minute);
            case "ss": return pad(parts.second);
            case "s": return String(parts.second);
            case "A": return parts.hour < 12 ? "AM" : "PM";
            default: return token;
        }
    });
}

function formatRelative(date: Date, locale: string) {
    const diffSeconds = (date.getTime() - Date.now()) / 1000;
    const absolute = Math.abs(diffSeconds);
    const unit = DURATION_UNITS.find(candidate => absolute >= UNIT_SECONDS[candidate]) ?? "second";

    return new Intl.RelativeTimeFormat(locale, {numeric: "auto"})
        .format(Math.round(diffSeconds / UNIT_SECONDS[unit]), unit);
}

function formatDate(data: any) {
    const date = parseDate(data.value);
    if (!date) throw new Error(`invalid date: ${JSON.stringify(data.value)}`);

    const locale = getLocale(data);
    const timeZone = String(data.timezone ?? "").trim() || undefined;
    const format = String(data.format ?? "datetime").trim() || "datetime";

    if (format === "relative") return formatRelative(date, locale);
    if (format === "iso") return date.toISOString();
    if (format === "unix") return String(Math.floor(date.getTime() / 1000));

    if (DATE_PRESETS[format]) {
        return new Intl.DateTimeFormat(locale, {...DATE_PRESETS[format], timeZone}).format(date);
    }

    return formatDatePattern(date, format, locale, timeZone);
}

function addMonths(date: Date, months: number) {
    const target = new Date(date.getTime());
    const day = target.getDate();

    target.setDate(1);
    target.setMonth(target.getMonth() + months);

    const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, daysInMonth));

    return target;
}

function splitSeconds(totalSeconds: number, parts: Record<DurationUnit, number>) {
    let rest = Math.floor(totalSeconds);

    for (const unit of ["day", "hour", "minute", "second"] as DurationUnit[]) {
        parts[unit] = Math.floor(rest / UNIT_SECONDS[unit]);
        rest -= parts[unit] * UNIT_SECONDS[unit];
    }

    return parts;
}

function calendarDuration(from: Date, to: Date): Record<DurationUnit, number> {
    if (from > to) [from, to] = [to, from];

    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    let anchor = addMonths(from, months);

    if (anchor > to) {
        months--;
        anchor = addMonths(from, months);
    }

    const parts = splitSeconds((to.getTime() - anchor.getTime()) / 1000, {
        year: Math.floor(months / 12),
        month: months % 12,
        day: 0,
        hour: 0,
        minute: 0,
        second: 0,
    });

    return parts;
}

function getDurationParts(data: any): {parts: Record<DurationUnit, number>, totalSeconds: number} {
    const unit = String(data.unit ?? "seconds").trim();

    if (unit === "since" || unit === "until") {
        const date = parseDate(data.value);
        if (!date) throw new Error(`invalid date: ${JSON.stringify(data.value)}`);

        const now = new Date();

        return {
            parts: calendarDuration(date, now),
            totalSeconds: Math.abs(now.getTime() - date.getTime()) / 1000,
        };
    }

    const value = Number(String(data.value ?? "").trim().replace(/^"(.*)"$/, "$1"));
    if (!Number.isFinite(value)) throw new Error(`invalid number: ${JSON.stringify(data.value)}`);

    const factor = unit === "milliseconds" ? 0.001 : unit === "minutes" ? 60 : unit === "hours" ? 3600 : 1;
    const totalSeconds = Math.abs(value * factor);

    return {
        parts: splitSeconds(totalSeconds, {year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0}),
        totalSeconds,
    };
}

function formatDuration(data: any) {
    const {parts, totalSeconds} = getDurationParts(data);
    const style = String(data.style ?? "long").trim();

    if (style === "clock") {
        const total = Math.floor(totalSeconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        const pad = (value: number) => String(value).padStart(2, "0");

        return hours > 0
            ? `${hours}:${pad(minutes)}:${pad(seconds)}`
            : `${minutes}:${pad(seconds)}`;
    }

    const locale = getLocale(data);
    const smallest = DURATION_UNITS.includes(data.smallest_unit) ? data.smallest_unit as DurationUnit : "second";
    const allowed = DURATION_UNITS.slice(0, DURATION_UNITS.indexOf(smallest) + 1);
    const maxUnits = Math.max(0, Math.floor(toNumber(data.max_units, 3)));

    let used = allowed
        .filter(unit => parts[unit] > 0)
        .map(unit => ({unit, value: parts[unit]}));

    if (maxUnits > 0) used = used.slice(0, maxUnits);
    if (!used.length) used = [{unit: smallest, value: 0}];

    const unitDisplay = style === "short" ? "short" : "long";
    const formatted = used.map(({unit, value}) =>
        new Intl.NumberFormat(locale, {style: "unit", unit, unitDisplay}).format(value)
    );

    return style === "short"
        ? new Intl.ListFormat(locale, {style: "narrow", type: "unit"}).format(formatted)
        : new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(formatted);
}

function capitalize(text: string, locale: string) {
    const [first = "", ...rest] = Array.from(text);
    return first.toLocaleUpperCase(locale) + rest.join("");
}

function formatCase(data: any) {
    const text = String(data.value ?? "");
    const locale = getLocale(data);

    switch (String(data.mode ?? "upper")) {
        case "lower":
            return text.toLocaleLowerCase(locale);
        case "capitalize":
            return capitalize(text, locale);
        case "title":
            return text
                .toLocaleLowerCase(locale)
                .replace(/(^|[\s\-_/(])(\S)/gu, (_match, separator, char) =>
                    separator + char.toLocaleUpperCase(locale)
                );
        default:
            return text.toLocaleUpperCase(locale);
    }
}

function truncate(data: any) {
    const chars = Array.from(String(data.value ?? ""));
    const length = Math.max(0, Math.floor(toNumber(data.length, 100)));
    const suffix = data.suffix === undefined || data.suffix === null ? "…" : String(data.suffix);

    if (chars.length <= length) return chars.join("");

    const suffixLength = Array.from(suffix).length;
    let cut = chars.slice(0, Math.max(0, length - suffixLength)).join("");

    if (toBoolean(data.words)) {
        const lastSpace = cut.search(/\s\S*$/);
        if (lastSpace > 0) cut = cut.slice(0, lastSpace);
    }

    return cut.trimEnd() + suffix;
}

function escapeRegex(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replace(data: any) {
    const text = String(data.value ?? "");
    const search = String(data.search ?? "");
    const replacement = String(data.replacement ?? "");

    if (!search) return text;

    const flags = `g${toBoolean(data.ignore_case) ? "i" : ""}u`;

    if (toBoolean(data.regex)) {
        return text.replace(new RegExp(search, flags), replacement);
    }

    // plain search: replacement is literal, so $ has no special meaning
    return text.replace(new RegExp(escapeRegex(search), flags), () => replacement);
}

function pad(data: any) {
    const chars = Array.from(String(data.value ?? ""));
    const length = Math.max(0, Math.floor(toNumber(data.length, 0)));
    const padChars = Array.from(String(data.char ?? "") || " ");
    const missing = length - chars.length;

    if (missing <= 0) return chars.join("");

    const fill = (count: number) =>
        Array.from({length: count}, (_, index) => padChars[index % padChars.length]).join("");

    switch (String(data.side ?? "start")) {
        case "end":
            return chars.join("") + fill(missing);
        case "both": {
            const start = Math.floor(missing / 2);
            return fill(start) + chars.join("") + fill(missing - start);
        }
        default:
            return fill(missing) + chars.join("");
    }
}

function formatNumber(data: any) {
    const value = Number(String(data.value ?? "").trim().replace(/^"(.*)"$/, "$1"));
    if (!Number.isFinite(value)) throw new Error(`invalid number: ${JSON.stringify(data.value)}`);

    const style = String(data.style ?? "decimal");
    const options: Intl.NumberFormatOptions = {};

    if (style === "percent") options.style = "percent";
    if (style === "compact") options.notation = "compact";

    if (data.decimals !== undefined && data.decimals !== null && data.decimals !== "") {
        const decimals = Math.min(20, Math.max(0, Math.floor(toNumber(data.decimals, 0))));
        options.minimumFractionDigits = decimals;
        options.maximumFractionDigits = decimals;
    }

    return new Intl.NumberFormat(getLocale(data), options).format(value);
}

const FORMATTERS: Record<string, (data: any) => string> = {
    date: formatDate,
    duration: formatDuration,
    case: formatCase,
    truncate,
    replace,
    pad,
    number: formatNumber,
};

export default class FormatMacroTask extends BaseMacroTask {
    channel = "format"

    async handle(method: string, data: any = {}, variables: any = {}) {
        const formatter = FORMATTERS[method];

        if (!formatter) {
            logWarn(`invalid format method: ${method}`);
            return;
        }

        const key = String(data.key ?? "").trim();

        if (!key) {
            logWarn(`format ${method} requires key`);
            return;
        }

        try {
            const result = formatter(data);
            variables[key] = result;

            logRegular(`format ${method}: ${key}=${JSON.stringify(result)}`);
        } catch (error: any) {
            logWarn(`format ${method} failed: ${error?.message ?? error}`);
        }
    }
}
