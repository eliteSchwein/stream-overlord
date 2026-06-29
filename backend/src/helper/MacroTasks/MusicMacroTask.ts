import BaseMacroTask from "../../abstracts/BaseMacroTask";
import fillTemplate from "../TemplateHelper";
import {
    addSongRequest,
    back as musicBack,
    next as musicNext,
    pause as musicPause,
    play as musicPlay,
    playSong as musicPlaySong,
    reloadMusicPlayer,
    setMusicLoop,
    setMusicLoopFile,
    setMusicShuffle,
    setRelativeVolume as musicSetRelativeVolume,
    setVolume as musicSetVolume,
    stopMusicPlayback,
    toggleMusicLoop,
    toggleMusicLoopFile,
    toggleMusicShuffle,
    togglePause,
    toggleSongRequest,
} from "../MusicHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class MusicMacroTask extends BaseMacroTask {
    channel = "music"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger music: ${method}`);

        switch (method) {
            case "play": {
                await musicPlay();
                break;
            }

            case "pause": {
                await musicPause();
                break;
            }

            case "toggle_pause":
            case "toggle": {
                await togglePause();
                break;
            }

            case "next": {
                await musicNext();
                break;
            }

            case "back":
            case "previous":
            case "prev": {
                await musicBack();
                break;
            }

            case "stop": {
                await stopMusicPlayback();
                break;
            }

            case "reload": {
                await reloadMusicPlayer(data.restore_state === true || data.restoreState === true);
                break;
            }

            case "volume": {
                const volume = Number(data.volume ?? data.value);

                if (!Number.isFinite(volume)) {
                    logWarn(`music volume requires volume`);
                    break;
                }

                await musicSetVolume(volume);
                break;
            }

            case "volume_relative":
            case "relative_volume": {
                const volume = Number(data.volume ?? data.value ?? data.delta);

                if (!Number.isFinite(volume)) {
                    logWarn(`music volume_relative requires volume`);
                    break;
                }

                await musicSetRelativeVolume(volume);
                break;
            }

            case "play_song":
            case "song": {
                await musicPlaySong(data);
                break;
            }

            case "shuffle": {
                if (data.enabled === undefined && data.state === undefined) {
                    await toggleMusicShuffle();
                } else {
                    await setMusicShuffle(data.enabled ?? data.state);
                }
                break;
            }

            case "loop":
            case "loop_playlist": {
                if (data.enabled === undefined && data.state === undefined) {
                    await toggleMusicLoop();
                } else {
                    await setMusicLoop(data.enabled ?? data.state);
                }
                break;
            }

            case "loop_file": {
                if (data.enabled === undefined && data.state === undefined) {
                    await toggleMusicLoopFile();
                } else {
                    await setMusicLoopFile(data.enabled ?? data.state);
                }
                break;
            }

            case "song_request": {
                if (!data.url) {
                    logWarn(`music song_request requires url`);
                    break;
                }

                const added = await addSongRequest(fillTemplate(data.url, data));

                if (!added) {
                    logWarn(`music song_request failed`);
                }

                break;
            }

            case "song_request_toggle":
            case "toggle_song_request": {
                await toggleSongRequest();
                break;
            }

            default: {
                logWarn(`invalid music method: ${method}`);
                break;
            }
        }
    }
}
