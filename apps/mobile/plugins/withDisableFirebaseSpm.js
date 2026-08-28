const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

// react-native-firebase's SPM integration only ships dynamic libraries, so
// combining it with the default static linkage (which apps/mobile's other
// precompiled Expo pods, e.g. @expo/ui, depend on) fails at pod install time.
// Setting $RNFirebaseDisableSPM = true opts Firebase out of SPM entirely and
// falls back to CocoaPods-only dependency resolution, which keeps static
// linkage intact for every other pod. Must run before any `target` block, so
// it's inserted as the first line of the generated Podfile.
// See: node_modules/@react-native-firebase/app/firebase_spm.rb
function withDisableFirebaseSpm(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      const contents = fs.readFileSync(podfilePath, "utf-8");
      const marker = "$RNFirebaseDisableSPM = true";
      if (!contents.includes(marker)) {
        fs.writeFileSync(podfilePath, `${marker}\n${contents}`);
      }
      return config;
    },
  ]);
}

module.exports = withDisableFirebaseSpm;
