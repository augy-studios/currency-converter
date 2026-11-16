# Setting up Firebase for "New versions of the app" notifications

The Android app can tell people the moment a new version is out, even with the app closed. That
notification goes through **Firebase Cloud Messaging (FCM)**, Google's push service for Android:

```text
You publish a release on GitHub (android-v1.0.1, APK attached)
  → GitHub calls the site's webhook: https://currency.uwuapps.org/api/push/release
  → the site checks GitHub's signature, and sends "uwuCurrency 1.0.1 is out" to the FCM topic uwucurrency-releases
  → every phone that turned on "New versions of the app" on the Updates page gets it
  → tapping it opens the Updates page, where Update installs it
```

A phone joins the `uwucurrency-releases` topic when its switch is turned on, so the server keeps
no list of phones. The topic has the `uwucurrency-` prefix because topics are shared by every app
in a Firebase project.

The desktop apps don't use any of this: they check GitHub themselves every hour and when the
computer wakes (`lib/desktop/updater.dart`). The Google Play build can use it too, though Play
also tells people about updates itself.

uwuCurrency goes into the shared **UwU Apps** Firebase project, as an app of its own beside the
other UwU Apps. Only FCM is used: no Analytics, no database, nothing else. It's free.

Until this is done, the app works fully but **New versions of the app** isn't on its Updates
page. The update bar still says when a new version is out while the app is open.

It takes about 20 minutes, and covers four things:

| What | Where it goes | Secret? |
|---|---|---|
| `google-services.json`, which tells the app which Firebase project it belongs to | `flutter/android/app/` | No, but kept out of git anyway |
| uwuCurrency's service account key (`….json`), which lets the site's server send pushes | Vercel, as `FIREBASE_SERVICE_ACCOUNT` | **Yes.** Anyone with it can push to phones with any app in the UwU Apps project |
| A webhook secret, which proves a "release published" call really came from GitHub | GitHub and Vercel, as `GITHUB_WEBHOOK_SECRET` | **Yes** |
| A GitHub token (optional), which raises GitHub's rate limit for the release lookups | Vercel, as `GITHUB_TOKEN` | Yes, though it can do nothing but read |

Steps 1 to 3 are all the **build** needs. Steps 4 to 6 are for the site's server, and can wait
until the site with `api/push/release.js` is deployed.

## How the shared project fits together

```text
Firebase project "UwU Apps"
  Android app  org.uwuapps.currency        <- this app
  Android app  org.uwuapps.board, …        <- the other UwU Apps, each added the same way
  Service account  uwucurrency-push        <- this site's server's key: FCM only
  Service account  uwuboard-push, …        <- one per other app's server
```

- **One Android app entry per app**, each with its own package name.
- **Topics are shared** by every app in the project: each app joins only topics with its own
  prefix, so only uwuCurrency joins `uwucurrency-releases`.
- **One service account per server**, allowed only to send through FCM. Each can be deleted
  without touching the others. Don't use the project's "Firebase Admin SDK" key: it can do
  anything in the project, for every app in it.

## 1. The UwU Apps project

It already exists (uwuBoard, uwuFix and SG Bus Timings use it): open it at
<https://console.firebase.google.com> and go on to step 2. If it ever doesn't:

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Create a project**. Name it `UwU Apps`. Firebase makes a project ID from it, such as
   `uwu-apps-1a2b3`; any will do.
3. **Google Analytics**: uwuCurrency doesn't use it.
4. **Create project**, wait, then **Continue**.

## 2. Add uwuCurrency, and get `google-services.json`

1. In the UwU Apps project: the gear by **Project Overview** > **Project settings** >
   **Your apps** > **Add app** > **Android**.
2. **Android package name**: `org.uwuapps.currency`. It has to be exactly this.
3. **App nickname**: `uwuCurrency`. Leave **Debug signing certificate SHA-1** empty: FCM doesn't
   need it.
4. **Register app**.
5. **Download google-services.json**. Save it as `flutter\android\app\google-services.json`
   (beside `build.gradle.kts`).
6. Click **Next** through the remaining steps without changing anything: the project already
   does what they describe (`android/settings.gradle.kts` and `android/app/build.gradle.kts`
   apply the Google services plugin when the file is there).

Download the file **after** uwuCurrency is added, or its entry isn't in it and the build stops
with "No matching client found for package name".

## 3. Turn on FCM's API

In Firebase: **Project settings** > **Cloud Messaging**. Under **Firebase Cloud Messaging API
(V1)** it should say **Enabled**. If it says Disabled, use its menu (⋮) to open it in Google
Cloud and click **Enable**. This is once for the whole project, so it's most likely on already.

## 4. Make uwuCurrency's own key

1. Open <https://console.cloud.google.com/iam-admin/serviceaccounts> and pick the **UwU Apps**
   project at the top.
2. **Create service account**:
   - **Service account name**: `uwucurrency-push`
   - **Description**: `uwuCurrency's server, sending notifications through FCM`
   - **Create and continue**.
3. **Grant this service account access to project**: in **Select a role**, search for
   `Firebase Cloud Messaging API Admin` and pick it. Only this one. **Continue**, then **Done**.
4. In the list, click `uwucurrency-push@…` > **Keys** > **Add key** > **Create new key** >
   **JSON** > **Create**. A `.json` file downloads.

> [!WARNING]
> That key is a password. Don't commit it, email it, or paste it anywhere but Vercel. If it ever
> leaks, delete it on the same **Keys** tab and make a new one.

