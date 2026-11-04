package top.izuna.foliamajor;

import android.app.Activity;
import android.view.View;
import android.view.ViewTreeObserver;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

// TvKeyboardMonitor.java — IME Back is consumed by Android before the app's Back callback.
final class TvKeyboardMonitor {
    private View decor;
    private ViewTreeObserver.OnGlobalLayoutListener listener;
    private boolean wasVisible;

    /** Observe visibility without replacing the existing cutout/inset listeners. */
    void watch(Activity activity, WebView webView) {
        stop();
        decor = activity.getWindow().getDecorView();
        wasVisible = false;
        listener = () -> {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
            if (insets == null) return;
            boolean visible = insets.isVisible(WindowInsetsCompat.Type.ime());
            if (visible) wasVisible = true;
            else if (wasVisible) {
                stop();
                webView.evaluateJavascript("window.dispatchEvent(new Event('folia-tv-ime-hidden'))", null);
            }
        };
        decor.getViewTreeObserver().addOnGlobalLayoutListener(listener);
    }

    void stop() {
        if (decor != null && listener != null && decor.getViewTreeObserver().isAlive()) {
            decor.getViewTreeObserver().removeOnGlobalLayoutListener(listener);
        }
        decor = null;
        listener = null;
    }
}
