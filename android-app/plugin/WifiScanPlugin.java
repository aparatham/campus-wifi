package edu.tkm.campuswifi;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.concurrent.atomic.AtomicBoolean;

/** Real Wi-Fi RSSI for the web app: scan() returns {networks:[{ssid,bssid,rssi,channel}]}. */
@CapacitorPlugin(
  name = "WifiScan",
  permissions = {
    @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = "location"),
    @Permission(strings = { "android.permission.NEARBY_WIFI_DEVICES" }, alias = "nearby")
  }
)
public class WifiScanPlugin extends Plugin {

  private String[] aliases() {
    return Build.VERSION.SDK_INT >= 33 ? new String[] { "location", "nearby" } : new String[] { "location" };
  }

  private boolean granted() {
    for (String a : aliases()) if (getPermissionState(a) != PermissionState.GRANTED) return false;
    return true;
  }

  private WifiManager wm() {
    return (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
  }

  private int channel(int f) {
    return f == 2484 ? 14 : f >= 5000 ? (f - 5000) / 5 : (f - 2407) / 5;
  }

  @PluginMethod
  public void scan(PluginCall call) {
    if (!granted()) {
      requestPermissionForAliases(aliases(), call, "afterScanPerm");
      return;
    }
    doScan(call);
  }

  @PermissionCallback
  private void afterScanPerm(PluginCall call) {
    if (granted()) doScan(call);
    else call.reject("Wi-Fi permission denied");
  }

  private void doScan(PluginCall call) {
    final AtomicBoolean done = new AtomicBoolean(false);
    final BroadcastReceiver r = new BroadcastReceiver() {
      @Override
      public void onReceive(Context c, Intent i) {
        finish(call, this, done);
      }
    };
    getContext().registerReceiver(r, new IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION));
    // Android throttles scans; after 6 s fall back to the latest cached results.
    new Handler(Looper.getMainLooper()).postDelayed(() -> finish(call, r, done), 6000);
    if (!wm().startScan()) finish(call, r, done);
  }

  @SuppressWarnings({ "MissingPermission", "deprecation" })
  private void finish(PluginCall call, BroadcastReceiver r, AtomicBoolean done) {
    if (!done.compareAndSet(false, true)) return;
    try {
      getContext().unregisterReceiver(r);
    } catch (Exception ignored) {}
    JSArray arr = new JSArray();
    for (ScanResult s : wm().getScanResults()) {
      JSObject o = new JSObject();
      o.put("ssid", s.SSID);
      o.put("bssid", s.BSSID);
      o.put("rssi", s.level);
      o.put("channel", channel(s.frequency));
      arr.put(o);
    }
    JSObject ret = new JSObject();
    ret.put("networks", arr);
    call.resolve(ret);
  }

  @PluginMethod
  public void getConnectedInfo(PluginCall call) {
    if (!granted()) {
      requestPermissionForAliases(aliases(), call, "afterInfoPerm");
      return;
    }
    sendInfo(call);
  }

  @PermissionCallback
  private void afterInfoPerm(PluginCall call) {
    if (granted()) sendInfo(call);
    else call.reject("Wi-Fi permission denied");
  }

  @SuppressWarnings({ "MissingPermission", "deprecation" })
  private void sendInfo(PluginCall call) {
    WifiInfo i = wm().getConnectionInfo();
    JSObject o = new JSObject();
    if (i != null && i.getNetworkId() != -1) {
      o.put("ssid", i.getSSID().replace("\"", ""));
      o.put("bssid", i.getBSSID());
      o.put("rssi", i.getRssi());
      o.put("channel", channel(i.getFrequency()));
    }
    call.resolve(o);
  }
}
