import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { VisualizerBackgroundRenderProps } from '../definition';
import { useSoftCoverSettingsStore } from '../../../../stores/useSoftCoverSettingsStore';
import { normalizeSoftCoverTuning, SOFT_COVER_BLUR_SCALE } from '../../../../types/softCover';
import { colorWithAlpha } from '../../colorMix';
import { useReducedMotionFor } from '../../../../hooks/useReducedMotionFor';

// src/components/visualizer/backgrounds/soft-cover/SoftCoverBackground.tsx
// The foreground always contains the entire artwork; only its ambient copy is heavily blurred.
export default function SoftCoverBackground({ config, coverUrl, theme }: VisualizerBackgroundRenderProps) {
    const saved = useSoftCoverSettingsStore(state => state.tuning);
    const tuning = normalizeSoftCoverTuning(config?.softCover?.tuning ?? saved);
    const source = tuning.source === 'custom' ? config?.customImage?.url ?? coverUrl : coverUrl ?? config?.customImage?.url;
    const reduced = useReducedMotionFor('monetBackground');
    // Static mode disables continuous motion; artwork changes can still crossfade.
    const fade = reduced ? 0 : 0.8;
    return <div data-background-mode="soft-cover" className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${theme.backgroundColor}, ${colorWithAlpha(theme.accentColor, 0.4)})` }}>
        <AnimatePresence initial={false}>
            {source && <motion.div key={source} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0 }} transition={{ duration: fade }}>
                <img src={source} alt="" aria-hidden draggable={false} className="absolute inset-0 w-full h-full object-contain"
                    style={{ filter: 'blur(12px)', opacity: 0.6 }} />
                <div className="absolute inset-[4%] flex items-center justify-center">
                    <img data-complete-cover src={source} alt="" aria-hidden draggable={false}
                        className="max-w-full max-h-full" style={{ objectFit: 'contain', filter: `blur(${tuning.blur * SOFT_COVER_BLUR_SCALE}px)`,
                            maskImage: 'linear-gradient(90deg, transparent, black 5%, black 95%, transparent), linear-gradient(transparent, black 5%, black 95%, transparent)',
                            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 5%, black 95%, transparent), linear-gradient(transparent, black 5%, black 95%, transparent)',
                            maskComposite: 'intersect', WebkitMaskComposite: 'source-in',
                        }} />
                </div>
            </motion.div>}
        </AnimatePresence>
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${tuning.dim})` }} />
    </div>;
}
