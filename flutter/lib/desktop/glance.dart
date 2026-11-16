// At a glance, outside the window (docs/desktop-features-spec.md §9), for rates: the spec's "live
// item" is a currency pair.
//
// - The tray rate: one pair followed outside the window. "SGD → MYR", then 1 SGD in MYR and 100
//   SGD in MYR, in the tray icon's tooltip (Windows, Linux), and the rate beside the menu bar icon
//   and on the Dock's badge (macOS). Rates change once a working day, so it's read again every
//   ten minutes, and the words are put up again every 30 seconds.
// - Favourites: the pairs converted most lately (up to 10, from History) as the Windows Jump List
//   and taskbar thumbnail buttons, and the macOS Dock menu, through the runner's channel
//   (runner.dart).
//
// Keys: trayStop ({ code: 'SGD-MYR', name: 'SGD → MYR' }, the pair followed, or null), favourites.
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api.dart';
import '../data/currency.dart';
import '../data/history.dart';
import '../features/history/history_card.dart';
import 'desk.dart';
import 'runner.dart';
import 'settings.dart';

/// A pair as the glance surfaces keep it: { code: 'SGD-MYR', name: 'SGD → MYR' }.
Map<String, Object?> pairItem(String from, String to) => {'code': '$from-$to', 'name': '$from → $to'};

/// The pair in an item's code, or null.
(String, String)? pairOf(Object? code) {
  final m = RegExp(r'^([A-Z0-9]{2,10})-([A-Z0-9]{2,10})$').firstMatch('$code');
  return m == null ? null : (m.group(1)!, m.group(2)!);
}

/// The tray tooltip: the pair, then 1 and 100 of it, cut to 127 characters (Windows' most).
String trayText(String from, String to, double? rate, {String date = ''}) {
  final lines = <String>['$from → $to'];
  if (rate == null) {
    lines.add('$from → $to: couldn’t get the rate just now');
  } else {
    lines.add('1 $from = ${formatNumber(rate, maxDecimals: 4)} $to');
    lines.add('100 $from = ${formatNumber(rate * 100, maxDecimals: 2)} $to');
    if (date.isNotEmpty) lines.add('Rates as of ${formatDay(date)}');
  }
  final text = lines.join('\n');
  return text.length <= 127 ? text : '${text.substring(0, 126)}…';
}

/// The pairs converted most lately, each once, newest first.
List<Map<String, Object?>> recentPairs(List<HistoryEntry> history, {int max = 10}) {
  final seen = <String>{};
  final out = <Map<String, Object?>>[];
  for (final e in history) {
    if (!seen.add('${e.from}-${e.to}')) continue;
    out.add(pairItem(e.from, e.to));
    if (out.length >= max) break;
  }
  return out;
}

class Glance {
  Glance._();

  static Timer? _tray;
  static Timer? _fetch;
  static double? _rate;
  static String _date = '';

  /// Set by tray.dart: puts a new tooltip, title or menu up.
  static void Function(String tooltip, String title)? onTray;
  static final ValueNotifier<Map<String, Object?>?> followed = ValueNotifier(null);

  static void start() {
    _tray?.cancel();
    _tray = Timer.periodic(const Duration(seconds: 30), (_) => refreshTray());
    _fetch?.cancel();
    _fetch = Timer.periodic(const Duration(minutes: 10), (_) => _read());
    final stop = DeskSettings.get<Map<String, dynamic>>('trayStop');
    if (stop != null && pairOf(stop['code']) != null) followed.value = stop;
    ConvHistory.I.addListener(_historyChanged);
    _historyChanged();
    _read();
  }

  static String _lastFavs = '';

  static void _historyChanged() {
    final favs = recentPairs(ConvHistory.I.all);
    final key = favs.toString();
    if (key == _lastFavs) return;
    _lastFavs = key;
    DeskSettings.write({'favourites': favs});
    Runner.setFavourites(favs);
  }

  /// Follows a pair in the tray, or stops (null).
  static void follow(String? from, String? to) {
    final v = from == null || to == null ? null : pairItem(from, to);
    DeskSettings.write({'trayStop': v});
    followed.value = v;
    _rate = null;
    _date = '';
    _read();
  }

  static Future<void> _read() async {
    final pair = pairOf(followed.value?['code']);
    if (pair == null) {
      refreshTray();
      return;
    }
    try {
      final r = await Api.rates(pair.$1);
      _rate = pair.$1 == pair.$2 ? 1 : r.rates[pair.$2];
      _date = r.date;
    } catch (_) {
      _rate = null;
    }
    refreshTray();
  }

  static void refreshTray() {
    final pair = pairOf(followed.value?['code']);
    if (pair == null) {
      onTray?.call(Desktop.name, '');
      Runner.setBadge('');
      return;
    }
    final (from, to) = pair;
    onTray?.call(trayText(from, to, _rate, date: _date), _rate == null ? '' : ' $to ${formatNumber(_rate!, maxDecimals: 4)}');
    Runner.setBadge(_rate == null ? '' : formatNumber(_rate!, maxDecimals: _rate! < 10 ? 2 : 0));
  }

  /// The link a favourite opens.
  static String linkOf(Map<String, Object?> item) {
    final p = pairOf(item['code']);
    return p == null ? 'uwu://currency/' : pairLink(p.$1, p.$2);
  }
}
