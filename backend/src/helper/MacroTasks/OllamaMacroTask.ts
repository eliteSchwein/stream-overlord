import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {directOllamaRequest} from "../OllamaHelper";
import {getOllamaIntegration} from "../IntegrationsHelper";
import {logRegular, logWarn} from "../LogHelper";

type OllamaChatRole = "system" | "user" | "assistant" | "tool";

type OllamaChatMessage = {
    role: OllamaChatRole;
    content: string;
};

export default class OllamaMacroTask extends BaseMacroTask {
    channel = "ollama";

    async handle(method: string, data: any = {}, variables: any = {}) {
        if (method !== "chat") {
            logWarn(`invalid ollama method: ${method}`);
            return;
        }

        const model = String(getOllamaIntegration().model ?? "").trim();
        if (!model) {
            throw new Error("ollama integration has no model configured");
        }

        const messages = this.normalizeMessages(data.messages);
        if (messages.length === 0) {
            throw new Error("ollama chat requires at least one message");
        }

        const resultKey = String(
            data.result_variable
            ?? data.resultVariable
            ?? "ollama_response"
        ).trim();

        const timeout = Number(data.timeout ?? 0);

        logRegular(`ollama macro chat with ${messages.length} message(s)`);

        const response = await directOllamaRequest({
            path: "/api/chat",
            method: "POST",
            timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 0,
            data: {
                model,
                messages,
                stream: false,

                // The macro is intentionally stateless. Ollama's chat endpoint
                // receives the complete conversation for this one request and
                // keep_alive=0 unloads the model immediately afterwards.
                keep_alive: 0,
            },
        });

        let content = String(response?.message?.content ?? "");

        const stripEmojis = data.strip_emojis === true || data.stripEmojis === true;

        if (stripEmojis) {
            content = this.stripEmojis(content);
        }

        if (resultKey) {
            variables[resultKey] = content;
        }

        return content;
    }

    private stripEmojis(content: string): string {
        return content
            // Keycap emoji sequences, e.g. 1️⃣
            .replace(/[#*0-9]\uFE0F?\u20E3/gu, "")
            // Flags are made from regional indicator symbols.
            .replace(/\p{Regional_Indicator}+/gu, "")
            // Normal pictographic emoji and skin-tone modifiers.
            .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}]/gu, "")
            // Remove selectors/joiners left over from emoji sequences.
            .replace(/[\uFE0E\uFE0F\u200D]/gu, "")
            // Clean whitespace left behind by removed emoji.
            .replace(/[ \t]{2,}/g, " ")
            .trim();
    }

    private normalizeMessages(value: any): OllamaChatMessage[] {
        if (!Array.isArray(value)) return [];

        const allowedRoles = new Set<OllamaChatRole>([
            "system",
            "user",
            "assistant",
            "tool",
        ]);

        return value
            .map((entry: any): OllamaChatMessage | null => {
                const role = String(entry?.role ?? "").trim().toLowerCase() as OllamaChatRole;
                const content = String(entry?.content ?? "");

                if (!allowedRoles.has(role)) {
                    return null;
                }

                if (!content.trim()) {
                    return null;
                }

                return {
                    role,
                    content,
                };
            })
            .filter((entry): entry is OllamaChatMessage => entry !== null);
    }
}
