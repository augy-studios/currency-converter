// The converter's state and what can be done to it, ported from main-site/script.js: the
// currencies, the amount and the two currencies (kept under the site's `uwuconvert.state`, in
// the site's shape, labels and all), the last conversion, the graph's base, quotes and range,
// and which conversions are remembered (data/history.dart).
//
// A conversion is remembered once it settles, as on the site: straight away when it was asked
// for (Convert, Enter, Swap, a currency picked), or once the amount has been left alone for
// recordAfter while typing. Opening the app, refreshing, and putting a history entry back in the
// converter don't add one.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../api/api.dart';
import '../data/currency.dart';
import '../data/history.dart';
import '../data/store.dart';

const keyState = 'uwuconvert.state';
const recordAfter = Duration(milliseconds: 1500);

/// How a conversion is to be remembered.
enum Record { none, now, soon }

/// The last conversion shown.
class Conversion {
  const Conversion({required this.amount, required this.from, required this.to, required this.rate, required this.date, this.cached = false});
  final double amount;
  final String from;
  final String to;
  final double rate;
  final String date;

  /// From rates kept on this device, the network being gone.
  final bool cached;
  double get result => amount * rate;
}

/// One currency's line on the graph: its rate (or index) on each of the graph's days.
class GraphSeries {
  const GraphSeries(this.quote, this.values, this.colour);
  final String quote;
  final List<double?> values;
  final int colour;
}

class AppState extends ChangeNotifier {
  AppState._();
  static final AppState I = AppState._();

  /// Every currency the API knows, code → name, in the API's order.
  Map<String, String> currencies = {};
  final Map<String, Currency> meta = {};

  /// True once the currencies have loaded (or failed to): the tours wait for it.
  bool ready = false;
  String? loadError;

  String amountText = '1';
  String from = 'SGD';
  String to = 'MYR';

  Conversion? last;
  bool converting = false;

  /// The rate line turned round (Invert rate), until the next conversion.
  bool inverted = false;

  /// The app is on screen. Always, as there's no sign-in; links and tours ask.
  bool get shown => true;

  /// A sync code from a link that opened the app before it was drawn.
  String? pendingSyncCode;

  /* ---- the graph ---- */

  String graphBase = '';
  List<String> graphQuotes = [];
  String graphRange = '1m';
  List<String> graphDates = [];
  List<GraphSeries> graphSeries = [];
  bool graphIndexed = false;
  bool graphLoading = false;
  String graphStatus = '';

  /// The clock, for tests and screenshots.
  DateTime Function() clock = DateTime.now;

  /// What's on screen changed (a window opened, the page scrolled to a part): the tours listen.
  final StreamController<void> _pageChanges = StreamController<void>.broadcast();
  Stream<void> get pageChanges => _pageChanges.stream;
  void pageChanged() => _pageChanges.add(null);

  Timer? _recordTimer;
  int _convertSeq = 0;
  int _graphSeq = 0;

  @visibleForTesting
  void reset() {
    currencies = {};
    meta.clear();
    ready = false;
    loadError = null;
    amountText = '1';
    from = 'SGD';
    to = 'MYR';
    last = null;
    converting = inverted = false;
    pendingSyncCode = null;
    graphBase = '';
    graphQuotes = [];
    graphRange = '1m';
    graphDates = [];
    graphSeries = [];
    graphLoading = false;
    graphStatus = '';
    _recordTimer?.cancel();
  }

  double get amount => double.tryParse(amountText.replaceAll(',', '').trim()) ?? 0;

  String nameOf(String code) => currencies[code] ?? code;

  /* ---- start-up ---- */

  /// The currencies, then what was converted last time, then a conversion (remembering nothing).
  Future<void> restore() async {
    _loadState();
    try {
      final list = await Api.currencies();
      currencies = {for (final c in list) c.code: c.name};
      meta
        ..clear()
        ..addAll({for (final c in list) c.code: c});
      loadError = list.isEmpty ? 'Could not load currencies.' : null;
    } catch (_) {
      loadError = 'Could not load currencies.';
    }
    ready = true;
    notifyListeners();
    if (currencies.isNotEmpty) await convert();
  }

