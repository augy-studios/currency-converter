Fixes for screenshots in bug reports and for the converter on tablets and wider windows, on every device.

## Download

| Device | File |
|---|---|
| Android 7.0 or newer | `uwucurrency-1.0.2.apk` |
| Windows 10 or 11 (x64 or Arm) | `uwucurrency-1.0.2-setup.exe` (or the `.msi`, for installing on many computers at once) |
| Mac with Apple silicon (M1 and later) | `uwucurrency-1.0.2-mac-arm64.dmg` |
| Mac with an Intel processor | `uwucurrency-1.0.2-mac-x64.dmg` |
| Debian, Ubuntu, Mint (x64 or arm64) | `uwucurrency-1.0.2-amd64.deb` or `uwucurrency-1.0.2-arm64.deb` |
| Fedora, openSUSE | `uwucurrency-1.0.2-x86_64.rpm` or `uwucurrency-1.0.2-aarch64.rpm` |
| Any other Linux | `uwucurrency-1.0.2-x86_64.AppImage` or `uwucurrency-1.0.2-aarch64.AppImage` |

Already have uwuCurrency on your computer? It updates itself: look for **Update to 1.0.2** in the title bar, or **Restart to update** in the tray menu. On Android, open **Updates** from the edge tray and tap **Update**.

## Installing

**Android**: download the `.apk` on your phone and open it. If Android asks, allow installing apps from your browser or Files. If Play Protect asks about the app, tap **More details** > **Install anyway**.

**Windows**: run `uwucurrency-1.0.2-setup.exe`. It's not signed with a paid certificate, so SmartScreen may warn the first time: **More info** > **Run anyway**.

**Mac**: open the `.dmg` and drag uwuCurrency to Applications. The first time, right-click the app > **Open**. If macOS says it's damaged, run `xattr -cr /Applications/uwuCurrency.app` in Terminal.

**Linux**: `sudo apt install ./uwucurrency-1.0.2-amd64.deb`, or `sudo dnf install ./uwucurrency-1.0.2-x86_64.rpm`. For the AppImage, make it executable and run it.

## What's fixed

### Everywhere
- **Screenshot a page** in **Report a bug** now fills the picture. It used to sit in a corner with blank space around it, most of all on phones.
- **The converter on tablets and wider windows**: beside About, the converter was cut off below From and To. It's whole again, with the result and the Convert button back in view.

### Windows, macOS and Linux
- **Long screenshot** fills the picture too, with no blank space round the page.

### The website, installed as an app
- **No more Back, Reload and Forward buttons** in the window's title bar when you install currency.uwuapps.org from Edge or Chrome.
