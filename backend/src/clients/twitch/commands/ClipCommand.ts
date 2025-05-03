import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getConfig} from "../../../helper/ConfigHelper";
import {sleep} from "../../../../../helper/GeneralHelper";

export default class ClipCommand extends BaseCommand{
    command = 'clip'
    globalCooldown = 10
    userCooldown = 15

    async handle(params: any, context: BotCommandContext) {
        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])
        const webhookUrl = getConfig(/api clip_url/g)[0]

        const clipId = await this.bot.api.clips.createClip({channel: primaryChannel, createAfterDelay: false})

        await sleep(5_000)

        const clip = await this.bot.api.clips.getClipById(clipId)

        await context.say(`created clip: ${clip.url}`)

        const webhookContent = {
          "content": "",
          "embeds": [
              {
                  "id": 10674342,
                  "title": `${context.userDisplayName} hat ein Clip Live erstellt mit !clip`,
                  "color": 6570405,
                  "fields": [
                      {
                          "id": 472281785,
                          "name": "Game",
                          "value": (await clip.getGame()).name,
                          "inline": true
                      },
                      {
                          "id": 608893643,
                          "name": "URL",
                          "value": clip.url,
                          "inline": true
                      }
                  ],
                  "image": {
                      "url": clip.thumbnailUrl
                  }
              }
          ],
          "attachments": []
        }

        await fetch(webhookUrl.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(webhookContent),
        })
    }
}