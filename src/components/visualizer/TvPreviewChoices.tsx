import React from 'react';
import { useTranslation } from 'react-i18next';
// src/components/visualizer/TvPreviewChoices.tsx
// Local screenshots of the real renderers keep every TV choice visible without running many canvases.

export default function TvPreviewChoices<T extends string>({ kind, options, value, onChange, label }: {
    kind: 'animation' | 'background';
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    label: string;
}) {
    const { t } = useTranslation();
    return <div className="space-y-3">
        <div className="text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>{label}</div>
        <div data-tv-focus-group={kind} className="tv-preview-choices">
            {options.map((option, index) => <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={option.value === value}
                data-tv-entry={index === 0 ? 'true' : undefined}
                data-tv-choice={option.value}
                onClick={() => onChange(option.value)}
                className="overflow-hidden rounded-xl border text-left"
                style={{ color: 'var(--text-primary)', borderColor: option.value === value ? 'currentColor' : 'var(--text-secondary)', background: 'var(--tv-selected-bg)' }}
            >
                <img
                    src={`/tv-previews/${kind}-${option.value}.png`}
                    alt={`${option.label} ${t('ui.livePreview')}`}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                />
                <span className="block px-3 py-2 text-sm font-medium">{option.label}</span>
            </button>)}
        </div>
    </div>;
}
