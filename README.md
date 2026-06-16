# Personality Portrait Mobile

An Expo React Native iOS app for a guided, non-diagnostic personality portrait interview based on `assets/personality_portrait_guide.md`.

## What It Does

- Starts with API provider, model, API key, and optional base URL setup.
- Supports popular AI providers plus custom OpenAI-compatible endpoints.
- Asks open-ended and 1-10 scoring questions before yes/no calibration.
- Allows spoken answers for open questions on native iOS development builds.
- Uses yes/no answers to validate predicted calibration answers.
- Advances to the next module when prediction agreement reaches 80%, or asks for a correction/counterexample first.
- Outputs a final Markdown personality portrait with evidence and uncertainty.

## Install On iPhone 14 Plus From macOS

1. Install Xcode from the Mac App Store.
2. Install Node.js and npm.
3. Clone this repository from GitHub.
4. Install dependencies:

   ```sh
   npm install
   ```

5. Connect the iPhone 14 Plus by USB and trust the Mac.
6. Build and install the native development app:

   ```sh
   npm run ios
   ```

Voice input uses native speech recognition, so use `npm run ios` instead of Expo Go.

## Provider Notes

The app stores setup and interview progress locally on the device. API keys are used directly from the app, which is convenient for a personal prototype but not appropriate for a public production app. For production, route model calls through your own backend.

For Ollama on a physical iPhone, set the base URL to your Mac's LAN address, for example `http://192.168.1.10:11434`, because `localhost` on the phone means the phone itself.
