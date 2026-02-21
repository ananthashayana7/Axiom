# Mobile App Packaging & Publishing Guide

This project uses [Capacitor](https://capacitorjs.com/) to package the Axiom Procurement Platform as native iOS and Android applications.

## 1. Prerequisites

### Software
- **Node.js**: v18+
- **Xcode**: (macOS only) for iOS development and App Store submission.
- **Android Studio**: For Android development and Play Store submission.
- **CocoaPods**: `sudo gem install cocoapods` (for iOS).

### Developer Accounts
- **Apple Developer Program**: Required to publish to the App Store ($99/year). [Join here](https://developer.apple.com/programs/).
- **Google Play Console**: Required to publish to the Play Store ($25 one-time fee). [Sign up here](https://play.google.com/console/signup).

---

## 2. Configuration

Since this is a dynamic Next.js application, the native app acts as a "web shell" that loads your hosted platform.

1.  **Deploy your platform** to a publicly accessible URL (e.g., Vercel, AWS, VPS).
2.  **Update `capacitor.config.ts`**:
    Change the `url` to your production URL:
    ```typescript
    server: {
      url: 'https://your-hosted-platform.com',
      cleartext: true
    }
    ```

---

## 3. Visual Assets (Icons & Splash Screens)

We use `@capacitor/assets` to automate icon generation.

1.  Place your master icon (1024x1024px) at `assets/icon-only.png` or similar.
2.  Place your splash screen (2732x2732px) at `assets/splash.png`.
3.  Run the generation script:
    ```bash
    npm run cap:assets
    ```
    This will populate all necessary sizes in `ios/` and `android/` folders.

---

## 4. Publishing to the Apple App Store (iOS)

### Step 1: Prepare in Xcode
1. Open the project in Xcode:
   ```bash
   npm run cap:open-ios
   ```
2. In the "General" tab, verify the **Bundle Identifier** (`com.axiom.procurement`) and **Version**.
3. In the "Signing & Capabilities" tab, select your **Development Team**.
4. Select **Any iOS Device (arm64)** as the build target.

### Step 2: Create an Archive
1. Go to **Product > Archive**.
2. Once the archive is created, the Organizer window will open.

### Step 3: Upload to App Store Connect
1. Click **Distribute App**.
2. Select **App Store Connect** > **Upload**.
3. Follow the prompts to sign and upload your build.
4. Log in to [App Store Connect](https://appstoreconnect.apple.com/) to finish the listing, add screenshots, and submit for review.

---

## 5. Publishing to the Google Play Store (Android)

### Step 1: Prepare in Android Studio
1. Open the project:
   ```bash
   npm run cap:open-android
   ```
2. Wait for Gradle sync to complete.

### Step 2: Generate a Signed Bundle
1. Go to **Build > Generate Signed Bundle / APK**.
2. Select **Android App Bundle** (preferred for Play Store).
3. Create a new **Key Store** if you don't have one (keep this file safe!).
4. Follow the wizard to create the `.aab` file.

### Step 3: Upload to Google Play Console
1. Log in to [Google Play Console](https://play.google.com/console/).
2. Create a new App.
3. Go to **Production > Create new release**.
4. Upload the `.aab` file from `android/app/release/`.
5. Complete the Store Listing (description, icons, screenshots) and submit for review.

---

## 6. Troubleshooting & Tips

- **SSL Required**: The App Store requires your hosted URL to use HTTPS.
- **NextAuth Compatibility**: Ensure your `NEXTAUTH_URL` environment variable on the server matches the `url` in `capacitor.config.ts`.
- **Syncing Changes**: Every time you change `capacitor.config.ts` or add a new plugin, run:
  ```bash
  npm run cap:sync
  ```
