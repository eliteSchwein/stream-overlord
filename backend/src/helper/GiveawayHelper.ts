import {HelixUser} from "@twurple/api";
import getWebsocketServer, {getTwitchClient} from "../App";
import {logRegular} from "./LogHelper";

const giveaway = {
    winner: undefined,
    content: '',
    users: [],
    interval: 0,
    currentInterval: 0,
    active: false,
}

export function hasGiveawayUser(user: HelixUser): boolean {
    return giveaway.users.some(u => u.id === user.id);
}

export function removeGiveawayUser(user: HelixUser): void {
    const i = giveaway.users.findIndex(u => u.id === user.id);
    if (i !== -1) giveaway.users.splice(i, 1);
}

export function addGiveawayUser(User: HelixUser) {
    giveaway.users.push(User)
    getWebsocketServer().send('notify_giveaway_update', getGiveaway())
}

export async function startGiveaway(content: string, duration: number) {
    await stopGiveaway()

    giveaway.interval = duration * 60
    giveaway.currentInterval = duration * 60
    giveaway.content = content
    giveaway.active = true

    logRegular(`giveaway started with content: ${content} and duration: ${duration}`)
    await getTwitchClient().announce(
        `Es wurde eine Verlosung gestartet! Es wird ${giveaway.content} verlost. Die Verlosung geht ${duration} Minuten. Mit !ticket kann man teilnehmen.`
    )

    getWebsocketServer().send('notify_giveaway_update', getGiveaway())
}

export async function stopGiveaway() {
    if(giveaway.active) {
        logRegular(`giveaway stopped`)
        await getTwitchClient().announce(`Die Verlosung wurde abgebrochen!`, 'orange')
    }
    giveaway.currentInterval = 0
    giveaway.interval = 0
    giveaway.users = []
    giveaway.winner = undefined
    giveaway.content = ''
    giveaway.active = false
    getWebsocketServer().send('notify_giveaway_update', getGiveaway())
}

export async function updateGiveaway() {
    if(!giveaway.active) return
    giveaway.currentInterval--

    if(giveaway.currentInterval <= 0) {
        giveaway.active = false

        if(giveaway.users.length === 0) {
            logRegular(`giveaway finished without winner`)
            await getTwitchClient().announce(
                `Es haben leider keine Leute teilgenommen am Gewinnspiel!`,
                'orange'
            )
        } else {
            giveaway.winner = giveaway.users[Math.floor(Math.random() * giveaway.users.length)]
            logRegular(`giveaway finished with winner: ${giveaway.winner.name}`)

            await getTwitchClient().announce(
                `@${giveaway.winner.name} herzlichen Glückwunsch, du hast ${giveaway.content} gewonnen!`,
                'green'
            )
        }

        setTimeout(async () => {
            await stopGiveaway()
        }, 300_000)
    }

    getWebsocketServer().send('notify_giveaway_update', getGiveaway())
}

export function getGiveawayWinner() { return giveaway.winner }

export function isGiveawayActive() { return giveaway.content !== '' }

export function getGiveaway() {
    const cloneGiveaway = {...giveaway}

    for(const index in cloneGiveaway.users) {
        const user = cloneGiveaway.users[index]
        cloneGiveaway.users[index] = {
            id: user.id,
            name: user.name,
            displayName: user.displayName,
            profilePictureUrl: user.profilePictureUrl,
        }
    }

    if(cloneGiveaway.winner) {
        cloneGiveaway.winner = {
            id: cloneGiveaway.winner.id,
            name: cloneGiveaway.winner.name,
            displayName: cloneGiveaway.winner.displayName,
            profilePictureUrl: cloneGiveaway.winner.profilePictureUrl,
        }
    }

    return cloneGiveaway
}