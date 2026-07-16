import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";

type KeyValueEntry = {
    key?: string;
    name?: string;
    value?: any;
    enabled?: boolean;
};

type RequestBodyType = "none" | "json" | "form" | "multipart" | "raw";

export default class ApiRequestMacroTask extends BaseMacroTask {
    channel = "api_request"

    async handle(method: string, data: any = {}, variables: any = {}) {
        const requestMethod = this.normalizeMethod(method)
        const url = String(data.url ?? "").trim()

        if (!url) {
            logWarn(`api request ${requestMethod} requires url`)
            return
        }

        const resultKey = String(data.result_variable ?? data.resultVariable ?? "api_response").trim()
        const timeout = this.normalizeTimeout(data.timeout)
        const headers = this.normalizeRecord(data.headers)
        const query = this.normalizeRecord(data.query ?? data.query_params ?? data.queryParams)
        const requestUrl = this.appendQuery(url, query)
        const controller = new AbortController()
        const timeoutHandle = setTimeout(() => controller.abort(), timeout)

        try {
            const options: RequestInit = {
                method: requestMethod,
                headers,
                signal: controller.signal,
            };

            if (this.methodSupportsBody(requestMethod)) {
                const body = this.createBody(data, headers)

                if (body !== undefined) {
                    options.body = body
                }
            }

            logRegular(`api request ${requestMethod} ${requestUrl}`)

            const response = await fetch(requestUrl, options)
            const result = await this.parseResponseBody(response)

            if (resultKey) {
                variables[resultKey] = result
            }

            if (!response.ok && data.fail_on_error === true) {
                throw new Error(`request failed with status ${response.status} ${response.statusText}`);
            }

            logRegular(`api request ${requestMethod} ${requestUrl} -> ${response.status}`);
            return result;
        } catch (error: any) {
            const message = error?.name === "AbortError"
                ? `request timed out after ${timeout}ms`
                : error?.message ?? String(error);

            const result = {
                ok: false,
                status: 0,
                status_text: "",
                url: requestUrl,
                headers: {},
                body: null,
                error: message,
            };

            if (resultKey) {
                variables[resultKey] = result;
            }

            logWarn(`api request ${requestMethod} ${requestUrl} failed: ${message}`);

            if (data.fail_on_error === true) {
                throw error;
            }

            return result;
        } finally {
            clearTimeout(timeoutHandle);
        }
    }

    private normalizeMethod(method: string) {
        const normalized = String(method ?? "GET").trim().toUpperCase();

        if (normalized === "UPDATE") {
            return "PUT";
        }

        const supported = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

        if (!supported.includes(normalized)) {
            throw new Error(`unsupported api request method: ${method}`);
        }

        return normalized;
    }

    private normalizeTimeout(value: any) {
        const timeout = Number(value ?? 30000);

        if (!Number.isFinite(timeout) || timeout <= 0) {
            return 30000;
        }

        return Math.min(timeout, 300000);
    }

    private methodSupportsBody(method: string) {
        return !["GET", "HEAD"].includes(method);
    }

    private normalizeRecord(value: any): Record<string, string> {
        if (!value) return {};

        if (Array.isArray(value)) {
            return value.reduce((result: Record<string, string>, entry: KeyValueEntry) => {
                if (entry?.enabled === false) return result;

                const key = String(entry?.key ?? entry?.name ?? "").trim();
                if (!key) return result;

                result[key] = this.stringifyValue(entry?.value);
                return result;
            }, {});
        }

        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return {};

            try {
                return this.normalizeRecord(JSON.parse(trimmed));
            } catch (error) {
                logWarn(`failed to parse api request object: ${trimmed}`);
                return {};
            }
        }

        if (typeof value === "object") {
            return Object.entries(value).reduce((result: Record<string, string>, [key, entryValue]) => {
                result[key] = this.stringifyValue(entryValue);
                return result;
            }, {});
        }

        return {};
    }

    private stringifyValue(value: any) {
        if (value === undefined || value === null) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    }

    private appendQuery(url: string, query: Record<string, string>) {
        const entries = Object.entries(query);
        if (entries.length === 0) return url;

        const parsedUrl = new URL(url);

        for (const [key, value] of entries) {
            parsedUrl.searchParams.set(key, value);
        }

        return parsedUrl.toString();
    }

    private createBody(data: any, headers: Record<string, string>): BodyInit | undefined {
        const bodyType = String(data.body_type ?? data.bodyType ?? "json").toLowerCase() as RequestBodyType;
        const bodyData = data.body_data ?? data.bodyData ?? data.body;
        const formData = data.form_data ?? data.formData ?? data.form;

        switch (bodyType) {
            case "none":
                return undefined;

            case "json": {
                this.setDefaultHeader(headers, "content-type", "application/json");

                if (typeof bodyData === "string") {
                    const trimmed = bodyData.trim();
                    if (!trimmed) return undefined;

                    try {
                        return JSON.stringify(JSON.parse(trimmed));
                    } catch (error) {
                        return JSON.stringify(bodyData);
                    }
                }

                return bodyData === undefined ? undefined : JSON.stringify(bodyData);
            }

            case "form": {
                this.setDefaultHeader(headers, "content-type", "application/x-www-form-urlencoded;charset=UTF-8");
                const values = this.normalizeRecord(formData ?? bodyData);
                return new URLSearchParams(values).toString();
            }

            case "multipart": {
                this.deleteHeader(headers, "content-type");
                const multipart = new FormData();
                const values = this.normalizeFormEntries(formData ?? bodyData);

                for (const entry of values) {
                    multipart.append(entry.key, entry.value);
                }

                return multipart;
            }

            case "raw":
                return bodyData === undefined || bodyData === null ? undefined : String(bodyData);

            default:
                throw new Error(`unsupported api request body type: ${bodyType}`);
        }
    }

    private normalizeFormEntries(value: any): Array<{key: string; value: string}> {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value
                .filter((entry: KeyValueEntry) => entry?.enabled !== false)
                .map((entry: KeyValueEntry) => ({
                    key: String(entry?.key ?? entry?.name ?? "").trim(),
                    value: this.stringifyValue(entry?.value),
                }))
                .filter(entry => entry.key.length > 0);
        }

        const record = this.normalizeRecord(value);
        return Object.entries(record).map(([key, entryValue]) => ({key, value: entryValue}));
    }

    private setDefaultHeader(headers: Record<string, string>, name: string, value: string) {
        const existing = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase());

        if (!existing) {
            headers[name] = value;
        }
    }

    private deleteHeader(headers: Record<string, string>, name: string) {
        const existing = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase());

        if (existing) {
            delete headers[existing];
        }
    }

    private async parseResponseBody(response: Response) {
        if (response.status === 204 || response.status === 205) {
            return null;
        }

        const text = await response.text();
        if (!text) return null;

        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json") || contentType.includes("+json")) {
            try {
                return JSON.parse(text);
            } catch (error) {
                return text;
            }
        }

        try {
            return JSON.parse(text);
        } catch (error) {
            return text;
        }
    }
}
