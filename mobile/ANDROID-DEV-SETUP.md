# Android Dev Setup — Fast Iteration

## One-Time Setup (5 minutes)

### 1. Log into Expo/EAS
```bash
cd mobile
eas login
```
Create a free account at https://expo.dev if you don't have one.

### 2. Build the dev client APK (cloud build, ~10 min)
```bash
eas build --profile development --platform android
```
This builds in Expo's cloud. When done, you'll get a download URL.

### 3. Install on your phone
- Open the download URL on your Android phone's browser
- Or connect via USB and run: `adb install <path-to-downloaded.apk>`
- You may need to enable "Install from unknown sources" in Android Settings

## Daily Dev Workflow (instant iteration)

### Start the dev server
```bash
cd mobile
npx expo start --dev-client
```

### Connect your phone
- Make sure your phone and Mac are on the **same WiFi network**
- Open the "jklb" app on your phone
- It will automatically find the dev server, OR
- Scan the QR code shown in the terminal

### Hot reload
- Save a file → changes appear on phone instantly
- Shake your phone to open the dev menu (reload, debug, etc.)

## Useful Commands

| Command | What it does |
|---|---|
| `npx expo start --dev-client` | Start dev server for phone |
| `adb devices` | Check if phone is connected via USB |
| `adb install file.apk` | Install APK over USB |
| `eas build --profile preview --platform android` | Build a standalone preview APK |
| `eas build --profile production --platform android` | Build production AAB for Play Store |

## Troubleshooting

- **Phone can't find dev server?** → Same WiFi? Try `npx expo start --dev-client --tunnel`
- **OAuth login fails?** → The redirect scheme `social.jklb://` only works in the dev client, NOT Expo Go
- **Build fails?** → Run `npx expo-doctor` to check for issues