  void _loadState() {
    final raw = Store.I.get(keyState);
    if (raw == null) return;
    try {
      final s = jsonDecode(raw);
      if (s is! Map) return;
      if (s['amount'] is String && (s['amount'] as String).isNotEmpty) amountText = s['amount'] as String;
      // The site keeps the fields as they read ("SGD — Singapore Dollar"); the code is in them.
      final f = s['from'] is String ? codeFromInput(s['from'] as String, const {}) : '';
      final t = s['to'] is String ? codeFromInput(s['to'] as String, const {}) : '';
      if (f.isNotEmpty) from = f;
      if (t.isNotEmpty) to = t;
    } catch (_) {
      // As if there were nothing kept.
    }
  }

  /// Kept as the site keeps it, so a site's and the app's converter read each other.
  void saveState() {
    Store.I.put(keyState, jsonEncode({'amount': amountText, 'from': optionLabel(from, nameOf(from)), 'to': optionLabel(to, nameOf(to))}));
  }

  /* ---- converting ---- */

  /// Converts what's in the fields, as the site's convert(). Returns an error to show, or null.
  Future<String?> convert({Record record = Record.none}) async {
    final amount = this.amount;
    if (amount <= 0) return 'Enter a valid amount';
    if (!currencies.containsKey(from) || !currencies.containsKey(to)) return 'Choose both currencies';
    final seq = ++_convertSeq;
    inverted = false;

    if (from == to) {
      last = Conversion(amount: amount, from: from, to: to, rate: 1, date: isoDate(clock()));
      notifyListeners();
      _pairChanged();
      _remember(record);
      return null;
    }

    converting = true;
    notifyListeners();
    try {
      final r = await Api.rates(from);
      if (seq != _convertSeq) return null;
      final rate = r.rates[to];
      if (rate == null) return 'Rate not available for $from → $to';
      last = Conversion(amount: amount, from: from, to: to, rate: rate, date: r.date, cached: r.cached);
      _pairChanged();
      _remember(record);
      return null;
    } catch (_) {
      return 'Failed to fetch rates. Try refresh.';
    } finally {
      if (seq == _convertSeq) {
        converting = false;
        notifyListeners();
      }
    }
  }

  void _remember(Record how) {
    _recordTimer?.cancel();
    final c = last;
    if (c == null || how == Record.none) return;
    void keep() => ConvHistory.I.record(amount: c.amount, from: c.from, to: c.to, rate: c.rate, date: c.date, now: clock());
    if (how == Record.now) {
      keep();
    } else {
      _recordTimer = Timer(recordAfter, keep);
    }
  }

  void setAmount(String text) {
    amountText = text;
    saveState();
  }

  void setFrom(String code) {
    if (!currencies.containsKey(code)) return;
    from = code;
    saveState();
    notifyListeners();
  }

  void setTo(String code) {
    if (!currencies.containsKey(code)) return;
    to = code;
    saveState();
    notifyListeners();
  }

  Future<String?> swap() {
    final a = from;
    from = to;
    to = a;
    saveState();
    notifyListeners();
    return convert(record: Record.now);
  }

  /// Invert rate: the rate line as 1 `to` in `from`. Null when there's nothing converted yet.
  String? invert() {
    if (last == null) return 'Convert first';
    inverted = !inverted;
    notifyListeners();
    return null;
  }

  /// "1 SGD = 3.269231 MYR", or turned round.
  String get rateLine {
    final c = last;
    if (c == null) return '—';
    return inverted ? '1 ${c.to} = ${formatNumber(1 / c.rate)} ${c.from}' : '1 ${c.from} = ${formatNumber(c.rate)} ${c.to}';
  }

