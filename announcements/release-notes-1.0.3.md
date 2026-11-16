A fix for the computer apps' update window on Windows. This version is for Windows, macOS and Linux only; the Android app stays at 1.0.2.

## Download

| Device | File |
|---|---|
| Windows 10 or 11 (x64 or Arm) | `uwucurrency-1.0.3-setup.exe` (or the `.msi`, for installing on many computers at once) |
| Mac with Apple silicon (M1 and later) | `uwucurrency-1.0.3-mac-arm64.dmg` |
| Mac with an Intel processor | `uwucurrency-1.0.3-mac-x64.dmg` |
| Debian, Ubuntu, Mint (x64 or arm64) | `uwucurrency-1.0.3-amd64.deb` or `uwucurrency-1.0.3-arm64.deb` |
| Fedora, openSUSE | `uwucurrency-1.0.3-x86_64.rpm` or `uwucurrency-1.0.3-aarch64.rpm` |
| Any other Linux | `uwucurrency-1.0.3-x86_64.AppImage` or `uwucurrency-1.0.3-aarch64.AppImage` |

For Android, download `uwucurrency-1.0.2.apk` from [uwuCurrency 1.0.2](https://github.com/augy-studios/currency-converter/releases/tag/android-v1.0.2).

Already have uwuCurrency on your computer? It updates itself: look for **Update to 1.0.3** in the title bar, or **Restart to update** in the tray menu.

## Installing

**Windows**: run `uwucurrency-1.0.3-setup.exe`. It's not signed with a paid certificate, so SmartScreen may warn the first time: **More info** > **Run anyway**.

**Mac**: open the `.dmg` and drag uwuCurrency to Applications. The first time, right-click the app > **Open**. If macOS says it's damaged, run `xattr -cr /Applications/uwuCurrency.app` in Terminal.

**Linux**: `sudo apt install ./uwucurrency-1.0.3-amd64.deb`, or `sudo dnf install ./uwucurrency-1.0.3-x86_64.rpm`. For the AppImage, make it executable and run it.

## What's fixed

### Windows
- **The update window** that opens as uwuCurrency starts no longer has a black border round its sides and bottom.
