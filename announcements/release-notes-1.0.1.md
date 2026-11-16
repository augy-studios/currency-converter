Fixes for the Fluent 2 look on Windows, and a tidier title bar on every computer.

## Download

| Device | File |
|---|---|
| Android 7.0 or newer | `uwucurrency-1.0.1.apk` |
| Windows 10 or 11 (x64 or Arm) | `uwucurrency-1.0.1-setup.exe` (or the `.msi`, for installing on many computers at once) |
| Mac with Apple silicon (M1 and later) | `uwucurrency-1.0.1-mac-arm64.dmg` |
| Mac with an Intel processor | `uwucurrency-1.0.1-mac-x64.dmg` |
| Debian, Ubuntu, Mint (x64 or arm64) | `uwucurrency-1.0.1-amd64.deb` or `uwucurrency-1.0.1-arm64.deb` |
| Fedora, openSUSE | `uwucurrency-1.0.1-x86_64.rpm` or `uwucurrency-1.0.1-aarch64.rpm` |
| Any other Linux | `uwucurrency-1.0.1-x86_64.AppImage` or `uwucurrency-1.0.1-aarch64.AppImage` |

Already have 1.0.0 on your computer? It updates itself: look for **Update to 1.0.1** in the title bar, or **Restart to update** in the tray menu.

## Installing

**Android**: download the `.apk` on your phone and open it. If Android asks, allow installing apps from your browser or Files. If Play Protect asks about the app, tap **More details** > **Install anyway**.

**Windows**: run `uwucurrency-1.0.1-setup.exe`. It's not signed with a paid certificate, so SmartScreen may warn the first time: **More info** > **Run anyway**.

**Mac**: open the `.dmg` and drag uwuCurrency to Applications. The first time, right-click the app > **Open**. If macOS says it's damaged, run `xattr -cr /Applications/uwuCurrency.app` in Terminal.

**Linux**: `sudo apt install ./uwucurrency-1.0.1-amd64.deb`, or `sudo dnf install ./uwucurrency-1.0.1-x86_64.rpm`. For the AppImage, make it executable and run it.

## What's fixed

### Windows
- **Fluent 2's title bar** no longer shows two sets of minimise, maximise and close buttons.
- **Fluent 2 with "Show accent colour on title bars" turned on** no longer fills the whole window with your accent colour. Fluent 2 now has its own Mica-like backdrop behind the page.

### Windows, macOS and Linux
- **Dark mode in the glass looks**: Theme, Share and the other windows that open over the page were light, with white writing that was hard to read. They're dark now, as they should be.
- **A tidier title bar**: the Back, Forward and Reload buttons are gone. The converter has its own refresh button, and `F5` still refreshes the rates.

### Android
- Nothing new: this version is the same as 1.0.0.
