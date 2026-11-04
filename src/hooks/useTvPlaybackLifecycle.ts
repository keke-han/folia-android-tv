import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { isTvMode } from '../services/tvMode';
import { playbackFade } from '../services/playbackFade';
import { saveTvPlaybackPosition } from '../services/tvPlaybackResume';
import { useTypographySettingsStore, SUBTITLE_CONTENT_MODE_STORAGE_KEY, SHOW_SUBTITLE_TRANSLATION_STORAGE_KEY, SHOW_HARMONY_SUBTITLE_STORAGE_KEY } from '../stores/useTypographySettingsStore';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { persistPlaybackCache } from '../components/app/playback/persistPlaybackCache';
import { currentTime } from '../stores/motionSignals';
import { PlayerState } from '../types';
// src/hooks/useTvPlaybackLifecycle.ts
// TV leaves a resumable, paused session whenever its activity goes into the background.

type Params = { pause: () => void; audioRef: RefObject<HTMLAudioElement | null>; shouldAutoPlayRef: MutableRefObject<boolean>; pendingResumeTimeRef: MutableRefObject<number | null> };

export function useTvPlaybackLifecycle(params: Params) {
    const latest = useRef(params);
    latest.current = params;
    useEffect(() => {
        if (!isTvMode()) return;
        // Upgrade TV installs to original lyrics only, while keeping all settings editable afterwards.
        if (localStorage.getItem('folia_tv_original_lyrics_only_v1') !== 'true') {
            useTypographySettingsStore.setState({ hidePlayerTranslationSubtitle: true, showSubtitleTranslation: false, subtitleContentMode: 'none', showHarmonySubtitle: false });
            localStorage.setItem('hide_player_translation_subtitle', 'true');
            localStorage.setItem(SUBTITLE_CONTENT_MODE_STORAGE_KEY, 'none');
            localStorage.setItem(SHOW_SUBTITLE_TRANSLATION_STORAGE_KEY, 'false');
            localStorage.setItem(SHOW_HARMONY_SUBTITLE_STORAGE_KEY, 'false');
            localStorage.setItem('folia_tv_original_lyrics_only_v1', 'true');
        }
        let background = document.visibilityState === 'hidden';
        const save = () => {
            const state = usePlaybackStore.getState();
            void saveTvPlaybackPosition(state.currentSong, latest.current.pendingResumeTimeRef.current ?? latest.current.audioRef.current?.currentTime ?? currentTime.get()).catch(() => {});
            void persistPlaybackCache(state.currentSong, state.playQueue).catch(() => {});
        };
        const stop = () => {
            background = true;
            latest.current.shouldAutoPlayRef.current = false;
            latest.current.pause();
            playbackFade.flush();
            // Pause both decks immediately, even during an unfinished load or automix fade.
            document.querySelectorAll('audio').forEach(audio => audio.pause());
            if (usePlaybackStore.getState().currentSong) usePlaybackStore.getState().setPlayerState(PlayerState.PAUSED);
            save();
        };
        const onActive = (event: Event) => {
            if ((event as CustomEvent<{ active: boolean }>).detail?.active) background = false;
            else stop();
        };
        const onVisibility = () => { if (document.visibilityState === 'hidden') stop(); else background = false; };
        const onPlay = () => { if (background || document.visibilityState === 'hidden') stop(); };
        const onPause = () => save();
        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('play', onPlay, true);
        document.addEventListener('pause', onPause, true);
        window.addEventListener('folia-tv-app-active', onActive);
        window.addEventListener('pagehide', stop);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('play', onPlay, true);
            document.removeEventListener('pause', onPause, true);
            window.removeEventListener('folia-tv-app-active', onActive);
            window.removeEventListener('pagehide', stop);
        };
    }, []);
}
