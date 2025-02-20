import {exec} from "child_process";

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