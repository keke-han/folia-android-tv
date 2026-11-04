package top.izuna.foliamajor;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

// 当前文件：本地音频服务的会话能力令牌与规范化路径边界。
final class LocalAudioAccess {
    private final String token = newToken();

    static String newToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        StringBuilder value = new StringBuilder(64);
        for (byte b : bytes) value.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
        return value.toString();
    }

    String basePath() { return "/" + token; }

    /** 验证完整路径段后才返回业务路由，所有 HTTP 方法共用同一边界。 */
    String authorizedRoute(String requestPath) {
        int end = requestPath.indexOf('/', 1);
        if (!requestPath.startsWith("/") || end != 65) return null;
        byte[] supplied = requestPath.substring(1, end).getBytes(StandardCharsets.US_ASCII);
        if (!MessageDigest.isEqual(token.getBytes(StandardCharsets.US_ASCII), supplied)) return null;
        return requestPath.substring(end);
    }

    static File confinedFile(File root, String path) throws IOException {
        if (root == null) return null;
        File canonicalRoot = root.getCanonicalFile();
        File target = new File(path).getCanonicalFile();
        return target.getPath().startsWith(canonicalRoot.getPath() + File.separator) ? target : null;
    }
}
