// The converter's logic, ported from main-site/script.js with its names and rules unchanged:
// reading a currency from what's typed (a code or a name), reading an amount and a currency out
// of shared words ("50 USD", "$12"), the graph's ranges, and the site's number formats.
// test/logic_test.dart checks each against the site's own answers.

/// A currency as the API lists it (/api/currencies).
class Currency {
  const Currency(this.code, this.name, {this.symbol, this.startDate});
  final String code;
  final String name;
  final String? symbol;

  /// The first day the API has its rates for (YYYY-MM-DD), for the graph's Max.
  final String? startDate;

  static Currency? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final code = raw['iso_code'];
    final name = raw['name'];
    if (code is! String || name is! String || !RegExp(r'^[A-Z0-9]{2,10}$').hasMatch(code)) return null;
    return Currency(code, name, symbol: raw['symbol'] is String ? raw['symbol'] as String : null, startDate: raw['start_date'] is String ? raw['start_date'] as String : null);
  }
}

/// The site's datalist label: "SGD — Singapore Dollar".
String optionLabel(String code, String name) => '$code — $name';

/// What's typed or picked, as a currency code: a three-letter code in it ("SGD — Singapore
/// Dollar", "sgd" isn't one), else a code or name matched whole, any case. '' when it's neither.
String codeFromInput(String value, Map<String, String> currencies) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '';
  final m = RegExp(r'\b([A-Z]{3})\b').firstMatch(trimmed);
  if (m != null) return m.group(1)!;
  final lower = trimmed.toLowerCase();
  for (final e in currencies.entries) {
    if (e.key.toLowerCase() == lower || e.value.toLowerCase() == lower) return e.key;
  }
  return '';
}

/// Currencies whose code or name contains what's typed, codes that start with it first: the
/// currency picker's list (the site's datalist filters the same way).
List<String> searchCurrencies(String query, Map<String, String> currencies) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return currencies.keys.toList();
  final starts = <String>[];
  final contains = <String>[];
  for (final e in currencies.entries) {
    final code = e.key.toLowerCase();
    final name = e.value.toLowerCase();
    if (code.startsWith(q)) {
      starts.add(e.key);
    } else if (code.contains(q) || name.contains(q) || optionLabel(e.key, e.value).toLowerCase().contains(q)) {
      contains.add(e.key);
    }
  }
  return [...starts, ...contains];
}

/// The symbols the site reads in shared words.
const shareSymbols = {r'$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR'};

/// An amount and a currency in shared words: "50 USD", "usd 50", "1,200.50 EUR", "$12", "12€".
/// Null when there's neither a known code nor a known symbol beside a number.
({double amount, String code})? parseSharedText(String text, Map<String, String> currencies) {
  if (text.isEmpty) return null;
  final codeRe = RegExp(r'\b(\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3})\b|\b([A-Za-z]{3})\s*(\d[\d,]*(?:\.\d+)?)\b');
  final cm = codeRe.firstMatch(text);
  if (cm != null) {
    final amount = cm.group(1) ?? cm.group(4)!;
    final code = (cm.group(2) ?? cm.group(3) ?? '').toUpperCase();
    if (currencies.containsKey(code)) return (amount: double.parse(amount.replaceAll(',', '')), code: code);
  }
  final symRe = RegExp(r'([$€£¥₹])\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*([$€£¥₹])');
  final sm = symRe.firstMatch(text);
  if (sm != null) {
    final amount = sm.group(2) ?? sm.group(3)!;
    final code = shareSymbols[sm.group(1) ?? sm.group(4)];
    if (code != null && currencies.containsKey(code)) return (amount: double.parse(amount.replaceAll(',', '')), code: code);
  }
  return null;
}

/* ---- the graph ---- */

