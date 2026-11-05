import React from 'react';
import { defineVisualizerBackground } from '../definition';
import SoftCoverBackground from './SoftCoverBackground';
import SoftCoverSettings from './SoftCoverSettings';
import { useSoftCoverSettingsStore } from '../../../../stores/useSoftCoverSettingsStore';

// src/components/visualizer/backgrounds/soft-cover/entry.tsx
// Registers the complete-cover, softly feathered TV background.
export default defineVisualizerBackground({
    mode: 'soft-cover', order: 25,
    labelKey: 'options.visualizerBackgroundModeSoftCover', labelFallback: 'Soft Cover',
    render: props => <SoftCoverBackground {...props} />,
    renderSettingsPanel: props => <SoftCoverSettings {...props} />,
    resetSettings: () => useSoftCoverSettingsStore.getState().reset(),
});
