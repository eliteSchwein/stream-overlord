import parseConfig from "js-conf-parser";

let config = {}

export default function readConfig() {
    config = parseConfig(`${__dirname}/../..`, ".env.conf")
}

export function getConfig() {
    return config
}