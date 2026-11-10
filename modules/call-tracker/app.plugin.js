const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Lets a rep share a recording into the app ("Share → Ringwise") and attach
 * it to a call — for phones whose dialler saves recordings where the app
 * can't find them. Adds the audio SEND filter to the main activity; the
 * module reads the shared file (CallTracker.takeSharedAudio / onSharedAudio).
 */
module.exports = function withShareAudio(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find((a) => a.$["android:name"] === ".MainActivity");
    if (!main) return cfg;
    main["intent-filter"] = main["intent-filter"] ?? [];
    const already = main["intent-filter"].some((f) =>
      f.action?.some((a) => a.$["android:name"] === "android.intent.action.SEND"),
    );
    if (!already) {
      main["intent-filter"].push({
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": "audio/*" } }],
      });
    }
    return cfg;
  });
};
