package top.izuna.foliamajor;

import android.content.Context;
import android.util.AttributeSet;
import android.view.KeyEvent;
import com.getcapacitor.CapacitorWebView;

// TvCapacitorWebView.java — observes the remote Back before the system keyboard consumes it.
public class TvCapacitorWebView extends CapacitorWebView {
    public TvCapacitorWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public boolean onKeyPreIme(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
            // In fullscreen/no-limits windows IME insets may not change. Hardware Back still
            // passes through the WebView before the IME, so navigation can resume immediately.
            evaluateJavascript("window.dispatchEvent(new Event('folia-tv-ime-hidden'))", null);
        }
        return super.onKeyPreIme(keyCode, event);
    }
}