  /// A history entry put back in the converter, converted again at today's rate, without
  /// adding another entry. False when one of its currencies isn't offered any more.
  Future<bool> applyHistory(HistoryEntry e) async {
    if (!currencies.containsKey(e.from) || !currencies.containsKey(e.to)) return false;
    amountText = formatNumber(e.amount).replaceAll(',', '');
    from = e.from;
    to = e.to;
    saveState();
    notifyListeners();
    await convert();
    return true;
  }

  /// Shared words ("50 USD"): the amount and currency put in From. True if they were read.
  bool applySharedText(String text) {
    final parsed = parseSharedText(text, currencies);
    if (parsed == null) return false;
    amountText = formatNumber(parsed.amount).replaceAll(',', '');
    from = parsed.code;
    saveState();
    notifyListeners();
    return true;
  }

  /// A pair from a link: uwu://currency/pair/SGD/MYR[/100].
  Future<bool> applyPair(String f, String t, {double? amount}) async {
    if (!currencies.containsKey(f) || !currencies.containsKey(t)) return false;
    from = f;
    to = t;
    if (amount != null && amount > 0) amountText = formatNumber(amount).replaceAll(',', '');
    saveState();
    notifyListeners();
    await convert(record: Record.now);
    return true;
  }

  /* ---- the graph ---- */

  // The pickers settled on a new pair: the graph follows that pair; adding and removing
  // currencies changes it from there until the next pair.
  void _pairChanged() {
    if (from == graphBase && graphQuotes.isNotEmpty && graphQuotes.first == to) return;
    graphBase = from;
    graphQuotes = [to];
    loadGraph();
  }

  String? addGraphQuote(String code) {
    if (code.isEmpty || code == graphBase || graphQuotes.contains(code) || !currencies.containsKey(code)) return null;
    if (graphQuotes.length >= maxGraphQuotes) return 'Up to $maxGraphQuotes currencies at once';
    graphQuotes = [...graphQuotes, code];
    loadGraph();
    return null;
  }

  String? removeGraphQuote(String code) {
    if (graphQuotes.length <= 1) return 'Keep at least one currency';
    graphQuotes = graphQuotes.where((c) => c != code).toList();
    loadGraph();
    return null;
  }

  void setRange(String range) {
    if (!graphRanges.contains(range) || range == graphRange) return;
    graphRange = range;
    loadGraph();
  }

  Future<void> loadGraph() async {
    if (graphBase.isEmpty || graphQuotes.isEmpty) return;
    final seq = ++_graphSeq;
    graphLoading = true;
    graphStatus = 'Loading…';
    notifyListeners();
    try {
      final fromDate = computeFromDate(graphRange, clock(), starts: [graphBase, ...graphQuotes].map((c) => meta[c]?.startDate));
      final rows = await Api.history(graphBase, graphQuotes, fromDate, group: groupFor(graphRange));
      if (seq != _graphSeq) return;
      final series = <String, Map<String, double>>{};
      final dates = <String>{};
      for (final r in rows) {
        (series[r.quote] ??= {})[r.date] = r.rate;
        dates.add(r.date);
      }
      graphDates = dates.toList()..sort();
      final shown = graphQuotes.where(series.containsKey).toList();
      graphIndexed = shown.length > 1;
      graphSeries = [
        for (var i = 0; i < shown.length; i++)
          GraphSeries(
            shown[i],
            indexSeries([for (final d in graphDates) series[shown[i]]![d]], indexed: graphIndexed),
            chartColours[graphQuotes.indexOf(shown[i]) % chartColours.length],
          ),
      ];
      graphStatus = graphIndexed ? 'Comparing 2+ currencies indexes each to 100 at the start of the range.' : '';
    } catch (_) {
      if (seq != _graphSeq) return;
      graphStatus = 'Could not load historical rates.';
    } finally {
      if (seq == _graphSeq) {
        graphLoading = false;
        notifyListeners();
      }
    }
  }
}
