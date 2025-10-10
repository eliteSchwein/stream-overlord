import {Bot, BotCommandContext, createBotCommand} from "@twurple/easy-bot";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import {hasModerator, hasVip} from "../helper/PermissionHelper";
import isShieldActive from "../../../helper/ShieldHelper";
import {isShowErrorMessage} from "../../../helper/CommandHelper";
import {getPrimaryChannel} from "../../../helper/ConfigHelper";

export default class BaseCommand {
    command: string
    aliases = []
    params = []
    requiresVip = false
    requiresMod = false
    requiresBroadcaster = false
    globalCooldown = 5
    userCooldown = 10
    enforceSame = false

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
    // type: subcommand,
    // required: false,
    // subcommands: [
    //     {
    //         name: string
    //     }
    // ]
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
        if(this.enforceSame) {
            const primaryChannel = getPrimaryChannel()

            if(context.broadcasterId !== primaryChannel.id) return
        }
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

        const params = {}

        for (const paramOptions of this.params) {
            if (paramOptions.required === undefined) {
                paramOptions.required = true
            }
        }

        const requiredParams = this.params.filter(p => p.required)
        if (param.length < requiredParams.length) {
            await this.replyMissingParamError(param, context, param.length)
            return
        }

        let paramIndex = 0

        const firstParamOptions = this.params[0]

        if (firstParamOptions && firstParamOptions.type === 'all') {
            let data = ''
            for (const paramPartial of param) {
                data = `${data} ${paramPartial}`
            }
            params[firstParamOptions.name] = data.substring(1)
        } else {

            for (const paramPartial of param) {
                const paramOptions = this.params[paramIndex]

                if (!paramOptions) continue

                if (paramOptions.type === 'number') {
                    const number = Number(paramPartial)
                    if (isNaN(number)) {
                        await this.replyParamSyntaxError(param, context, paramIndex, 'Nummer')
                        return
                    }
                    params[paramOptions.name] = number
                    paramIndex++
                    continue
                }

                if (paramOptions.type === 'user') {
                    let userName = paramPartial
                    if (userName.startsWith('@')) userName = userName.substring(1)

                    const user = await this.bot.api.users.getUserByName(userName)
                    if (!user) {
                        await this.replyParamSyntaxError(param, context, paramIndex, 'Benutzer')
                        return
                    }

                    params[paramOptions.name] = user
                    paramIndex++
                    continue
                }

                if (paramOptions.type === 'subcommand') {
                    const subcommand = paramPartial
                    const validSubcommands = paramOptions.subcommands.map(s => s.name)
                    const validSubcommand = validSubcommands.includes(subcommand)

                    if (!validSubcommand) {
                        await this.replyInvalidSubcommand(param, context, paramIndex, validSubcommands)
                        return
                    }
                }

                params[paramOptions.name] = paramPartial
                paramIndex++
            }
        }

        logRegular(`command by ${context.userName} in ${context.broadcasterName}: ${this.command} ${param.join(' ')}`)

        try {
            await this.handle(params, context, param)
        } catch (error) {
            logWarn(`command ${this.command} failed:`)
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }

    protected async replyInvalidSubcommand(param: string[], context: BotCommandContext, index: number, validSubcommands: string[]) {
        logWarn(`invalid param at ${index} by ${context.userName} in ${context.broadcasterName}: ${this.command} ${param.join(' ')}`)
        await context.reply(`der Parameter ${index+1} ist ungültig, valide Unterbefehle sind: ${validSubcommands.join(', ')}`)
    }

    protected async replyMissingParamError(param: string[], context: BotCommandContext, index: number) {
        logWarn(`missing param at ${index} by ${context.userName} in ${context.broadcasterName}: ${this.command} ${param.join(' ')}`)
        await context.reply(`der Parameter ${index+1} wird benötigt!`)
    }

    protected async replyParamSyntaxError(param: string[], context: BotCommandContext, index: number, type: string) {
        logWarn(`invalid param at ${index} by ${context.userName} in ${context.broadcasterName}: ${this.command} ${param.join(' ')}`)
        await context.reply(`der Parameter ${index+1} ist ein ${type}!`)
    }

    protected async replyPermissionError(context: BotCommandContext) {
        logWarn(`permission denied: ${context.userName} in ${context.broadcasterName}`)
        if(!isShowErrorMessage()) return
        await context.reply('du hast keine Berechtigung auf diesen Befehl!')
    }

    protected async replyCommandError(context: BotCommandContext, message: string) {
        if(!isShowErrorMessage()) return
        await context.reply(message)
    }

    async handle(params: any, context: BotCommandContext, rawParam: string[]) {

    }
}