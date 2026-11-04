import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

// 当前文件：在专用安卓测试设备上验证本地音频会话授权、Range 和 HEAD，使用自建静音音频。
const adbPath = process.env.ADB_PATH || 'adb';
const serial = process.env.ANDROID_SERIAL;
if (!serial) throw new Error('Set ANDROID_SERIAL to a dedicated test emulator/device');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
const pkg = 'top.izuna.foliamajor.tv';
const debugPort = Number(process.env.FOLIA_TEST_CDP_PORT || 9223);
const audioPort = Number(process.env.FOLIA_TEST_AUDIO_PORT || 9234);
const fixtureName = 'imported-folia-security-test.wav';
const temp = mkdtempSync(path.join(tmpdir(), 'folia-audio-security-'));
const remoteTemp = '/data/local/tmp/folia-audio-security-test.wav';
let forwardedDebug = false, forwardedAudio = false;

/** 只经调试桥在第一方 WebView 中获取本次会话 URL，不打印或写出令牌。 */
async function evaluate(expression) {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const target = targets.find(item => item.type === 'page');
    if (!target) throw new Error('No first-party WebView target');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const result = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Native bridge timeout')), 15000);
        ws.onmessage = event => {
            const data = JSON.parse(event.data);
            if (data.id !== 1) return;
            clearTimeout(timer);
            if (data.error || data.result?.exceptionDetails) reject(new Error('Native bridge evaluation failed'));
            else resolve(data.result.result.value);
        };
    });
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    try { return await result; } finally { ws.close(); }
}

try {
    if (process.argv[2]) adb('install', '-r', path.resolve(process.argv[2]));
    adb('shell', 'am', 'start', '-n', `${pkg}/top.izuna.foliamajor.MainActivity`);
    let base;
    for (let attempt = 0; attempt < 60; attempt++) {
        try {
            const pid = adb('shell', 'pidof', pkg);
            adb('forward', `tcp:${debugPort}`, `localabstract:webview_devtools_remote_${pid}`);
            forwardedDebug = true;
            const response = await evaluate('window.Capacitor.Plugins.FoliaNative.localAudioServerPort()');
            if (response?.baseUrl) { base = new URL(response.baseUrl); break; }
        } catch { /* Wait for the freshly installed WebView to initialize. */ }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(base, 'Native audio service did not initialize');
    const wav = Buffer.alloc(76);
    wav.write('RIFF'); wav.writeUInt32LE(68, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(32, 40);
    const localFixture = path.join(temp, fixtureName);
    writeFileSync(localFixture, wav);
    adb('push', localFixture, remoteTemp);
    adb('shell', 'run-as', pkg, 'mkdir', '-p', 'files/imported-audio');
    adb('shell', 'run-as', pkg, 'cp', remoteTemp, `files/imported-audio/${fixtureName}`);
    adb('forward', `tcp:${audioPort}`, `tcp:${base.port}`); forwardedAudio = true;
    const origin = `http://127.0.0.1:${audioPort}`;
    const validPath = `${base.pathname}/audio/${fixtureName}`;
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        for (const route of [`/audio/${fixtureName}`, `/audio/1`, `/audio/file-invalid`, `/remote-audio/unknown`, `/wrong-session/audio/${fixtureName}`]) {
            const response = await fetch(origin + route, { method });
            assert.equal(response.status, 403, `${method} unauthenticated route must be rejected`);
            await response.arrayBuffer();
        }
    }
    const get = await fetch(origin + validPath);
    assert.equal(get.status, 200); assert.deepEqual(Buffer.from(await get.arrayBuffer()), wav);
    const head = await fetch(origin + validPath, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), String(wav.length));
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    const range = await fetch(origin + validPath, { headers: { Range: 'bytes=0-3' } });
    assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), `bytes 0-3/${wav.length}`);
    assert.equal(Buffer.from(await range.arrayBuffer()).toString(), 'RIFF');
    const options = await fetch(origin + validPath, { method: 'OPTIONS' });
    assert.equal(options.status, 204);
    const traversal = await fetch(origin + `${base.pathname}/audio/${encodeURIComponent('imported-../private.wav')}`);
    assert.equal(traversal.status, 404);
    console.log('PASS: 15 unauthorized GET/HEAD/OPTIONS routes rejected; authorized GET/HEAD/Range/OPTIONS and traversal checks passed.');
} finally {
    try { adb('shell', 'run-as', pkg, 'rm', '-f', `files/imported-audio/${fixtureName}`); } catch {}
    try { adb('shell', 'rm', '-f', remoteTemp); } catch {}
    if (forwardedAudio) try { adb('forward', '--remove', `tcp:${audioPort}`); } catch {}
    if (forwardedDebug) try { adb('forward', '--remove', `tcp:${debugPort}`); } catch {}
    rmSync(temp, { recursive: true, force: true });
}
