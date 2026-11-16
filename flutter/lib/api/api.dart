// The site's own API (main-site/api/*), called as the site's script.js calls it: the currencies,
// the latest rates for a base, and the rates over time for the graph, each answer kept on this
// device so the converter opens and converts offline with the last rates it saw (as the site's
// service worker keeps its /api answers). Plus one notifier for whether the network is there at
// all, which the offline bar listens to.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../data/currency.dart';
import '../data/store.dart';

/// The site's host: the API's base, the links the app opens, and the update check.
const siteHost = 'currency.uwuapps.org';
const siteOrigin = 'https://$siteHost';

/// The Play build: no updater of its own (--dart-define=UWUCURRENCY_PLAY=true).
const isPlayBuild = bool.fromEnvironment('UWUCURRENCY_PLAY');

/// Where an answer is kept, under the app's own keys (not the site's: these are a cache).
const _cachePrefix = 'app.cache.';

class ApiError implements Exception {
  ApiError(this.message, {this.status = 0});
  final String message;

  /// The HTTP status, or 0 when the server was never reached.
  final int status;
  bool get offline => status == 0;

  @override
  String toString() => message;
}

class Api {
  Api._();

  /// For tests: answers instead of the network.
  static http.Client client = http.Client();

  /// True while the last request couldn't reach the server.
  static final ValueNotifier<bool> offline = ValueNotifier(false);

  static Uri uri(String path) => Uri.parse('$siteOrigin/api$path');

  static Future<Map<String, dynamic>> call(String method, String path, [Map<String, dynamic>? body]) async {
    final req = http.Request(method, uri(path));
    req.headers['Content-Type'] = 'application/json';
    if (body != null) req.body = jsonEncode(body);
    late final http.Response res;
    try {
      res = await http.Response.fromStream(await client.send(req).timeout(const Duration(seconds: 30)));
    } catch (_) {
      offline.value = true;
      throw ApiError('No connection', status: 0);
    }
    offline.value = false;
    Map<String, dynamic> data;
    try {
      final v = jsonDecode(utf8.decode(res.bodyBytes));
      data = v is Map ? Map<String, dynamic>.from(v) : {};
    } catch (_) {
      data = {};
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiError('${data['error'] ?? 'Request failed'}', status: res.statusCode);
    }
    return data;
  }

  /// Bytes from a route that answers with an image.
  static Future<({Uint8List bytes, String type})> bytes(String path) async {
    late final http.Response res;
    try {
      res = await client.get(uri(path)).timeout(const Duration(seconds: 30));
    } catch (_) {
      offline.value = true;
      throw ApiError('No connection', status: 0);
    }
    offline.value = false;
    if (res.statusCode != 200) throw ApiError('HTTP ${res.statusCode}', status: res.statusCode);
    return (bytes: res.bodyBytes, type: (res.headers['content-type'] ?? 'image/png').split(';').first.trim());
  }

  /// A GET whose answer is JSON of any shape, kept on this device. Offline, or with the server
  /// failing, the last answer kept for the same address is given instead, marked `cached`.
  static Future<({Object? data, bool cached})> getJson(String path) async {
    // The graph's answers differ with every range and pair: only the latest is kept, with the
    // address it answered.
    final graph = path.startsWith('/history');
    final key = graph ? '${_cachePrefix}history' : '$_cachePrefix$path';
    try {
      final res = await client.get(uri(path), headers: const {'Accept': 'application/json'}).timeout(const Duration(seconds: 20));
      offline.value = false;
      if (res.statusCode != 200) throw ApiError('HTTP ${res.statusCode}', status: res.statusCode);
      final body = utf8.decode(res.bodyBytes);
      final data = jsonDecode(body);
      try {
        Store.I.put(key, graph ? jsonEncode({'path': path, 'body': body}) : body);
      } catch (_) {
        // Not kept: the next offline open has one fewer answer.
      }
      return (data: data, cached: false);
    } catch (e) {
      if (e is! ApiError) offline.value = true;
      final kept = Store.isOpen ? Store.I.get(key) : null;
      if (kept != null) {
        try {
          if (!graph) return (data: jsonDecode(kept), cached: true);
          final g = jsonDecode(kept);
          if (g is Map && g['path'] == path && g['body'] is String) return (data: jsonDecode(g['body'] as String), cached: true);
        } catch (_) {}
      }
      if (e is ApiError) rethrow;
      throw ApiError('No connection', status: 0);
    }
  }

  /// /api/currencies: every currency, as the API lists them.
  static Future<List<Currency>> currencies() async {
    final r = await getJson('/currencies');
    final list = r.data is List ? r.data as List : const [];
    return [for (final c in list) ?Currency.fromJson(c)];
  }

  /// /api/rates?base=: the latest rate to every other currency, and the day it's from.
  static Future<({Map<String, double> rates, String date, bool cached})> rates(String base) async {
    final r = await getJson('/rates?base=${Uri.encodeQueryComponent(base)}');
    final rates = <String, double>{};
    var date = '';
    for (final row in r.data is List ? r.data as List : const []) {
      if (row is! Map || row['quote'] is! String || row['rate'] is! num) continue;
      rates[row['quote'] as String] = (row['rate'] as num).toDouble();
      if (row['date'] is String) date = row['date'] as String;
    }
    return (rates: rates, date: date, cached: r.cached);
  }

  /// /api/history: each quote's rate on each day from `from`, grouped by week or month for
  /// long ranges. Rows of { date, quote, rate }.
  static Future<List<({String date, String quote, double rate})>> history(String base, List<String> quotes, String from, {String group = ''}) async {
    final q = 'base=${Uri.encodeQueryComponent(base)}&quotes=${quotes.map(Uri.encodeQueryComponent).join(',')}&from=$from${group.isEmpty ? '' : '&group=$group'}';
    final r = await getJson('/history?$q');
    return [
      for (final row in r.data is List ? r.data as List : const [])
        if (row is Map && row['date'] is String && row['quote'] is String && row['rate'] is num)
          (date: row['date'] as String, quote: row['quote'] as String, rate: (row['rate'] as num).toDouble()),
    ];
  }

  /// Asks again, quietly, until the network is back. Started once, as the app opens.
  static Timer? _probe;
  static bool _watching = false;
  static void watchOffline() {
    if (_watching) return;
    _watching = true;
    offline.addListener(() {
      _probe?.cancel();
      if (!offline.value) return;
      _probe = Timer.periodic(const Duration(seconds: 15), (t) async {
        try {
          await client.head(Uri.parse('$siteOrigin/manifest.json')).timeout(const Duration(seconds: 8));
          offline.value = false;
          t.cancel();
        } catch (_) {
          // Still gone.
        }
      });
    });
  }
}
