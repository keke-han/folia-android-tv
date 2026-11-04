package top.izuna.foliamajor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

// 当前文件：限制外部通知封面的压缩字节、像素和解码采样大小。
final class ArtworkLimits {
    static final int MAX_BYTES = 2 * 1024 * 1024;
    static byte[] read(InputStream input) throws IOException { return read(input, MAX_BYTES); }
    static byte[] read(InputStream input, int maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (out.size() + count > maxBytes) throw new IOException("artwork-byte-limit");
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }
    static int sampleSize(int width, int height) throws IOException {
        if (width <= 0 || height <= 0 || width > 8192 || height > 8192 || (long) width * height > 16_000_000L) {
            throw new IOException("artwork-pixel-limit");
        }
        int sample = 1;
        while ((Math.max(width, height) + sample - 1) / sample > 512) sample *= 2;
        return sample;
    }
}
