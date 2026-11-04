package top.izuna.foliamajor;

import okhttp3.Request;
import okhttp3.HttpUrl;

// 当前文件：重定向逐跳重建 Cookie，禁止把原始来源的显式 Cookie 带到其他 origin。
final class NativeRequestPolicy {
    static Request cookiesForHop(Request initial, Request hop, String storedCookies) {
        HttpUrl first = initial.url(), next = hop.url();
        boolean sameOrigin = first.scheme().equals(next.scheme()) && first.host().equals(next.host()) && first.port() == next.port();
        String cookie = sameOrigin && initial.header("Cookie") != null ? initial.header("Cookie") : storedCookies;
        Request.Builder builder = hop.newBuilder().removeHeader("Cookie");
        if (cookie != null && !cookie.isEmpty()) builder.header("Cookie", cookie);
        return builder.build();
    }
}
