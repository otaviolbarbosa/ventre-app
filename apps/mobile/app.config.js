// APP_VARIANT is set per EAS build profile in eas.json ("development"/"preview" -> dev,
// "production" -> prod). Defaults to dev locally (plain `expo start`/`expo run:android`,
// no EAS profile involved) so a stray unset var never silently ships prod branding.
const isDev = process.env.APP_VARIANT !== "production";

// google-services/* is entirely gitignored, so EAS Build (which only uploads git-tracked
// files) never sees these locally-present files. GOOGLE_SERVICES_JSON and
// GOOGLE_SERVICE_INFO_PLIST are EAS file-type env vars (see `eas env:list`) that resolve to
// a materialized file path on the build runner; local builds fall back to the real paths
// since developers have the actual files on disk, just untracked by git.
const androidGoogleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (isDev ? "./google-services/google-services.json" : "./google-services/prod/google-services.json");
const iosGoogleServicesFile =
  process.env.GOOGLE_SERVICE_INFO_PLIST ??
  (isDev ? "./google-services/GoogleService-Info.plist" : "./google-services/prod/GoogleService-Info.plist");

module.exports = ({ config }) => ({
  ...config,
  name: isDev ? "VentreDEV" : "Ventre",
  icon: isDev ? "./assets/images/icon-dev.png" : config.icon,
  ios: {
    ...config.ios,
    icon: isDev ? "./assets/expo.icon.dev" : config.ios.icon,
    googleServicesFile: iosGoogleServicesFile,
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      ...config.android.adaptiveIcon,
      foregroundImage: isDev
        ? "./assets/images/android-icon-foreground-dev.png"
        : config.android.adaptiveIcon.foregroundImage,
      backgroundImage: isDev
        ? "./assets/images/android-icon-background-dev.png"
        : config.android.adaptiveIcon.backgroundImage,
      monochromeImage: isDev
        ? "./assets/images/android-icon-monochrome-dev.png"
        : config.android.adaptiveIcon.monochromeImage,
    },
    googleServicesFile: androidGoogleServicesFile,
  },
});