const graphRanges = ['5d', '1w', '1m', '1y', '5y', 'max'];
const graphRangeLabels = {'5d': '5D', '1w': '1W', '1m': '1M', '1y': '1Y', '5y': '5Y', 'max': 'Max'};
const maxGraphQuotes = 6;
const fallbackStartDate = '1999-01-04';

/// The series' colours, in the site's fixed order (never cycled or reassigned: the order is
/// what keeps neighbours apart for colour-blind readers).
const chartColours = [0xFF2A78D6, 0xFF008300, 0xFFE87BA4, 0xFFEDA100, 0xFF1BAF7A, 0xFFEB6834, 0xFF4A3AA7, 0xFFE34948];

String isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// The first day a range shows, as the site's computeFromDate(). `starts` are the shown
/// currencies' first days, for Max, which begins at the latest of them.
String computeFromDate(String range, DateTime today, {Iterable<String?> starts = const []}) {
  // As JS's setDate/setMonth/setFullYear do, overflowing into the next month where it must.
  switch (range) {
    case '5d':
      return isoDate(DateTime(today.year, today.month, today.day - 5));
    case '1w':
      return isoDate(DateTime(today.year, today.month, today.day - 7));
    case '1y':
      return isoDate(DateTime(today.year - 1, today.month, today.day));
    case '5y':
      return isoDate(DateTime(today.year - 5, today.month, today.day));
    case 'max':
      final s = starts.whereType<String>().where((x) => x.isNotEmpty).toList();
      if (s.isEmpty) return fallbackStartDate;
      return s.reduce((a, b) => a.compareTo(b) > 0 ? a : b);
    case '1m':
    default:
      return isoDate(DateTime(today.year, today.month - 1, today.day));
  }
}

/// How the API groups a range's days: by week for a year, by month for five or more.
String groupFor(String range) {
  if (range == '1y') return 'week';
  if (range == '5y' || range == 'max') return 'month';
  return '';
}

/// A series' points: the rate on each day, or, comparing more than one, the rate as a share of
/// its first, times 100, so currencies of very different sizes (yen and ringgit) line up.
List<double?> indexSeries(List<double?> raw, {required bool indexed}) {
  if (!indexed) return raw;
  final base = raw.firstWhere((v) => v != null, orElse: () => null);
  if (base == null || base == 0) return raw;
  return [for (final v in raw) v == null ? null : v / base * 100];
}

/* ---- numbers ---- */

/// A number as the site writes it: digits grouped in threes, at most `maxDecimals` after the
/// point, trailing zeros dropped (Intl.NumberFormat with maximumFractionDigits).
String formatNumber(num value, {int maxDecimals = 6}) {
  if (value.isNaN || value.isInfinite) return '—';
  final negative = value < 0;
  var fixed = value.abs().toStringAsFixed(maxDecimals);
  if (fixed.contains('e')) return value.toString();
  var whole = fixed;
  var frac = '';
  final dot = fixed.indexOf('.');
  if (dot >= 0) {
    whole = fixed.substring(0, dot);
    frac = fixed.substring(dot + 1).replaceFirst(RegExp(r'0+$'), '');
  }
  final groups = <String>[];
  for (var i = whole.length; i > 0; i -= 3) {
    groups.insert(0, whole.substring(i - 3 < 0 ? 0 : i - 3, i));
  }
  final grouped = groups.join(',');
  final out = frac.isEmpty ? grouped : '$grouped.$frac';
  return negative && out != '0' ? '-$out' : out;
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// "13 Nov 2026" for a YYYY-MM-DD day, as it is (no time zone moves it).
String formatDay(String iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(iso);
  if (m == null) return iso;
  return '${int.parse(m.group(3)!)} ${_months[int.parse(m.group(2)!) - 1]} ${m.group(1)}';
}

/// "16 Nov 2026, 14:05" for a moment, in this device's time.
String formatWhen(DateTime t) {
  final l = t.toLocal();
  return '${l.day} ${_months[l.month - 1]} ${l.year}, ${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}
