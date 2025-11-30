// repin_safe.js
setTimeout(function(){
  Java.perform(function (){
    console.log("");
    console.log("[.] Cert Pinning Bypass / Re-Pinning (safe)");

    var CertificateFactory = Java.use("java.security.cert.CertificateFactory");
    var FileInputStream = Java.use("java.io.FileInputStream");
    var BufferedInputStream = Java.use("java.io.BufferedInputStream");
    var X509Certificate = Java.use("java.security.cert.X509Certificate");
    var KeyStore = Java.use("java.security.KeyStore");
    var TrustManagerFactory = Java.use("javax.net.ssl.TrustManagerFactory");
    var SSLContext = Java.use("javax.net.ssl.SSLContext");
    var File = Java.use("java.io.File");

    // candidate paths (tries these in order)
    var candidates = ["/data/local/tmp/burp.cer", "/data/local/tmp/cert-der.crt", "/sdcard/Download/burp.cer"];
    var filePath = null;

    for (var i = 0; i < candidates.length; i++) {
      try {
        var f = File.$new(candidates[i]);
        if (f.exists()) { filePath = candidates[i]; break; }
      } catch (e) {}
    }

    if (!filePath) {
      console.log("[!] No cert found. Push cert-der.crt or burp.cer to /data/local/tmp and retry.");
      return;
    }

    console.log("[+] Using cert at: " + filePath);

    // Load CAs from an InputStream
    console.log("[+] Loading our CA...");
    var cf = CertificateFactory.getInstance("X.509");

    var fis = null;
    var bis = null;
    try {
      fis = FileInputStream.$new(filePath);
      bis = BufferedInputStream.$new(fis);
      var ca = cf.generateCertificate(bis);
      // cast to X509Certificate for pretty printing
      var certInfo = Java.cast(ca, X509Certificate);
      console.log("[o] Our CA Info: " + certInfo.getSubjectDN());

      // Create a KeyStore containing our trusted CAs
      console.log("[+] Creating a KeyStore for our CA...");
      var keyStoreType = KeyStore.getDefaultType();
      var keyStore = KeyStore.getInstance(keyStoreType);
      keyStore.load(null, null);
      keyStore.setCertificateEntry("ca", ca);

      // Create a TrustManager that trusts the CAs in our KeyStore
      console.log("[+] Creating a TrustManager that trusts the CA in our KeyStore...");
      var tmfAlgorithm = TrustManagerFactory.getDefaultAlgorithm();
      var tmf = TrustManagerFactory.getInstance(tmfAlgorithm);
      tmf.init(keyStore);
      console.log("[+] Our TrustManager is ready...");

      // Hijack SSLContext.init
      console.log("[+] Hijacking SSLContext.init...");
      var initOv = SSLContext.init.overload("[Ljavax.net.ssl.KeyManager;", "[Ljavax.net.ssl.TrustManager;", "java.security.SecureRandom");
      initOv.implementation = function(km, tm, sr) {
        console.log("[o] App invoked javax.net.ssl.SSLContext.init; injecting our TrustManagers...");
        return initOv.call(this, km, tmf.getTrustManagers(), sr);
      };
      console.log("[+] Installed SSLContext.init hook.");
    } catch (err) {
      console.log("[!] Error while loading certificate or installing hook: " + err);
    } finally {
      try { if (bis) bis.close(); } catch (e) {}
      try { if (fis) fis.close(); } catch (e) {}
    }

    // Optional: also set default HostnameVerifier and disable OkHttp CertificatePinner
    try {
      var HUC = Java.use('javax.net.ssl.HttpsURLConnection');
      var HostnameVerifier = Java.use('javax.net.ssl.HostnameVerifier');
      var AlwaysOK = Java.registerClass({
        name: 'com.leftenter.instagram.AlwaysOK',
        implements: [HostnameVerifier],
        methods: { verify: function () { return true; } }
      });
      HUC.setDefaultHostnameVerifier(AlwaysOK.$new());
      console.log("[+] Set default HostnameVerifier -> always true");
    } catch (e) { /* not fatal */ }

    try {
      var CP = Java.use('okhttp3.CertificatePinner');
      CP.check.overload('java.lang.String', 'java.util.List').implementation = function () { /* no-op */ };
      console.log("[+] OkHttp CertificatePinner.check -> no-op");
    } catch (e) { /* ok if not present */ }

    console.log("[*] Re-pinning script finished. If TLS still fails, app may use native pinning (libgadget).");
  });
}, 0);
