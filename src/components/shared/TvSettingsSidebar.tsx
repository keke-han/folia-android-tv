import React from 'react';
import { useTranslation } from 'react-i18next';
// src/components/shared/TvSettingsSidebar.tsx
// Shared vertical category navigation for nested TV editors.

export default function TvSettingsSidebar<T extends string>({ items, value, onChange }: {
    items: { id: T; label: string }[];
    value: T;
    onChange: (id: T) => void;
}) {
    const { t } = useTranslation();
    return <nav data-tv-sidebar="editor" className="tv-settings-sidebar">
        {items.map(item => <button
            key={item.id}
            type="button"
            aria-current={item.id === value ? 'page' : undefined}
            onClick={() => onChange(item.id)}
            className="rounded-xl border border-white/10 px-4 py-3 text-left"
            style={{ color: 'var(--text-primary)', background: item.id === value ? 'var(--tv-selected-bg)' : undefined }}
        >{item.label}</button>)}
        <p className="pt-3 text-xs leading-relaxed opacity-60" style={{ color: 'var(--text-secondary)' }}>{t('options.tvRemoteHint')}</p>
    </nav>;
}
