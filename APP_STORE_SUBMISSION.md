# MagicMirror App Store Submission Notes

Use these notes when creating the App Store Connect app record and preparing the first TestFlight/App Store build.

## App Identity

- App name: MagicMirror
- Bundle ID: `com.qianwang.magicmirror`
- Version: `1.0.0`
- Build: `1`
- Platform: iOS
- Tablet support: iPhone only
- Category suggestion: Lifestyle or Productivity

Important: Apple treats the Bundle ID as the app identity. After uploading a build for the app, do not change it unless you intend to create a different app record.

## Privacy Summary

Recommended App Privacy answers based on the current code:

- Tracking: No
- Third-party advertising: No
- Analytics collection: No
- Data linked to user: No, unless you add accounts or analytics later
- Data collected by this app: user-provided interview content is stored locally on device
- Optional third-party processing: if the user enters a model provider API key, the app sends interview text to the selected provider

Use `PRIVACY_POLICY.md` as the privacy policy source. App Store Connect requires a public privacy policy URL, so publish that file somewhere public before submitting, for example GitHub Pages or a simple website page.

Use `SUPPORT.md` as the support page source. App Store Connect requires a public support URL.

## Review Notes Draft

MagicMirror is a self-reflection interview app. It can run without an API key using Free Local mode. Users may optionally enter their own model provider API key for richer wording. The app includes an in-app disclaimer that generated personality and MBTI-style results are for reference only and are not diagnostic or professional advice.

Voice input is optional and is used only when the user taps Voice Input for open questions.

## Local Build Commands

```sh
npm install
npm run typecheck
npx expo prebuild --platform ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -list -project ios/PersonalityPortrait.xcodeproj
```

For the final archive, open the generated iOS project in Xcode, select Any iOS Device, then use Product > Archive. Upload from Xcode Organizer after signing is configured with an Apple Developer Program team.

The command-line archive has also been verified locally:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -workspace ios/PersonalityPortrait.xcworkspace \
  -scheme PersonalityPortrait \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/MagicMirror.xcarchive \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=SUTN88MC73
```
