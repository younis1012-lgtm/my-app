# Yi Quality Mobile App

This project includes native Android and iOS shells using Capacitor.

## App Identity

- App name: `Yi Quality`
- Android/iOS package id: `com.younis.yiquality`
- Production URL loaded by the app: `https://yi-quality.vercel.app`

Because the native app loads the production Vercel URL, normal system updates continue to be deployed through GitHub/Vercel. The mobile app does not need a new store build for ordinary web-system changes, unless the app icon, native permissions, package id, or store metadata changes.

## Useful Commands

```bash
npm run cap:sync
npm run cap:open:android
npm run cap:open:ios
```

## Android Store Build

Requirements:

- Android Studio
- JDK configured in `JAVA_HOME`
- Google Play Console account

After installing Android Studio/JDK:

```bash
npm run cap:sync
cd android
gradlew.bat bundleRelease
```

The release artifact for Google Play is an `.aab` file, usually under:

```text
android/app/build/outputs/bundle/release/
```

## iPhone / App Store Build

Requirements:

- Mac computer
- Xcode
- Apple Developer account

Open the iOS project on a Mac:

```bash
npm run cap:sync
npm run cap:open:ios
```

Then archive and upload through Xcode.

## Current Note

An Android debug build was attempted on this Windows machine, but it stopped because Java is not configured:

```text
JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

Install Android Studio/JDK or configure `JAVA_HOME`, then run the Android build commands above.
