// Conversion history, ported from main-site/js/history.js with its key, shape and rules unchanged,
// so the app and the site keep the same list and share it with each other (features/sync/):
//
//   uwuconvert.history: [{ id, at, amount, from, to, rate, result, date }], newest first, at most
//   500. An entry never changes once made, so merging another device's is a union by id.
//
// A conversion is remembered once it settles (AppState): asked for, or left alone a moment while
// typing. The same pair again within REPLACE_MS replaces the last entry, with a new id; exactly
// the last one again adds nothing.
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import 'currency.dart';
import 'store.dart';

const historyKey = 'uwuconvert.history';
const historyMax = 500;
const historyReplaceMs = 10000;

final _codeRe = RegExp(r'^[A-Z0-9]{2,10}$');
final _idRe = RegExp(r'^[A-Za-z0-9_-]{6,64}$');
final _dateRe = RegExp(r'^\d{4}-\d{2}-\d{2}$');
const _idAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

class HistoryEntry {
  const HistoryEntry({
    required this.id,
    required this.at,
    required this.amount,
    required this.from,
    required this.to,
    required this.rate,
    required this.result,
    this.date = '',
  });

  final String id;

  /// When it was converted, in ms since 1970.
  final int at;
  final double amount;
  final String from;
  final String to;
  final double rate;
  final double result;

  /// The day the rate is from, or ''.
  final String date;

  Map<String, Object> toJson() => {'id': id, 'at': at, 'amount': amount, 'from': from, 'to': to, 'rate': rate, 'result': result, 'date': date};

  /// "100 SGD → 326.92 MYR"
  String get line => '${formatNumber(amount, maxDecimals: 2)} $from → ${formatNumber(result, maxDecimals: 2)} $to';

  /// "1 SGD = 3.269231 MYR · 16 Nov 2026, 14:05"
  String get sub => '1 $from = ${formatNumber(rate)} $to · ${formatWhen(DateTime.fromMillisecondsSinceEpoch(at))}';
}

double? _num(Object? v) => v is num && v.isFinite ? v.toDouble() : null;

/// One entry from storage or another device, checked field by field; null if it isn't one.
HistoryEntry? cleanEntry(Object? raw) {
  if (raw is! Map) return null;
  final id = raw['id'], from = raw['from'], to = raw['to'];
  final amount = _num(raw['amount']), rate = _num(raw['rate']), at = _num(raw['at']);
  if (id is! String || !_idRe.hasMatch(id) || from is! String || !_codeRe.hasMatch(from) || to is! String || !_codeRe.hasMatch(to)) return null;
  if (amount == null || amount < 0 || amount >= 1e15) return null;
  if (rate == null || rate <= 0 || rate >= 1e12) return null;
  if (at == null || at <= 0 || at >= 8.64e15) return null;
  final result = _num(raw['result']);
  final date = raw['date'];
  return HistoryEntry(
    id: id,
    at: at.floor(),
    amount: amount,
    from: from,
    to: to,
    rate: rate,
    result: result != null && result >= 0 ? result : amount * rate,
    date: date is String && _dateRe.hasMatch(date) ? date : '',
  );
}

/// Newest first; the same moment by id, so every device orders a list the same way.
int _order(HistoryEntry a, HistoryEntry b) {
  final t = b.at.compareTo(a.at);
  return t != 0 ? t : a.id.compareTo(b.id);
}

/// A list from storage or another device: clean entries, each id once, newest first, capped.
/// Null when it isn't a list at all.
List<HistoryEntry>? cleanHistory(Object? raw) {
  if (raw is! List) return null;
  final seen = <String>{};
  final out = <HistoryEntry>[];
  for (final r in raw.take(historyMax * 2)) {
    final e = cleanEntry(r);
    if (e == null || !seen.add(e.id)) continue;
    out.add(e);
  }
  out.sort(_order);
  return out.length > historyMax ? out.sublist(0, historyMax) : out;
}

String makeHistoryId([math.Random? random]) {
  final r = random ?? math.Random.secure();
  return [for (var i = 0; i < 12; i++) _idAlphabet[r.nextInt(_idAlphabet.length)]].join();
}

class ConvHistory extends ChangeNotifier {
  ConvHistory._();
  static final ConvHistory I = ConvHistory._();

  /// For tests: ids made in order.
  @visibleForTesting
  String Function() makeId = makeHistoryId;

  List<HistoryEntry> get all {
    try {
      return cleanHistory(jsonDecode(Store.I.get(historyKey) ?? '[]')) ?? const [];
    } catch (_) {
      return const [];
    }
  }

  void _save(List<HistoryEntry> list) {
    final kept = list.length > historyMax ? list.sublist(0, historyMax) : list;
    Store.I.put(historyKey, jsonEncode([for (final e in kept) e.toJson()]));
    notifyListeners();
  }

  /// A conversion that settled. Returns the entry kept, or null if it wasn't one.
  HistoryEntry? record({required double amount, required String from, required String to, required double rate, String date = '', DateTime? now}) {
    final at = (now ?? DateTime.now()).millisecondsSinceEpoch;
    final entry = cleanEntry({'id': makeId(), 'at': at, 'amount': amount, 'from': from, 'to': to, 'rate': rate, 'result': amount * rate, 'date': date});
    if (entry == null) return null;
    final list = [...all];
    final last = list.isEmpty ? null : list.first;
    if (last != null && last.from == entry.from && last.to == entry.to && at - last.at < historyReplaceMs) {
      // The same pair a moment ago: this one's the settled version of it, in its place, with a
      // new id, so an entry never changes once made, even one already copied elsewhere.
      list[0] = entry;
    } else if (last != null && last.from == entry.from && last.to == entry.to && last.amount == entry.amount && last.rate == entry.rate) {
      // Exactly the last one again: nothing new to remember.
      return last;
    } else {
      list.insert(0, entry);
    }
    _save(list);
    return entry;
  }

  /// Entries from another device, merged in. Says how many were new here.
  int merge(Object? entries) {
    final list = [...all];
    final have = {for (final e in list) e.id};
    final fresh = (cleanHistory(entries) ?? const <HistoryEntry>[]).where((e) => !have.contains(e.id)).toList();
    if (fresh.isNotEmpty) _save([...list, ...fresh]..sort(_order));
    return fresh.length;
  }

  void remove(String id) => _save(all.where((e) => e.id != id).toList());

  void clear() => _save(const []);

  /// Something else wrote the key (a widget window, a test).
  void changed() => notifyListeners();
}
