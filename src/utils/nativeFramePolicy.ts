// 当前文件：原生安卓远程 frame 不授予脚本能力，避免跨 frame 原生桥调用。
export const nativeFrameSandbox = (browserSandbox: string): string => (
    typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform?.() === 'android'
        ? '' : browserSandbox
);
