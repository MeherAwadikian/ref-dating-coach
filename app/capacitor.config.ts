import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the Vite web build (webDir: 'dist') into a native iOS app.
// Generate the Xcode project with:  npm run build && npx cap add ios && npx cap sync ios
// Then open in Xcode:                npx cap open ios
const config: CapacitorConfig = {
  appId: 'com.flirtpilot.app',
  appName: 'Wingman',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0b1220',
  },
  server: {
    // Leave undefined for production (loads the bundled build).
    // For live-reload during dev against a running `npm run dev`, set:
    //   url: 'http://<your-LAN-ip>:5173', cleartext: true
  },
};

export default config;