## 5. Give the site its secrets (Vercel)

On <https://vercel.com>, open the project that serves `currency.uwuapps.org` (from
`main-site/`) > **Settings** > **Environment Variables**. Add each with **Production** ticked,
and mark each **Sensitive** (`main-site/.env.example` lists them too):

| Key | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Open the key file from step 4 in Notepad and paste **everything** in it, from `{` to `}`. Base64 of the file works too |
| `GITHUB_WEBHOOK_SECRET` | A long random string. Make one with the PowerShell line below, and keep it for step 6 |
| `GITHUB_TOKEN` (optional) | A fine-grained token with **Public repositories (read-only)** and nothing else, from <https://github.com/settings/personal-access-tokens/new> |

```powershell
$b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { '{0:x2}' -f $_ })
```

Then redeploy so the functions see them: **Deployments**, the newest one's **⋯** menu,
**Redeploy**. After that, delete the key file from your Downloads folder.

The server reads the key in `main-site/api/_lib/fcm.js` and sends to the project the key names.

## 6. Tell GitHub to call the site when you publish a release

1. Open <https://github.com/augy-studios/currency-converter/settings/hooks/new>.
2. Fill it in:
   - **Payload URL**: `https://currency.uwuapps.org/api/push/release`
   - **Content type**: `application/json`. It has to be this one.
   - **Secret**: the same `GITHUB_WEBHOOK_SECRET` as in Vercel.
   - **Which events would you like to trigger this webhook?**: **Let me select individual
     events**, untick **Pushes**, tick **Releases**.
   - **Active**: ticked.
3. **Add webhook**. GitHub sends a test ping at once. Under **Recent Deliveries** it should show a
   green tick and `{"ok":true,"pong":true}`. A 401 means the secret doesn't match Vercel's (or
   Vercel hasn't been redeployed since).

From now on, publishing an `android-v*` release with its APK attached sends the notification.
Drafts, pre-releases, releases without an APK and a version older than the newest are skipped,
and **Recent Deliveries** says why: `{"sent":true,"version":"1.0.1"}` when it went.

Attach the APK **before** clicking **Publish release**: the webhook is called the moment it's
published, and a release whose APK isn't there yet is skipped.

## 7. Build the app with Firebase in it

```powershell
powershell -ExecutionPolicy Bypass -File flutter\build-apk.ps1
```

The build picks up `google-services.json` by itself (without it, the Gradle output says
"building without Firebase"). Install the new APK on your phone.

## 8. Check it works

1. In the app, open the edge tray on the right > **Updates**.
2. Turn on **New versions of the app**. On Android 13 and later, Android asks to allow
   notifications: **Allow**. A note says you'll get a notification the moment a new version is
   out. (No switch there? The APK was built without `google-services.json`.)
3. Send yourself a test without making a release:
   1. In Firebase, open **Messaging** > **New campaign** > **Notifications**.
   2. A title and some text, then **Next**.
   3. **Target**: **Topic**, `uwucurrency-releases`. **Next**.
   4. **Additional options** > **Custom data**: key `type`, value `release` (so a tap opens the
      Updates page).
   5. **Scheduling**: **Now**. **Review** > **Publish**. Lock your phone; it arrives within a
      minute.
4. Or, once the webhook's set up, open it in GitHub > **Recent Deliveries** and **Redeliver** a
   past `release` delivery whose action is `released`.

## If something goes wrong

| What happens | What to do |
|---|---|
| The build stops with `No matching client found for package name 'org.uwuapps.currency'` | `google-services.json` was downloaded before uwuCurrency was added. Download it again from **Project settings** > **Your apps** > **uwuCurrency**. |
| There's no **New versions of the app** on the Updates page | The APK was built without `google-services.json`. Check it's at `flutter\android\app\google-services.json`, build again and reinstall. |
| "Notifications are off for uwuCurrency" | You said no to Android's prompt. The app opens its notification settings: turn them on, then the switch again. |
| "Couldn't reach Firebase" when turning it on | The phone was offline, or has no Google Play services (some Huawei phones), which FCM needs. |
| The test campaign never arrives | Check the topic is exactly `uwucurrency-releases` and the switch is on. |
| Vercel logs say `FIREBASE_SERVICE_ACCOUNT is not the service account JSON key` | The value isn't the whole file. Paste it again from `{` to `}`, and redeploy. |
| Vercel logs say `Google token responded 400: invalid_grant` | The key was deleted or the server's clock is off. Make a new key (step 4.4), replace the variable, redeploy. |
| The webhook shows `401 Bad signature` | The secret in GitHub and `GITHUB_WEBHOOK_SECRET` in Vercel differ, or Vercel wasn't redeployed after adding it. |
| The webhook shows `502` with `FIREBASE_SERVICE_ACCOUNT is not set` | Step 5 is missing or wasn't redeployed. |
| The webhook shows `502` with `FCM responded 403` | The service account is missing its role (step 4.3), or FCM's API is off (step 3). |
| The webhook shows `400 Not JSON` | The webhook's content type is `application/x-www-form-urlencoded`. Edit it to `application/json`. |
| The webhook shows `"sent":false` with `Not an android-v* release with its APK uploaded` | The tag doesn't start `android-v`, it's a pre-release, or the APK wasn't attached when you clicked **Publish**. Attach it, then **Redeliver** that delivery. |
