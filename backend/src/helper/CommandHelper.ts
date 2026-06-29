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