import {existsSync, readdirSync, unlinkSync, watch} from "node:fs";
import {logRegular} from "./LogHelper";
import {resolve} from "node:path";
import {compressAssets} from "./AssetTuneHelper";

let files = []

const assetPath = resolve(`${__dirname}/../../assets`)
const compressedPath = resolve(`${__dirname}/../../compressed_assets`)

export function readAssetFolder() {
    logRegular("reading assets folder")
    files = []

    readdirSync(assetPath).forEach((file) => {
        files.push(`${assetPath}/${file}`)
    })
}

export function initAssetWatcher() {
    watch(resolve(assetPath), {recursive: true}, async (eventType, filename) => {
        if (!filename) return
        deleteCompressedIfNotExists(filename)

        if(!existsSync(`${assetPath}/${filename}`)) return

        await compressAssets(true, `${assetPath}/${filename}`)
    })
}

function deleteCompressedIfNotExists(file: string) {

    if(existsSync(`${assetPath}/${file}`)) return
    if(!existsSync(`${compressedPath}/${file}`)) return

    unlinkSync(`${compressedPath}/${file}`)
}