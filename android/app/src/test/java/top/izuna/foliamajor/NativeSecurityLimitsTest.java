package top.izuna.foliamajor;

import org.junit.Test;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import okhttp3.Request;
import static org.junit.Assert.*;

// 当前文件：验证封面分配边界与重定向 Cookie 来源隔离。
public class NativeSecurityLimitsTest {
    @Test public void artworkDimensionsAndBytesAreBounded() throws Exception {
        assertEquals(1, ArtworkLimits.sampleSize(512, 512));
        assertEquals(8, ArtworkLimits.sampleSize(4000, 3000));
        assertEquals(4, ArtworkLimits.sampleSize(1025, 512));
        assertArrayEquals(new byte[]{1,2}, ArtworkLimits.read(new ByteArrayInputStream(new byte[]{1,2})));
        for (int[] size : new int[][]{{0,1},{100000,1},{8192,8192},{Integer.MAX_VALUE,Integer.MAX_VALUE}}) {
            try { ArtworkLimits.sampleSize(size[0],size[1]); fail("oversized dimensions accepted"); } catch (IOException expected) {}
        }
        try { ArtworkLimits.read(new ByteArrayInputStream(new byte[ArtworkLimits.MAX_BYTES+1])); fail("oversized body accepted"); } catch (IOException expected) {}
    }
    @Test public void cookiesAreRebuiltForEveryRedirectOrigin() {
        Request initial = new Request.Builder().url("https://first.test/").header("Cookie","source=private").build();
        Request other = initial.newBuilder().url("https://other.test/").build();
        Request automatic = new Request.Builder().url("https://first.test/").build();
        assertEquals("session=new", NativeRequestPolicy.cookiesForHop(automatic, automatic, "session=new").header("Cookie"));
        assertNull(NativeRequestPolicy.cookiesForHop(initial, other, null).header("Cookie"));
        assertEquals("destination=own",NativeRequestPolicy.cookiesForHop(initial,other,"destination=own").header("Cookie"));
        assertEquals("source=private",NativeRequestPolicy.cookiesForHop(initial,initial,"stored=other").header("Cookie"));
        assertNull(NativeRequestPolicy.cookiesForHop(initial,initial.newBuilder().url("http://first.test/").build(),null).header("Cookie"));
        assertNull(NativeRequestPolicy.cookiesForHop(initial,initial.newBuilder().url("https://first.test:8443/").build(),null).header("Cookie"));
    }
}
