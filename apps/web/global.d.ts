declare module "*.css" {}

// Injected by react-native-webview into the page when apps/mobile's <WebView>
// has onMessage set. See apps/web/src/lib/native-bridge.ts.
interface Window {
  ReactNativeWebView?: { postMessage: (data: string) => void };
}
