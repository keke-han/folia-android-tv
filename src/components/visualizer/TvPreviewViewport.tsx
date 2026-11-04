import React, { useLayoutEffect, useRef, useState } from 'react';
// src/components/visualizer/TvPreviewViewport.tsx
// Render a full TV viewport then fit it into the preview, preserving modes that size from window.

export default function TvPreviewViewport({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
    const host = useRef<HTMLDivElement>(null);
    const [frame, setFrame] = useState(() => ({ width: typeof window === 'undefined' ? 1280 : innerWidth, height: typeof window === 'undefined' ? 720 : innerHeight, scale: 1 }));
    useLayoutEffect(() => {
        if (!enabled || !host.current) return;
        const update = () => {
            const box = host.current;
            if (!box) return;
            const width = innerWidth;
            const height = innerHeight;
            const scale = Math.min(box.clientWidth / width, box.clientHeight / height);
            setFrame(previous => previous.width === width && previous.height === height && previous.scale === scale
                ? previous : { width, height, scale });
        };
        const observer = new ResizeObserver(update);
        observer.observe(host.current);
        window.addEventListener('resize', update);
        update();
        return () => { observer.disconnect(); window.removeEventListener('resize', update); };
    }, [enabled]);
    if (!enabled) return <>{children}</>;
    return <div ref={host} className="absolute inset-0 overflow-hidden">
        <div data-tv-preview-stage="true" className="absolute overflow-hidden" style={{
            width: frame.width, height: frame.height, left: '50%', top: '50%',
            transform: `translate(-50%, -50%) scale(${frame.scale})`, transformOrigin: 'center',
        }}>{children}</div>
    </div>;
}
