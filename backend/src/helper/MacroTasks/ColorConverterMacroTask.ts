import BaseMacroTask from "../../abstracts/BaseMacroTask";
import fillTemplate from "../TemplateHelper";
import {logRegular, logWarn} from "../LogHelper";

type ColorFormat = "hex" | "dec" | "rgb" | "hsv";
type RgbColor = {r: number; g: number; b: number};
type HsvColor = {h: number; s: number; v: number};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizeFormat(value: any): ColorFormat | undefined {
    const format = String(value ?? "").trim().toLowerCase();
    if (format === "hex" || format === "dec" || format === "rgb" || format === "hsv") {
        return format;
    }
    return undefined;
}

function parseNumberList(value: any, keys: string[]): number[] | undefined {
    if (Array.isArray(value)) {
        const numbers = value.slice(0, keys.length).map(Number);
        return numbers.length === keys.length && numbers.every(Number.isFinite) ? numbers : undefined;
    }

    if (value && typeof value === "object") {
        const numbers = keys.map(key => Number(value[key]));
        return numbers.every(Number.isFinite) ? numbers : undefined;
    }

    const text = String(value ?? "").trim();
    if (!text) return undefined;

    const cleaned = text
        .replace(/^(rgb|hsv)\s*\(/i, "")
        .replace(/\)$/, "")
        .trim();

    const parts = cleaned
        .split(/[\s,;]+/)
        .filter(Boolean)
        .slice(0, keys.length)
        .map(Number);

    return parts.length === keys.length && parts.every(Number.isFinite) ? parts : undefined;
}

function parseHex(value: any): RgbColor | undefined {
    let hex = String(value ?? "").trim().replace(/^#/, "").replace(/^0x/i, "");

    if (/^[0-9a-f]{3}$/i.test(hex)) {
        hex = hex.split("").map(char => `${char}${char}`).join("");
    }

    if (!/^[0-9a-f]{6}$/i.test(hex)) return undefined;

    const numeric = Number.parseInt(hex, 16);
    return {
        r: (numeric >> 16) & 0xff,
        g: (numeric >> 8) & 0xff,
        b: numeric & 0xff,
    };
}

function parseDec(value: any): RgbColor | undefined {
    const numeric = typeof value === "number"
        ? value
        : Number(String(value ?? "").trim());

    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffff) {
        return undefined;
    }

    return {
        r: (numeric >> 16) & 0xff,
        g: (numeric >> 8) & 0xff,
        b: numeric & 0xff,
    };
}

function parseRgb(value: any): RgbColor | undefined {
    const parts = parseNumberList(value, ["r", "g", "b"]);
    if (!parts) return undefined;

    if (parts.some(component => component < 0 || component > 255)) return undefined;

    return {
        r: Math.round(parts[0]),
        g: Math.round(parts[1]),
        b: Math.round(parts[2]),
    };
}

function hsvToRgb({h, s, v}: HsvColor): RgbColor {
    const hue = ((h % 360) + 360) % 360;
    const saturation = clamp(s, 0, 100) / 100;
    const value = clamp(v, 0, 100) / 100;

    const chroma = value * saturation;
    const section = hue / 60;
    const x = chroma * (1 - Math.abs((section % 2) - 1));

    let red = 0;
    let green = 0;
    let blue = 0;

    if (section < 1) {
        red = chroma;
        green = x;
    } else if (section < 2) {
        red = x;
        green = chroma;
    } else if (section < 3) {
        green = chroma;
        blue = x;
    } else if (section < 4) {
        green = x;
        blue = chroma;
    } else if (section < 5) {
        red = x;
        blue = chroma;
    } else {
        red = chroma;
        blue = x;
    }

    const match = value - chroma;

    return {
        r: Math.round((red + match) * 255),
        g: Math.round((green + match) * 255),
        b: Math.round((blue + match) * 255),
    };
}

function parseHsv(value: any): RgbColor | undefined {
    const parts = parseNumberList(value, ["h", "s", "v"]);
    if (!parts) return undefined;

    const [h, s, v] = parts;
    if (h < 0 || h > 360 || s < 0 || s > 100 || v < 0 || v > 100) return undefined;

    return hsvToRgb({h, s, v});
}

function rgbToHsv({r, g, b}: RgbColor): HsvColor {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;

    let h = 0;

    if (delta !== 0) {
        if (max === red) {
            h = 60 * (((green - blue) / delta) % 6);
        } else if (max === green) {
            h = 60 * (((blue - red) / delta) + 2);
        } else {
            h = 60 * (((red - green) / delta) + 4);
        }
    }

    if (h < 0) h += 360;

    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = max * 100;

    return {
        h: Math.round(h * 100) / 100,
        s: Math.round(s * 100) / 100,
        v: Math.round(v * 100) / 100,
    };
}

function parseColor(format: ColorFormat, value: any): RgbColor | undefined {
    switch (format) {
        case "hex": return parseHex(value);
        case "dec": return parseDec(value);
        case "rgb": return parseRgb(value);
        case "hsv": return parseHsv(value);
    }
}

function formatColor(format: ColorFormat, rgb: RgbColor): string | number {
    switch (format) {
        case "hex":
            return `#${[rgb.r, rgb.g, rgb.b]
                .map(component => component.toString(16).padStart(2, "0"))
                .join("")
                .toUpperCase()}`;
        case "dec":
            return (rgb.r << 16) + (rgb.g << 8) + rgb.b;
        case "rgb":
            return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        case "hsv": {
            const hsv = rgbToHsv(rgb);
            return `${hsv.h}, ${hsv.s}, ${hsv.v}`;
        }
    }
}

export default class ColorConverterMacroTask extends BaseMacroTask {
    channel = "color_converter";

    async handle(method: string, data: any = {}, variables: any = {}) {
        const from = normalizeFormat(data.from ?? method);
        const to = normalizeFormat(data.to);

        if (!from) {
            logWarn(`color_converter requires from: hex, dec, rgb or hsv`);
            return;
        }

        if (!to) {
            logWarn(`color_converter requires to: hex, dec, rgb or hsv`);
            return;
        }

        if (!data.key) {
            logWarn(`color_converter requires key`);
            return;
        }

        if (data.value === undefined || data.value === null) {
            logWarn(`color_converter requires value`);
            return;
        }

        const templatedValue = typeof data.value === "string"
            ? fillTemplate(data.value, variables)
            : data.value;

        const rgb = parseColor(from, templatedValue);

        if (!rgb) {
            logWarn(`color_converter invalid ${from} value`);
            return;
        }

        const result = formatColor(to, rgb);
        variables[data.key] = result;

        logRegular(`color_converter ${from} -> ${to}: ${data.key}=${result}`);
    }
}
