import {Bot, BotCommandContext, createBotCommand} from "@twurple/easy-bot";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import {hasModerator, hasVip} from "../helper/PermissionHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class BaseCommand {
    command: string
    aliases = []
    params = []
    requiresVip = false
    requiresMod = false
    requiresBroadcaster = false
    globalCooldown = 5
    userCooldown = 10

    bot: Bot

    public constructor(bot: Bot) {
        this.bot = bot;
    }

    // params examples:
    // {
    // name: string,
    // type: number
    // },
    // {
    // name: string,
    // type: string
    // },
    // {
    // name: string,
    // type: user
    // }

    public register() {
        const commands = []

        logRegular(`register command: ${this.command}`)

        commands.push(createBotCommand(this.command, (param, context) => {
            void this.handleCommand(param, context)
        }, {aliases: this.aliases, userCooldown: this.userCooldown, globalCooldown: this.globalCooldown}))

        return commands
    }

    private async handleCommand(param: string[], context: BotCommandContext) {
        if(this.requiresBroadcaster && context.broadcasterId !== context.userId) {
            await this.replyPermissionError(context)
            return
        }
        if(this.requiresMod &&
            !hasModerator(context.broadcasterName, context.userId) &&
            context.broadcasterId !== context.userId) {
            await this.replyPermissionError(context)
            return
        }
        if(this.requiresVip &&
            !hasVip(context.broadcasterName, context.userId) &&
            context.broadcasterId !== context.userId) {
            await this.replyPermissionError(context)
            return
        }

        if(isShieldActive() && !hasModerator(context.broadcasterName, context.userId) && context.broadcasterId !== context.userId) {
            await context.reply('der Schild Modus ist aktiv!')
            return
        }

        if(param.length < this.params.length) {
            await this.replyParamLengthError(param, context)
            return
        }

        const params = {}

        let paramIndex = 0

        const firstParamOptions = this.params[0]

        if(firstParamOptions && firstParamOptions.type === 'all') {
            let data = ''
            for(const paramPartial of param) {
                data = `${data} ${paramPartial}`
            }
            params[firstParamOptions.name] = data.substring(1)
        } else {
            for(const paramPartial of param) {
                const paramOptions = this.params[paramIndex]

                if(!paramOptions) continue

                if(paramOptions.type === 'number') {
                    const number = Number(paramPartial)
                    if (isNaN(number)) {
                        await this.replyParamSyntaxError(param, context, paramIndex, 'Nummer')
                        return
                    }

                    params[paramOptions.name] = number
                    continue
                }

                if(paramOptions.type === 'user') {
                    let userName = paramPartial

                    if(userName.startsWith('@')) userName = userName.substring(1)

                    const user = await this.bot.api.users.getUserByName(userName)
                    if(user === null || user === undefined) {
                        await this.replyParamSyntaxError(param, context, paramIndex, 'Benutzer')
                        return
                    }

                    params[paramOptions.name] = user
                    continue
                }

                params[paramOptions.name] = paramPartial

                paramIndex++
            }
        }

        logRegular(`command by ${context.userName} in ${context.broadcasterName}: ${this.command} ${param.join(' ')}`)

        await this.handle(params, context)
    }

    private async replyParamSyntaxError(param: string[], context: BotCommandContext, index: number, type: string) {
        logWarn(`invalid param at ${index} by ${context.userName} in ${context.broadcasterName}: ${this.command} ${param.join(' ')}`)
        await context.reply(`der Parameter ${index+1} ist ein ${type}!`)
    }

    private async replyParamLengthError(param: string[], context: BotCommandContext) {
        logWarn(`missing param by ${context.userName} in ${context.broadcasterName}: ${this.command} ${param.join(' ')}`)
        await context.reply(`der Befehl hat ${this.params.length} Parameter!`)
    }

    private async replyPermissionError(context: BotCommandContext) {
        logWarn(`permission denied: ${context.userName} in ${context.broadcasterName}`)
        await context.reply('du hast keine Berechtigung auf diesen Befehl!')
    }

    async handle(params: any, context: BotCommandContext) {

    }
}