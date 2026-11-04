import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import ProgressBar from '../../ProgressBar';
import { currentTime } from '../../../stores/motionSignals';
import { usePlaybackStore, selectDisplayDuration, selectDisplaySong, selectDisplayPlayerState } from '../../../stores/usePlaybackStore';
import { useAppChromeStore } from '../../../stores/useAppChromeStore';
import { useAppViewStore } from '../../../stores/useAppViewStore';
import { useSettingsModalStore } from '../../../stores/useSettingsModalStore';
import { useSearchNavigationStore } from '../../../stores/useSearchNavigationStore';
import { isTvMode } from '../../../services/tvMode';
import { PlayerState } from '../../../types';
// src/components/app/overlays/TvPlaybackTransport.tsx
// TV transport reuses the active playback session; returning never selects or reloads a track.

type Props = { onReturn: () => void; onToggle: () => void; canToggle: boolean; onPrevious: () => void; onNext: () => void; onSeek: (time: number) => void; showProgress: boolean };

export default function TvPlaybackTransport({ onReturn, onToggle, canToggle, onPrevious, onNext, onSeek, showProgress }: Props) {
    const { t } = useTranslation();
    const song = usePlaybackStore(selectDisplaySong);
    const duration = usePlaybackStore(selectDisplayDuration);
    const state = usePlaybackStore(selectDisplayPlayerState);
    const canStep = usePlaybackStore(s => s.activePlaybackContext === 'main' && s.playQueue.length > 0);
    const chromeHidden = useAppChromeStore(s => s.isPlayerChromeHidden);
    const view = useAppViewStore(s => s.view);
    const panelOpen = useAppViewStore(s => s.isPanelOpen);
    const settingsOpen = useSettingsModalStore(s => s.settingsModalState.isOpen);
    const searchOpen = useSearchNavigationStore(s => s.isSearchOpen);
    const player = view === 'player' && !panelOpen && !settingsOpen && !searchOpen;
    useEffect(() => {
        if (!isTvMode() || !player) return;
        const frame = requestAnimationFrame(() => {
            window.dispatchEvent(new Event('folia-tv-reveal-controls'));
            document.querySelector<HTMLElement>('[data-tv-player-surface]')?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [player]);
    if (!isTvMode() || !song) return null;
    const playing = state === PlayerState.PLAYING;
    const returnToPlayback = () => {
        useSettingsModalStore.getState().closeSettings();
        useSearchNavigationStore.getState().hideSearchOverlay();
        useAppViewStore.getState().setIsPanelOpen(false);
        onReturn();
    };
    return (
        <div className={`tv-transport${player ? ' tv-transport-player' : ''}`} data-tv-transport data-tv-hidden={player && chromeHidden ? 'true' : undefined}
            aria-hidden={player && chromeHidden ? true : undefined} inert={player && chromeHidden ? true : undefined}>
            <div className="tv-transport-actions">
            {!player && <button className="tv-transport-return" data-tv-now-playing onClick={returnToPlayback}>
                {t('tvPlayback.nowPlaying')} · {song.name} · {t('tvPlayback.returnToPlayer')}
                <small className="block text-xs opacity-70">{t('tvPlayback.holdDown')}</small>
            </button>}
            {player && <button data-tv-previous disabled={!canStep} onClick={onPrevious} aria-label={t('tvPlayback.previous')}>
                <SkipBack size={18} className="inline mr-2" />{t('tvPlayback.previous')} · ←
            </button>}
            <button data-tv-toggle-play disabled={!canToggle} onClick={onToggle} aria-label={t(playing ? 'tvPlayback.pause' : 'tvPlayback.resume')}>
                {playing ? <Pause size={18} className="inline mr-2" /> : <Play size={18} className="inline mr-2" />}
                {t(playing ? 'tvPlayback.pause' : 'tvPlayback.resume')}{player ? ` · ${t('tvPlayback.confirm')}` : ''}
            </button>
            {player && <button data-tv-next disabled={!canStep} onClick={onNext} aria-label={t('tvPlayback.next')}>
                <SkipForward size={18} className="inline mr-2" />{t('tvPlayback.next')} · →
            </button>}
            </div>
            {player && showProgress && <div className="tv-transport-progress" data-tv-progress data-tv-floating-controls
                data-folia-player-bar-progress aria-hidden={chromeHidden ? true : undefined}>
                <ProgressBar currentTime={currentTime} duration={duration} onSeek={onSeek} disabled={!canToggle}
                    primaryColor="#fff" secondaryColor="#ffffffb3" trackColor="#ffffff33" collapsed />
            </div>}
        </div>
    );
}
