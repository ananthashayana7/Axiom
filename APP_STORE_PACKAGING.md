# Mobile App Packaging (Capacitor)

This project is configured with [Capacitor](https://capacitorjs.com/) to allow packaging as a native iOS or Android application.

## Prerequisites
- Node.js installed
- CocoaPods (for iOS)
- Android Studio (for Android)
- Xcode (for iOS)

## Configuration
Since this is a full Next.js application with a backend (NextAuth, Database), it cannot be exported to static HTML. The native app works as a "shell" that loads the platform from a hosted URL.

1.  **Deploy your platform** to a publicly accessible URL (e.g., Vercel, AWS, VPS).
2.  Update the `url` in `capacitor.config.ts` to match your deployment.

## Development Commands

### 1. Sync Changes
If you change the configuration or add plugins:
```bash
npm run cap:sync
```

### 2. Open in Native IDEs
To build and run the app:

**iOS:**
```bash
npm run cap:open-ios
```
This will open Xcode. From there, you can select a simulator/device and run.

**Android:**
```bash
npm run cap:open-android
```
This will open Android Studio.

## App Store Submission
To list on the App Store:
1. Ensure your icons and splash screens are generated (use `@capacitor/assets`).
2. Follow the standard submission process for Apple App Store (via Xcode) and Google Play Store (via Android Studio).
3. Ensure the hosted platform is reachable and has proper SSL.
