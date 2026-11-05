import React, { useRef, useState } from 'react';
import type { VisualizerBackgroundSettingsProps } from '../definition';
import { SOFT_COVER_BLUR_SCALE } from '../../../../types/softCover';
import { useSoftCoverSettingsStore } from '../../../../stores/useSoftCoverSettingsStore';

// src/components/visualizer/backgrounds/soft-cover/SoftCoverSettings.tsx
// Small TV-friendly controls reuse the existing custom-image upload and asset storage.
export default function SoftCoverSettings({ config, actions, t, theme, controlCardBg, rangeInputClass,
    onSliderPointerDown, onSliderCommit }: VisualizerBackgroundSettingsProps) {
    const { tuning, update } = useSoftCoverSettingsStore();
    const input = useRef<HTMLInputElement>(null);
    const [feedback, setFeedback] = useState('');
    return <div className="space-y-5 rounded-2xl p-5" style={{ background: controlCardBg, color: theme.primaryColor }}>
        <div className="font-medium">{t('options.visualizerBackgroundModeSoftCover')}</div>
        <p className="text-sm opacity-70">{t('options.softCoverDescription')}</p>
        <div className="flex flex-wrap gap-3">
            {(['cover', 'custom'] as const).map(source => <button key={source} type="button" aria-pressed={tuning.source === source}
                onClick={() => update({ source })} className="rounded-xl border px-4 py-3"
                style={{ background: tuning.source === source ? theme.accentColor : 'transparent', color: tuning.source === source ? theme.backgroundColor : theme.primaryColor }}>
                {t(source === 'cover' ? 'options.monetBackgroundSourceCover' : 'options.monetBackgroundSourceUploaded')}
            </button>)}
            <button type="button" className="rounded-xl border px-4 py-3" disabled={!actions?.customImage?.onUpload || actions.customImage.isLoading}
                onClick={() => input.current?.click()}>{t('options.monetUploadBackground')}</button>
            <button type="button" className="rounded-xl border px-4 py-3" disabled={!config?.customImage || !actions?.customImage?.onClear}
                onClick={() => void actions?.customImage?.onClear?.()}>{t('options.monetClearBackground')}</button>
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={async event => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            if (!files.length) return;
            try {
                const result = await actions?.customImage?.onUpload?.(files);
                if (result?.ok) { update({ source: 'custom' }); setFeedback(''); }
                else setFeedback(result?.error || t('options.monetUploadBackground'));
            } catch { setFeedback(t('options.monetUploadBackground')); }
        }} />
        <p className="text-sm opacity-70" role="status">{feedback || config?.customImage?.name || t('options.softCoverImageFallback')}</p>
        {(['blur', 'dim'] as const).map(key => <label key={key} className="block space-y-2">
            <span>{t(key === 'blur' ? 'options.monetBackgroundBlur' : 'options.softCoverDimming')} · {key === 'blur' ? `${(tuning.blur * SOFT_COVER_BLUR_SCALE).toFixed(1)}px` : `${Math.round(tuning.dim * 100)}%`}</span>
            <input type="range" aria-label={t(key === 'blur' ? 'options.monetBackgroundBlur' : 'options.softCoverDimming')}
                className={`block w-full ${rangeInputClass}`} min={0} max={key === 'blur' ? 12 : 0.8} step={key === 'blur' ? 1 : 0.01}
                value={tuning[key]} onChange={event => update({ [key]: Number(event.target.value) })}
                onPointerDown={onSliderPointerDown} onPointerUp={onSliderCommit} onKeyUp={onSliderCommit} />
        </label>)}
    </div>;
}
