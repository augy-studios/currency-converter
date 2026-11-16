// The runner's own channel (docs/flutter-desktop-app-spec.md §2.7), for what no package does:
//   Windows  the Jump List (the pairs converted lately), the taskbar's thumbnail buttons, and
//            the Fluent 2 look's Mica
//            (windows/runner/flutter_window.cpp)
//   macOS    the Dock menu and badge, and the Tahoe look's glass (macos/Runner/AppDelegate.swift)
// Events back: 'thumb' with a button id or link, 'dock' with a pair's code, 'open' with a link and
// 'activate' (macOS). Where the runner has no channel
// (Linux), every call is quietly nothing.
import 'package:flutter/services.dart';

import 'glance.dart';

class Runner {
  Runner._();

  static const _channel = MethodChannel('org.uwuapps.currency/desktop');

  /// Set by desktop_main.dart.
  static void Function(String id)? onThumb;
  static void Function(String code)? onDock;

  /// A link opened from elsewhere (macOS), or a click on the Dock icon (`null`).
  static void Function(String? link)? onOpen;

  static void listen() {
    _channel.setMethodCallHandler((call) async {
      final args = call.arguments;
      switch (call.method) {
        case 'thumb':
          onThumb?.call('$args');
        case 'dock':
          onDock?.call('$args');
        case 'open':
          onOpen?.call(args is String ? args : null);
        case 'activate':
          onOpen?.call(null);
      }
      return null;
    });
  }

  static Future<void> _call(String method, [Object? args]) async {
    try {
      await _channel.invokeMethod(method, args);
    } catch (_) {
      // Not on this system.
    }
  }

  /// The favourite pairs, [{ code, name }], for the Jump List, thumbnail buttons and Dock menu.
  static Future<void> setFavourites(List<Map<String, Object?>> favs) => _call('setFavourites', {
    'items': [
      for (final f in favs) {'id': '${f['code']}', 'name': '${f['name']}', 'link': Glance.linkOf(f)},
    ],
  });

  /// The glass look's material behind the window: Mica on Windows 11, NSVisualEffectView on
  /// macOS. True when the system put it there; false (Linux, Windows 10, an error) means the
  /// app paints its own backdrop.
  static Future<bool> setGlass({required bool on, required bool dark}) async {
    try {
      return await _channel.invokeMethod<bool>('setGlass', {'on': on, 'dark': dark}) ?? false;
    } catch (_) {
      return false;
    }
  }

  /// The Dock's badge (macOS): a few characters, or '' for none.
  static Future<void> setBadge(String text) => _call('setBadge', text);
}
