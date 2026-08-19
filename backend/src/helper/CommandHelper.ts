import {ChildProcess, exec} from "child_process";

let showErrorMessage = true

export function setShowErrorMessage(showError: boolean) {
    showErrorMessage = showError
}

export function isShowErrorMessage() {
    return showErrorMessage
}

export const execute = async (command: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (!!stdout) {
                console.log(stdout);
            }

            if(!!stderr) {
                console.error(stderr);
            }

            if (!!error) {
                reject(error.message);
                return;
            }

            resolve(stdout);
        });
    });
}

export const executeProcess = (
    command: string,
): Promise<{process: ChildProcess, promise: Promise<any>}> => {
    return new Promise((resolve) => {
        const child = exec(command)

        const promise = new Promise((resolvePromise, rejectPromise) => {
            child.stdout?.on("data", data => {
                console.log(String(data))
            })

            child.stderr?.on("data", data => {
                console.error(String(data))
            })

            child.on("error", error => {
                rejectPromise(error)
            })

            child.on("close", code => {
                if (code === 0 || code === null) {
                    resolvePromise(true)
                    return
                }

                rejectPromise(code)
            })
        })

        resolve({
            process: child,
            promise,
        })
    })
}

const runtimeCommandEnabled = new Map<string, boolean>()

function normalizeCommandName(name: unknown) {
    return String(name ?? "")
        .trim()
        .replace(/^!+/, "")
        .toLowerCase()
}

export function resetCommandRuntimeStates(commands: Record<string, any> = {}) {
    runtimeCommandEnabled.clear()

    for (const [name, config] of Object.entries(commands)) {
        runtimeCommandEnabled.set(
            normalizeCommandName(name),
            (config as any)?.enabled !== false,
        )
    }
}

export function getCommandRuntimeEnabled(
    name: unknown,
    defaultEnabled: boolean = true,
) {
    const commandName = normalizeCommandName(name)

    if (!runtimeCommandEnabled.has(commandName)) {
        return defaultEnabled
    }

    return runtimeCommandEnabled.get(commandName) === true
}

export function setCommandRuntimeEnabled(
    name: unknown,
    enabled: boolean,
) {
    const commandName = normalizeCommandName(name)

    if (!commandName) {
        throw new Error("command name is required")
    }

    runtimeCommandEnabled.set(commandName, enabled === true)
    return enabled === true
}

export function toggleCommandRuntimeEnabled(
    name: unknown,
    defaultEnabled: boolean = true,
) {
    const enabled = !getCommandRuntimeEnabled(name, defaultEnabled)
    setCommandRuntimeEnabled(name, enabled)
    return enabled
}
