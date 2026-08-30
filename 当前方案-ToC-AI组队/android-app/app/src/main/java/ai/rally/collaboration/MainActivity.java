package ai.rally.collaboration;

import android.Manifest;
import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebBackForwardList;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;

public final class MainActivity extends Activity {
    private static final int LOCATION_PERMISSION_REQUEST = 7001;
    private static final int APP_BACKGROUND_COLOR = Color.rgb(247, 248, 250);
    private static final String ASSET_HOST = BuildConfig.RALLY_ASSET_HOST;
    private static final String APP_LINK_HOST = BuildConfig.RALLY_APP_HOST;
    private static final String HOME_URL =
            "https://" + ASSET_HOST + "/index.html?variant=A&source=android-app"
                    + (BuildConfig.RALLY_DEMO_MODE ? "&workspace=1" : "");

    private WebView webView;
    private Object predictiveBackCallback;
    private GeolocationPermissions.Callback pendingGeolocationCallback;
    private String pendingGeolocationOrigin;
    private boolean clearHistoryAfterReturningHome;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(APP_BACKGROUND_COLOR);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebChromeClient(new RallyWebChromeClient());
        webView.setWebViewClient(new RallyWebViewClient());
        setContentView(createContentView());
        configureSystemBars();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            predictiveBackCallback = Api33BackHandler.register(this, this::handleBackNavigation);
        }

        String oauthReturnUrl = oauthAppLinkUrl(getIntent());
        if (savedInstanceState == null) {
            webView.loadUrl(oauthReturnUrl != null ? oauthReturnUrl : HOME_URL);
        } else {
            WebBackForwardList restoredState = webView.restoreState(savedInstanceState);
            String restoredUrl = restoredState == null || restoredState.getCurrentItem() == null
                    ? null
                    : restoredState.getCurrentItem().getUrl();
            if (oauthReturnUrl != null) {
                webView.loadUrl(oauthReturnUrl);
            } else if (restoredState == null || isTemporaryAgentDemoUrl(restoredUrl)) {
                clearHistoryAfterReturningHome = restoredState != null;
                webView.loadUrl(HOME_URL);
            }
        }
    }

    private static boolean isTemporaryAgentDemoUrl(String url) {
        if (url == null) return false;
        try {
            return "agent".equals(Uri.parse(url).getQueryParameter("demoFlow"));
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String oauthReturnUrl = oauthAppLinkUrl(intent);
        if (oauthReturnUrl != null) webView.loadUrl(oauthReturnUrl);
    }

    private String oauthAppLinkUrl(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null
                || !"https".equals(uri.getScheme())
                || !APP_LINK_HOST.equals(uri.getHost())
                || uri.getPort() != -1
                || uri.getUserInfo() != null
                || !"/auth/android".equals(uri.getPath())
                || uri.getFragment() != null) {
            return null;
        }

        String ticket = uri.getQueryParameter("oauth_ticket");
        String provider = uri.getQueryParameter("oauth_provider");
        String error = uri.getQueryParameter("oauth_error");
        if (provider != null && !"google".equals(provider) && !"wechat".equals(provider)) {
            return null;
        }
        if (ticket != null && !ticket.matches("[A-Za-z0-9_-]{40,128}")) return null;
        if (error != null && !error.matches("[a-z_]{1,64}")) return null;
        if (ticket == null && error == null) return null;

        Uri.Builder destination = Uri.parse(HOME_URL).buildUpon();
        if (ticket != null) destination.appendQueryParameter("oauth_ticket", ticket);
        if (provider != null) destination.appendQueryParameter("oauth_provider", provider);
        if (error != null) destination.appendQueryParameter("oauth_error", error);
        return destination.build().toString();
    }

    private void configureSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().setNavigationBarDividerColor(Color.TRANSPARENT);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        applySystemBarVisibility();
    }

    private void applySystemBarVisibility() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.setSystemBarsAppearance(
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        } else {
            getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN);
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applySystemBarVisibility();
    }

    private View createContentView() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(APP_BACKGROUND_COLOR);
        root.addView(
                webView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));

        return root;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    @SuppressLint("GestureBackNavigation")
    public void onBackPressed() {
        handleBackNavigation();
    }

    private void handleBackNavigation() {
        webView.evaluateJavascript(
                "Boolean(window.RallyApp && window.RallyApp.handleBack())",
                handled -> {
                    if ("true".equals(handled)) return;
                    if (webView.canGoBack()) webView.goBack();
                    else finishAfterTransition();
                });
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != LOCATION_PERMISSION_REQUEST || pendingGeolocationCallback == null) {
            return;
        }
        boolean granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED;
        pendingGeolocationCallback.invoke(pendingGeolocationOrigin, granted, false);
        pendingGeolocationCallback = null;
        pendingGeolocationOrigin = null;
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && predictiveBackCallback != null) {
            Api33BackHandler.unregister(this, predictiveBackCallback);
            predictiveBackCallback = null;
        }
        if (pendingGeolocationCallback != null) {
            pendingGeolocationCallback.invoke(pendingGeolocationOrigin, false, false);
            pendingGeolocationCallback = null;
            pendingGeolocationOrigin = null;
        }
        webView.stopLoading();
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }

    private final class RallyWebChromeClient extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(
                String origin,
                GeolocationPermissions.Callback callback) {
            if (!("https://" + ASSET_HOST).equals(origin)) {
                callback.invoke(origin, false, false);
                return;
            }
            boolean alreadyGranted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                            == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                            == PackageManager.PERMISSION_GRANTED;
            if (alreadyGranted) {
                callback.invoke(origin, true, false);
                return;
            }
            if (pendingGeolocationCallback != null) {
                pendingGeolocationCallback.invoke(pendingGeolocationOrigin, false, false);
            }
            pendingGeolocationCallback = callback;
            pendingGeolocationOrigin = origin;
            requestPermissions(
                    new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    },
                    LOCATION_PERMISSION_REQUEST);
        }
    }

    @TargetApi(Build.VERSION_CODES.TIRAMISU)
    private static final class Api33BackHandler {
        private Api33BackHandler() {}

        static Object register(Activity activity, Runnable action) {
            OnBackInvokedCallback callback = action::run;
            activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    callback);
            return callback;
        }

        static void unregister(Activity activity, Object callback) {
            activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(
                    (OnBackInvokedCallback) callback);
        }
    }

    private final class RallyWebViewClient extends WebViewClient {
        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (clearHistoryAfterReturningHome && !isTemporaryAgentDemoUrl(url)) {
                view.clearHistory();
                clearHistoryAfterReturningHome = false;
            }
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(
                WebView view,
                WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) && ASSET_HOST.equals(uri.getHost())) {
                return loadPackagedAsset(uri);
            }
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return openExternalUrlIfNeeded(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return openExternalUrlIfNeeded(Uri.parse(url));
        }

        private boolean openExternalUrlIfNeeded(Uri uri) {
            if ("https".equals(uri.getScheme()) && ASSET_HOST.equals(uri.getHost())) {
                return false;
            }
            if ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
            return false;
        }

        private WebResourceResponse loadPackagedAsset(Uri uri) {
            String path = uri.getPath();
            if (path == null || "/".equals(path)) path = "/index.html";
            if (path.contains("..")) return emptyResponse();
            try {
                return new WebResourceResponse(
                        mimeTypeFor(path),
                        "UTF-8",
                        getAssets().open("www" + path));
            } catch (IOException ignored) {
                return emptyResponse();
            }
        }

        private WebResourceResponse emptyResponse() {
            return new WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    new ByteArrayInputStream(new byte[0]));
        }

        private String mimeTypeFor(String path) {
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".js")) return "application/javascript";
            if (path.endsWith(".webmanifest")) return "application/manifest+json";
            if (path.endsWith(".json")) return "application/json";
            if (path.endsWith(".svg")) return "image/svg+xml";
            if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
            if (path.endsWith(".png")) return "image/png";
            return "application/octet-stream";
        }
    }
}
