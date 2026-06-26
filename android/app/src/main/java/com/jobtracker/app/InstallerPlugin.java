package com.jobtracker.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Downloads a release APK and hands it to the system package installer so the
 * user can update with a single tap — no manual file hunting in a browser.
 * Silent/background install is intentionally not attempted: stock Android only
 * allows that for Play Store / device-owner apps, so a sideloaded build must go
 * through the system installer dialog.
 */
@CapacitorPlugin(name = "Installer")
public class InstallerPlugin extends Plugin {

    @PluginMethod
    public void installApk(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing 'url'");
            return;
        }

        // Android 8+ requires explicit "install unknown apps" permission for this app.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            call.reject("PERMISSION_REQUIRED");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    File apk = download(url);
                    launchInstall(apk);
                    call.resolve();
                } catch (Exception e) {
                    call.reject("DOWNLOAD_FAILED", e);
                }
            }
        }).start();
    }

    private File download(String urlStr) throws Exception {
        File outFile = new File(getContext().getCacheDir(), "update.apk");
        if (outFile.exists()) outFile.delete();

        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(30000);
        conn.connect();

        // Safety net for a cross-protocol redirect that HttpURLConnection won't auto-follow.
        int code = conn.getResponseCode();
        if (code == HttpURLConnection.HTTP_MOVED_PERM || code == HttpURLConnection.HTTP_MOVED_TEMP
                || code == HttpURLConnection.HTTP_SEE_OTHER || code == 307 || code == 308) {
            String loc = conn.getHeaderField("Location");
            conn.disconnect();
            conn = (HttpURLConnection) new URL(loc).openConnection();
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(30000);
            conn.connect();
        }

        int total = conn.getContentLength();
        InputStream in = conn.getInputStream();
        FileOutputStream out = new FileOutputStream(outFile);
        try {
            byte[] buf = new byte[8192];
            int read, lastPct = -1;
            long downloaded = 0;
            while ((read = in.read(buf)) != -1) {
                out.write(buf, 0, read);
                downloaded += read;
                if (total > 0) {
                    int pct = (int) (downloaded * 100L / total);
                    if (pct != lastPct) {
                        lastPct = pct;
                        JSObject ev = new JSObject();
                        ev.put("percent", pct);
                        notifyListeners("downloadProgress", ev);
                    }
                }
            }
            out.flush();
        } finally {
            try { out.close(); } catch (Exception ignored) {}
            try { in.close(); } catch (Exception ignored) {}
            conn.disconnect();
        }
        return outFile;
    }

    private void launchInstall(File apk) {
        Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }
}
