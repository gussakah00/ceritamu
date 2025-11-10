class PushManager {
  constructor() {
    this.isSubscribed = false;
    this.registration = null;
    this.subscription = null;
    this.VAPID_PUBLIC_KEY =
      "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";
    this._isInitialized = false;
  }

  async init() {
    console.log("PushManager: Initializing...");

    // ✅ CEK SUPPORT DASAR DULU
    if (!this._isSupported()) {
      console.log("PushManager: Not supported");
      this._isInitialized = true;
      return false;
    }

    // ✅ UNTUK SEMENTARA, NON-AKTIFKAN PUSH MANAGER DI SEMUA ENVIRONMENT
    console.log("PushManager: Temporarily disabled for stability");
    this._isInitialized = true;

    // ✅ FALLBACK KE LOCALSTORAGE MODE
    const stored = localStorage.getItem("pushSubscription");
    this.isSubscribed = !!stored;

    console.log(
      "PushManager: Initialized in fallback mode, subscribed:",
      this.isSubscribed
    );
    return true;
  }

  _isSupported() {
    // ✅ CEK DASAR SAJA, TANPA SERVICE WORKER
    const isSupported = "Notification" in window;
    console.log("PushManager: Basic support:", isSupported);
    return isSupported;
  }

  async subscribe() {
    if (!this._isInitialized) {
      await this.init();
    }

    try {
      console.log("PushManager: Requesting notification permission...");
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Izin notifikasi ditolak");
      }

      // ✅ SELALU PAKAI DEVELOPMENT MODE UNTUK SEMENTARA
      console.log("PushManager: Using localStorage mode");
      localStorage.setItem(
        "pushSubscription",
        JSON.stringify({
          endpoint: "local-storage-mode",
          keys: { p256dh: "local", auth: "local" },
        })
      );
      this.isSubscribed = true;

      this._showLocalNotification(
        "🔔 Notifikasi Diaktifkan",
        "Anda akan menerima notifikasi cerita baru (Mode Simulasi)."
      );
      return true;
    } catch (error) {
      console.error("PushManager: Subscribe error:", error);
      this._showLocalNotification(
        "❌ Gagal",
        "Tidak dapat mengaktifkan notifikasi: " + error.message
      );
      return false;
    }
  }

  async unsubscribe() {
    console.log("PushManager: Unsubscribing...");

    try {
      // ✅ SELALU PAKAI LOCALSTORAGE MODE
      console.log("PushManager: Using localStorage mode");
      localStorage.removeItem("pushSubscription");
      this.isSubscribed = false;

      this._showLocalNotification(
        "🔕 Notifikasi Dimatikan",
        "Anda tidak akan menerima notifikasi lagi."
      );
      return true;
    } catch (error) {
      console.error("PushManager: Unsubscribe error:", error);

      // Tetap lakukan cleanup
      this.isSubscribed = false;
      localStorage.removeItem("pushSubscription");

      this._showLocalNotification(
        "⚠️ Peringatan",
        "Notifikasi dimatikan secara lokal."
      );
      return true;
    }
  }

  _showLocalNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        // ✅ FIX PATH ICON
        const iconPath = "/ceritamu/icons/icon-192x192.png";
        new Notification(title, {
          body: body,
          icon: iconPath,
        });
      } catch (error) {
        // Fallback ke alert
        alert(`${title}: ${body}`);
      }
    } else {
      // Fallback ke alert
      alert(`${title}: ${body}`);
    }
  }

  getStatus() {
    // Selalu cek status terbaru dari localStorage
    const stored = localStorage.getItem("pushSubscription");
    this.isSubscribed = !!stored;

    return {
      isSubscribed: this.isSubscribed,
      isSupported: this._isSupported(),
      permission: Notification.permission,
      isInitialized: this._isInitialized,
    };
  }

  // ✅ HAPUS METHOD YANG TIDAK DIPAKAI
  async _sendSubscriptionToServer() {
    return { success: false, error: "Temporarily disabled" };
  }

  async _removeSubscriptionFromServer() {
    return { success: false, error: "Temporarily disabled" };
  }

  _urlBase64ToUint8Array() {
    return new Uint8Array();
  }
}

export const pushManager = new PushManager();
