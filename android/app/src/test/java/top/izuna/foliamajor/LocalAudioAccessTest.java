package top.izuna.foliamajor;

import org.junit.Test;
import java.io.File;
import static org.junit.Assert.*;

// 当前文件：验证音频会话隔离与目录穿越防护。
public class LocalAudioAccessTest {
    @Test public void requiresExactSessionForAllRoutes() {
        LocalAudioAccess first = new LocalAudioAccess();
        LocalAudioAccess other = new LocalAudioAccess();
        assertEquals("/audio/42", first.authorizedRoute(first.basePath() + "/audio/42"));
        assertEquals("/remote-audio/item", first.authorizedRoute(first.basePath() + "/remote-audio/item"));
        assertNull(first.authorizedRoute("/audio/42"));
        assertNull(first.authorizedRoute(other.basePath() + "/audio/42"));
        assertNull(first.authorizedRoute(first.basePath() + "x/audio/42"));
        assertNull(first.authorizedRoute("http://localhost" + first.basePath() + "/audio/42"));
    }

    @Test public void canonicalPathCannotEscapeRoot() throws Exception {
        File root = new File(System.getProperty("java.io.tmpdir"), "folia-audio-root");
        assertNotNull(LocalAudioAccess.confinedFile(root, new File(root, "song.mp3").getPath()));
        assertNull(LocalAudioAccess.confinedFile(root, new File(root, "../private/song.mp3").getPath()));
        assertNull(LocalAudioAccess.confinedFile(root, root.getPath()));
        assertNull(LocalAudioAccess.confinedFile(root, root.getPath() + "-other/song.mp3"));
    }
}
