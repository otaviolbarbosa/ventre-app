// APP_VARIANT is set per EAS build profile in eas.json ("development"/"preview" -> dev,
// "production" -> prod). Defaults to dev locally (plain `expo start`/`expo run:android`,
// no EAS profile involved) so a stray unset var never silently ships prod branding.
const isDev = process.env.APP_VARIANT !== "production";

module.exports = ({ config }) => ({
  ...config,
  name: isDev ? "VentreDEV" : "Ventre",
  icon: isDev ? "./assets/images/icon-dev.png" : config.icon,
  ios: {
    ...config.ios,
    icon: isDev ? "./assets/expo.icon.dev" : config.ios.icon,
    googleServicesFile: isDev
      ? config.ios.googleServicesFile
      : "./google-services/prod/GoogleService-Info.plist",
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
    googleServicesFile: isDev
      ? config.android.googleServicesFile
      : "./google-services/prod/google-services.json",
  },
});
