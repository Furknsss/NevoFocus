package com.furknsss.nevofocus;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@CapacitorPlugin(name = "NativeOAuthDiagnostics")
public class NativeOAuthDiagnosticsPlugin extends Plugin {
    @PluginMethod
    public void getSigningIdentity(PluginCall call) {
        try {
            PackageManager manager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();
            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = manager.getPackageInfo(packageName,
                        PackageManager.GET_SIGNING_CERTIFICATES);
                signatures = info.signingInfo == null ? null :
                        (info.signingInfo.hasMultipleSigners()
                                ? info.signingInfo.getApkContentsSigners()
                                : info.signingInfo.getSigningCertificateHistory());
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo info = manager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
                signatures = info.signatures;
            }
            if (signatures == null || signatures.length == 0) {
                call.reject("No Android signing certificate available");
                return;
            }

            byte[] cert = signatures[0].toByteArray();
            JSObject data = new JSObject();
            data.put("packageName", packageName);
            data.put("sha1", fingerprint("SHA-1", cert));
            data.put("sha256", fingerprint("SHA-256", cert));
            data.put("androidSdk", Build.VERSION.SDK_INT);
            call.resolve(data);
        } catch (Exception error) {
            call.reject("Could not read installed APK signing certificate", error);
        }
    }

    private String fingerprint(String algorithm, byte[] bytes) throws NoSuchAlgorithmException {
        byte[] digest = MessageDigest.getInstance(algorithm).digest(bytes);
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) {
            if (hex.length() > 0) hex.append(':');
            hex.append(String.format(java.util.Locale.US, "%02X", b & 0xFF));
        }
        return hex.toString();
    }
}
