A new API Docs button in the edge tray, on every device, opens the documentation for uwuCurrency's exchange rate API.

## Download

| Device | File |
|---|---|
| Android 7.0 or newer | `uwucurrency-1.0.4.apk` |
| Windows 10 or 11 (x64 or Arm) | `uwucurrency-1.0.4-setup.exe` (or the `.msi`, for installing on many computers at once) |
| Mac with Apple silicon (M1 and later) | `uwucurrency-1.0.4-mac-arm64.dmg` |
| Mac with an Intel processor | `uwucurrency-1.0.4-mac-x64.dmg` |
| Debian, Ubuntu, Mint (x64 or arm64) | `uwucurrency-1.0.4-amd64.deb` or `uwucurrency-1.0.4-arm64.deb` |
| Fedora, openSUSE | `uwucurrency-1.0.4-x86_64.rpm` or `uwucurrency-1.0.4-aarch64.rpm` |
| Any other Linux | `uwucurrency-1.0.4-x86_64.AppImage` or `uwucurrency-1.0.4-aarch64.AppImage` |

Already have uwuCurrency on your computer? It updates itself: look for **Update to 1.0.4** in the title bar, or **Restart to update** in the tray menu. On Android, open **Updates** from the edge tray and tap **Update**.

## Installing

**Android**: download the `.apk` on your phone and open it. If Android asks, allow installing apps from your browser or Files. If Play Protect asks about the app, tap **More details** > **Install anyway**.

**Windows**: run `uwucurrency-1.0.4-setup.exe`. It's not signed with a paid certificate, so SmartScreen may warn the first time: **More info** > **Run anyway**.

**Mac**: open the `.dmg` and drag uwuCurrency to Applications. The first time, right-click the app > **Open**. If macOS says it's damaged, run `xattr -cr /Applications/uwuCurrency.app` in Terminal.

**Linux**: `sudo apt install ./uwucurrency-1.0.4-amd64.deb`, or `sudo dnf install ./uwucurrency-1.0.4-x86_64.rpm`. For the AppImage, make it executable and run it.

## What's new

### Everywhere
- **API Docs**: a new button in the edge tray, between Show me around and Report a bug, opens the exchange rate API's documentation (docs.api.currency.uwuapps.org) in your browser. Press and hold it to see its label.
- **Show me around** mentions API Docs among the edge tray's buttons.
