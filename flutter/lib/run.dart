// uwuCurrency's apps: start-up (main.dart runs it). The store, the native bridge (or the desktop's
// host in its place), the theme, then the app, with the currencies loading behind it. The desktop's extra windows (its
// welcome window, update window and desktop widgets) start here too, from their arguments.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'api/api.dart';
import 'app/app.dart';
import 'app/env.dart';
import 'app/links.dart';
import 'app/state.dart';
import 'data/history.dart';
import 'data/store.dart';
import 'desktop/desktop_main_stub.dart' if (dart.library.io) 'desktop/desktop_main.dart';
import 'features/sync/sync_controller.dart';
import 'features/update/update_bar.dart';
import 'native/bridge.dart';
import 'theme/theme.dart';

/// The app's start-up, for main() and the Playwright suite's entry point (e2e/main_e2e.dart).
Future<void> runUwuCurrency(List<String> args) async {
  WidgetsFlutterBinding.ensureInitialized();
  // A desktop widget's own window runs only its small screen.
  if (Env.desktop && await runDesktopSubWindow(args)) return;

  await Store.open();
  try {
    Env.version = (await PackageInfo.fromPlatform()).version;
  } catch (_) {
    Env.version = '';
  }

  final desktop = Env.desktop && !kIsWeb;
  if (desktop) await desktopBeforeApp(args);
  await Native.start();

  ThemeController.isAndroid = () => Env.android;
  ThemeController.isDesktop = () => Env.desktop;
  ThemeController.I.init();
  Api.watchOffline();
  ConvHistory.I.addListener(SyncController.I.historyChanged);
  // The currencies and the last conversion, while the page draws; a link that came first waits
  // for them.
  unawaited(AppState.I.restore().then((_) => Links.currenciesReady()));

  // Links from the platform: the one that opened the app, and any that come after.
  Native.on('App', 'link', (data) {
    final url = data['url'];
    if (url is String) Links.open(url);
  });
  final launch = await Native.tryCall('App', 'launchLink');
  if (launch?['url'] is String) Links.open(launch!['url'] as String);
  // In the browser (the Playwright suite's build), a sync link in the address.
  if (kIsWeb) {
    final base = Uri.base;
    if (base.fragment.startsWith('sync/')) Links.open(base.toString());
  }

  runApp(const UwuCurrencyApp());

  if (Env.android) AndroidUpdates.I.start();
  if (desktop) await desktopAfterApp(args);
}
