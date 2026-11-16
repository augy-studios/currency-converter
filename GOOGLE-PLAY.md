# Putting uwuCurrency on Google Play

A step-by-step guide to publishing the Flutter Android app on Google Play, for the repo as it
stands at 1.0.0 (16 November 2026). Google changes its Play rules often: each rule below says
where it comes from, so re-check that page if this date is far behind you.

**What's different here:** Google Play already has an app with this package,
`org.uwuapps.currency`: the old Currency Converter, a web-app wrapper (a TWA) built with a key
that isn't on this computer. The Flutter app **replaces it as an update to the same listing**, so
everyone who has it gets the new app, with its reviews and installs kept. That needs one thing
from Google first: a new **upload key** (section 3, D1).

**What's done in the repo already:** the Play build (`flutter\build-apk.ps1 -Aab`) makes a signed,
shrunk and obfuscated App Bundle with no updater of its own, and checks it; the release notes and
store graphics are written and drawn (`announcements/`, `docs/*-assets/`, `docs/feature-graphic.png`).
**What's left is yours:** the upload-key reset, the decisions in section 3, and the clicks in Play
Console.

## Contents

1. [The short version](#1-the-short-version)
2. [What the Play build is](#2-what-the-play-build-is)
3. [Decisions to make](#3-decisions-to-make)
4. [Step 1: A new upload key](#4-step-1-a-new-upload-key)
5. [Step 2: Build the App Bundle](#5-step-2-build-the-app-bundle)
6. [Step 3: Store listing](#6-step-3-store-listing)
7. [Step 4: App content (the Dashboard tasks)](#7-step-4-app-content-the-dashboard-tasks)
8. [Step 5: Data safety](#8-step-5-data-safety)
9. [Step 6: Testing, then production](#9-step-6-testing-then-production)
10. [After launch](#10-after-launch)
11. [Checklist](#11-checklist)

---

## 1. The short version

- Google Play takes an **Android App Bundle** (`uwucurrency-<version>.aab`), not the APK on
  GitHub. It's built into `release/<version>/`.
- It's the same app as the GitHub APK, with the same package (`org.uwuapps.currency`) and key,
  minus the self-updater, which Play forbids: Play updates it instead.
- The bundle is shrunk and obfuscated as Play recommends (R8 for the Java, Dart obfuscation,
  unused resources removed), and carries R8's mapping and the native symbol tables, so Play
  Console's crash reports and "deobfuscation" warnings are covered.
- Play App Signing signs the listing with **Google's key**, and keeps doing so. What changes is
  the **upload key**, the one you sign bundles with before uploading: `flutter\android.keystore`
  (step 1). `main-site/.well-known/assetlinks.json` lists the app's own key (`EB:68:…:4E:BF`);
  add Google's app signing key beside it for Play installs to open the site's links (step 1).
- Its version code has to be **higher than the old app's last one** (D2).
- The listing exists, so the 12-tester closed test that new personal accounts need doesn't apply:
  an internal test, then production.

## 2. What the Play build is

| | GitHub APK | Play App Bundle |
|---|---|---|
| Built with | `build-apk.ps1` | `build-apk.ps1 -Aab` |
| Updater | Updates page, update bar, downloads and installs the APK | None: Play updates it. The Updates page still lists every version, with **Update on Google Play** |
| `REQUEST_INSTALL_PACKAGES` | Yes | Removed (`android/app/src/play/AndroidManifest.xml`), and the script checks it's gone |
| "New versions of the app" notifications | Yes, with Firebase | Yes, with Firebase (optional on Play: Play notifies too) |
| Processors | ARM 32 and 64 bit in one APK | Play delivers each phone only what it needs |
| Signed with | `android.keystore` | The same, as the upload key; Play re-signs with its app signing key |

The app asks for only these permissions: **Internet**; **post notifications** (Android 13+,
asked only when "New versions of the app" is turned on); **keep the screen on** while sharing
history with another device; **write to storage** on Android 9 and older only (Save as Image).
Nothing that needs a Play declaration form.

Target SDK: Flutter 3.47's default (36), which Play requires for new apps and updates from
31 August 2026.

## 3. Decisions to make

| | Decision | Recommended |
|---|---|---|
| D1 | **The upload key.** The old TWA's upload key isn't on this computer, so a new one was made (`flutter\android.keystore`, back it up). Play accepts it once you ask for an **upload key reset** (step 1); the app signing key stays Google's. The other way, if you find the old TWA's keystore, is to sign with it instead; but then the GitHub APK and the Play app still can't update each other, as Play re-signs with its own key either way. | Upload key reset |
| D2 | **The version code.** Play refuses a bundle whose `versionCode` isn't above every one it has had for this app. The old app's last was **6** (6.0.0, App bundle explorer), so uwuCurrency's start at **7**: `flutter\pubspec.yaml` was set to `1.0.0+6`, and `build-apk.ps1` raises it by one before every build. The name, 1.0.0, can be anything: Play compares codes only. | Done |
| D3 | **GitHub and Play installs.** Play installs are signed with Google's key, GitHub ones with `android.keystore`, so one can't update the other: someone switching uninstalls first (Share with another device keeps their history across). `assetlinks.json` lists the app's own key, so GitHub installs open the site's links; Play installs do too once Google's app signing key is added beside it (step 1). | As it is |
| D4 | **Privacy policy URL.** `https://currency.uwuapps.org/privacy` (`main-site/privacy.html`, linked from the site's About and the app's About). Keep it and section 8 saying the same things. | Done |

## 4. Step 1: A new upload key

1. Export the new key's certificate, in PowerShell from the project root, with the alias in
   `flutter\keystore.properties` (it asks for the keystore's password, also there):

   ```powershell
   keytool -export -rfc -keystore flutter\android.keystore -alias uwucurrency -file upload_certificate.pem
   ```

2. In Play Console, open **uwuCurrency** (the old Currency Converter) > **Test and release** >
   **Setup** > **App signing** > **Request upload key reset**
   ([upload key reset](https://support.google.com/googleplay/android-developer/answer/9842756#reset)).
   Give the reason ("I lost my upload key"), attach `upload_certificate.pem`, and send it.
3. Google usually approves within two days, and the new key works from the date it says.
   Afterwards **App signing** shows the **upload key certificate** with this SHA-256, which
   `build-apk.ps1` checks every bundle against:

   ```text
   EB:68:A3:DC:F9:16:A9:D0:51:99:CC:05:52:D5:BF:5C:C1:EE:69:01:39:AC:14:72:88:48:04:19:C4:2D:4E:BF
   ```

   The same key signs the GitHub APK, and it's the one `main-site/.well-known/assetlinks.json`
   lists.

4. Delete `upload_certificate.pem` (it's not secret, but it's not needed again).
5. On the same page, copy the **app signing key certificate**'s SHA-256 (Google's key, which signs
   what Play installs) and add it to `sha256_cert_fingerprints` in
   `main-site/.well-known/assetlinks.json`, beside the app's own, then deploy the site. Without it,
   the site's links open in the browser rather than the Play app.

## 5. Step 2: Build the App Bundle

In PowerShell, from the project root, with `android.keystore`, `keystore.properties` and
`android\app\google-services.json` in `flutter\` (they're not in git: restore them from your
backup):

```powershell
powershell -ExecutionPolicy Bypass -File flutter\build-apk.ps1 -Aab
```

It raises the version code by one (Play refuses one it's seen), writes
`release\<version>\uwucurrency-<version>.aab`, and refuses to finish unless the bundle:

- is signed with the app's key (it prints the SHA-256 it was signed with);
- has no `REQUEST_INSTALL_PACKAGES` in its manifest;
- carries `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map` (R8's mapping, which
  Play reads for crash reports) and the stripped symbol tables of `libflutter.so` and `libapp.so`.

Beside it, `uwucurrency-<version>-play-mapping.txt` and `-play-symbols.zip` stay on your computer
(git-ignored): with them, `flutter symbolize` reads an obfuscated Dart stack trace from Play's
crash reports. Commit `pubspec.yaml` with the raised version code.

## 6. Step 3: Store listing

**Grow users** > **Store presence** > **Main store listing**
([asset specs](https://support.google.com/googleplay/android-developer/answer/9866151)). The
listing exists, so this replaces the old text and pictures:

| Field | Limit | uwuCurrency |
|---|---|---|
| App name | 30 | `uwuCurrency: Converter` (22) |
| Short description | 80 | `Live exchange rates, rate graphs and a history you can share between devices` (76) |
| Full description | 4,000 | Below |
| App icon | 512 × 512 PNG | `main-site/CC-512.png` |
| Feature graphic | 1024 × 500, no alpha | `docs/feature-graphic.png` |
| Phone screenshots | 2 to 8 | `docs/phone-assets/01…08` (1620 × 2880) |
| 7-inch tablet screenshots | up to 8 | `docs/tablet-assets/7-inch/01…08` (1620 × 2880) |
| 10-inch tablet screenshots | up to 8 | `docs/tablet-assets/10-inch/01…08` (2880 × 1620) |
| Chromebook screenshots | up to 8 | `docs/desktop-assets/01…08` (2880 × 1620) |
| Category | one | **Finance** (or **Tools**) |
| Tags | up to 5 | Currency converter, Exchange rates, Travel, Finance, Calculator (whichever of these Play offers) |
| Contact | email, website | Your email; `https://currency.uwuapps.org` |

Upload the screenshots in their numbered order: the first three show in search results.

Full description (en-GB):

```text
uwuCurrency converts between currencies with live exchange rates, in a moment.

LIVE RATES
Type an amount, pick two currencies, and the answer is there, with the rate it used and the day it's from. Search by code (USD, EUR, JPY) or by name (Dollar, Euro, Yen). Swap them round with a tap, or turn the rate round with Invert.

RATES OVER TIME
See how a rate has moved over five days, a week, a month, a year, five years or every day there is. Add up to six currencies to compare: each starts at 100, so their changes line up whatever their size.

YOUR HISTORY
Every conversion is kept on your phone, newest first. Tap one to convert it again at today's rate. Nothing leaves your phone unless you share it.

SHARE WITH YOUR OTHER DEVICES
Copy your history and theme straight to your other phone, tablet or computer with a code or a QR code, no account needed. It goes from device to device, never through a server.

WORKS OFFLINE
The last rates you saw stay on your phone, so you can still convert without a connection.

YOUR LOOK
Material You by default: your phone's font and, on Android 12 and later, your wallpaper's colours. Prefer uwuCurrency's own look? Switch to the UwU Apps theme and pick from seven colours. Light, dark, or time-based.

SHARE A CONVERSION
Send it to a friend on Telegram, WhatsApp, X or Facebook, or save it as a picture.

ALSO
A short tour the first time you open it, the edge tray for every action in reach, and Report a bug, right in the app, with screenshots.

No account, no ads, no tracking. uwuCurrency is also on the web at currency.uwuapps.org, and for Windows, macOS and Linux.

Made with love in Singapore by Augy Studios.
```

## 7. Step 4: App content (the Dashboard tasks)

**Policy and programmes** > **App content**
([prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455)).
The old app answered these already; check each against the new app:

| Task | Answer |
|---|---|
| Privacy policy | `https://currency.uwuapps.org/privacy` (D4) |
| Ads | **No ads** (the app has none; the website's ads don't count) |
| App access | **All functionality is available without special access**: there are no accounts |
| Content rating | The questionnaire: a utility, no violence, no gambling, no user-generated content shared with others. Users can't talk to each other in the app; sharing history copies one's own conversions between one's own devices |
| Target audience | 13 and over (or everyone: nothing in it is unsuitable for children, but it isn't designed for them) |
| News app | No |
| Government app | No |
| Financial features | **None**: it shows exchange rates and converts; it doesn't hold, send or lend money, trade, or give advice |
| Health | No |
| Advertising ID | **No**: the app has no ads or analytics SDK and doesn't use it |
| Account deletion | Not needed: the app has no accounts |

## 8. Step 5: Data safety

**App content** > **Data safety**
([form help](https://support.google.com/googleplay/android-developer/answer/10787469)). Data is
"collected" when it leaves the phone; data used only on the phone isn't. The conversion history,
the settings and the kept rates stay on the phone, so they're not collected.

| Data type | What happens | Declare |
|---|---|---|
| Other user-generated content | What's typed in Report a bug, sent on to Telegram | Collected, optional, App functionality |
| Email address | Only if someone leaves an email in Report a bug as the way to reach them | Collected, optional, App functionality |
| Photos | Up to three pictures added to Report a bug, sent on to Telegram | Collected, optional, App functionality |
| Diagnostics (App info and performance) | Report a bug adds the app's version, the device and system as the app describes them, and the kind of page on show, all shown before it's sent | Collected, optional (only when someone sends a report), App functionality |
| Device or other IDs | Only with "New versions of the app" on: Firebase subscribes the phone to a topic, through Google's servers; uwuCurrency's server keeps no ID | Collected, optional, App functionality (Firebase Cloud Messaging) |
| Financial info | The amounts converted aren't sent anywhere: rates are asked for by currency alone | Not collected |
| Location, contacts, calendar, messages, health, web history | Not used | Not collected |

Other answers:

- **Encrypted in transit**: **Yes** (HTTPS for the API, DTLS for sharing's WebRTC channel).
- **Can people ask for data to be deleted?** **Yes**: Clear on the History card deletes it from
  the phone; bug reports are deleted on request by email, quoting the report's ID, as the Privacy
  page says.
- **Shared with third parties?** No: Vercel (the server), Firebase and Telegram (which delivers
  bug reports to you) are service providers working for uwuCurrency, which Play doesn't count as
  sharing. Sharing history goes from the person's device to their own other device.
- Check the SDKs' own notes in the [Play SDK Index](https://play.google.com/sdks): Firebase
  Messaging, flutter_webrtc.

## 9. Step 6: Testing, then production

1. **Internal testing**: **Test and release** > **Testing** > **Internal testing** > **Create new
   release**, upload `uwucurrency-1.0.0.aab`, paste the release notes from
   `announcements/play-release-notes-1.0.0.md`, and add yourself and a few testers by email. No
   review in the usual case. Use it to check:
   - a phone with the **old Play app** installed takes the new one as an update;
   - the Updates page shows **Update on Google Play**, and there's no update bar;
   - a currency link (`https://currency.uwuapps.org/`) opens the app.
2. **Production**: **Create new release** (the same bundle), the release notes, **Next**,
   **Start rollout** (a staged rollout, say 20% first, is a good idea for a change this big).
   The review can take a few days.

## 10. After launch

- **Every update**: raise the version name, `build-apk.ps1 -Aab` (the code goes up by itself),
  upload to a track, paste `announcements/play-release-notes-<version>.md`, roll out. The GitHub
  release goes on as before with the APK (the root `README.md`, "Releasing").
- **Target API each year**: Play raises the required target SDK every August. Upgrading Flutter
  raises it; check `targetSdk` in the built bundle's manifest
  ([target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)).
- **Crashes**: Play Console > **Quality** > **Android vitals**. Java stack traces are readable
  thanks to the mapping in the bundle; for Dart ones, `flutter symbolize -i <trace> -d
  <unzipped -play-symbols.zip>`.

## 11. Checklist

- [ ] D1–D4 decided; privacy policy page live (deploy `main-site/` first)
- [ ] `android.keystore` and `keystore.properties` backed up somewhere safe
- [ ] Upload key reset asked for, and approved
- [ ] The version code above the old app's (D2)
- [ ] `uwucurrency-<version>.aab` built with `-Aab`, its checks passed
- [ ] Store listing: text, icon, feature graphic, phone, tablet and Chromebook screenshots
- [ ] App content tasks checked; Data safety updated
- [ ] Internal test installed over the old app and checked
- [ ] Production rolled out
