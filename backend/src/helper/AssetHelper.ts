import {existsSync, readdirSync, unlinkSync, watch} from "node:fs";
import {logRegular} from "./LogHelper";
import {join, resolve} from "node:path";
import {compressAssets, getAssetFile} from "./AssetTuneHelper";
import getWebsocketServer from "../App";

let files = []
let assetFiles = []

const assetPath = resolve(`${__dirname}/../../assets`)
const compressedPath = resolve(`${__dirname}/../../compressed_assets`)

export const imageRegex = /\.(jpe?g|png)$/i
export const videoRegex = /\.mp4$/i

export function getParsedAssetFiles() {
    return assetFiles
}

export function readAssetFolder() {
    logRegular("reading assets folder")
    files = []
    assetFiles = []

    readdirSync(assetPath).forEach((file) => {
        files.push(`${assetPath}/${file}`)
        assetFiles.push(getAssetFile(file))
    })
}

export function initAssetWatcher() {
    watch(resolve(assetPath), {recursive: true}, async (eventType, filename) => {
        if (!filename) return
        cleanOrphanCompressedFile(filename)

        if(!existsSync(`${assetPath}/${filename}`)) return

        await compressAssets(false, `${assetPath}/${filename}`)

        readAssetFolder()

        getWebsocketServer().send("notify_assets_update", getParsedAssetFiles())
    })
}

function cleanOrphanCompressedFile(file: string) {
    const absAsset = `${assetPath}/${file}`;

    if (existsSync(absAsset)) return

    let compressedFile = file

    if(videoRegex.test(compressedFile)) compressedFile = file.replace(videoRegex, '.webm')
    if(imageRegex.test(compressedFile)) compressedFile = file.replace(imageRegex, '.webp')

    if(compressedFile === file) return

    const absCompressed = `${compressedPath}/${compressedFile}`

    if (!existsSync(absCompressed)) return

    logRegular(`delete orphan compressed asset ${compressedFile}`)

    unlinkSync(absCompressed);
}