// The logic ported from the site (data/currency.dart from main-site/script.js, data/history.dart
// from main-site/js/history.js), checked against the answers the site's own code gives for the
// same inputs, so the app and the site never drift. The expected values here were read off the
// site's functions in a browser (flutter/e2e/tests/site.spec.js checks the site side).
import 'package:flutter_test/flutter_test.dart';
import 'package:uwucurrency/data/currency.dart';
import 'package:uwucurrency/data/history.dart';
import 'package:uwucurrency/data/store.dart';
import 'package:uwucurrency/desktop/glance.dart' show pairOf, recentPairs, trayText;

const _currencies = {
  'SGD': 'Singapore Dollar',
  'MYR': 'Malaysian Ringgit',
  'USD': 'United States Dollar',
  'EUR': 'Euro',
  'JPY': 'Japanese Yen',
  'GBP': 'British Pound',
  'INR': 'Indian Rupee',
};

void main() {
  group('codeFromInput, as the site reads its currency fields', () {
    test('a label, a code, a name', () {
      expect(codeFromInput('SGD — Singapore Dollar', _currencies), 'SGD');
      expect(codeFromInput('usd', _currencies), 'USD');
      expect(codeFromInput('  euro ', _currencies), 'EUR');
      expect(codeFromInput('Japanese yen', _currencies), 'JPY');
      expect(codeFromInput('dollar', _currencies), '');
      expect(codeFromInput('', _currencies), '');
    });
  });

  group('searchCurrencies, the picker', () {
    test('codes starting with it first, then names containing it', () {
      expect(searchCurrencies('us', _currencies).first, 'USD');
      expect(searchCurrencies('dollar', _currencies), ['SGD', 'USD']);
      expect(searchCurrencies('', _currencies).length, _currencies.length);
      expect(searchCurrencies('zzz', _currencies), isEmpty);
    });
  });

  group('parseSharedText, the share target', () {
    test('codes either side of the number, with thousands', () {
      expect(parseSharedText('That is 50 USD please', _currencies), (amount: 50.0, code: 'USD'));
      expect(parseSharedText('eur 1,200.50', _currencies), (amount: 1200.5, code: 'EUR'));
      expect(parseSharedText('12 sgd', _currencies), (amount: 12.0, code: 'SGD'));
    });
    test('symbols', () {
      expect(parseSharedText(r'only $12!', _currencies), (amount: 12.0, code: 'USD'));
      expect(parseSharedText('12€', _currencies), (amount: 12.0, code: 'EUR'));
      expect(parseSharedText('£3.50 each', _currencies), (amount: 3.5, code: 'GBP'));
    });
    test('nothing it knows', () {
      expect(parseSharedText('50 XYZ', _currencies), isNull);
      expect(parseSharedText('hello', _currencies), isNull);
      expect(parseSharedText('', _currencies), isNull);
    });
  });

  group('the graph', () {
    final today = DateTime(2026, 3, 31);
    test('computeFromDate, overflowing as JS dates do', () {
      expect(computeFromDate('5d', today), '2026-03-26');
      expect(computeFromDate('1w', today), '2026-03-24');
      // 31 March less a month is "31 February", which JS (and Dart) roll on to 3 March.
      expect(computeFromDate('1m', today), '2026-03-03');
      expect(computeFromDate('1y', today), '2025-03-31');
      expect(computeFromDate('5y', today), '2021-03-31');
      expect(computeFromDate('max', today, starts: ['1999-01-04', '2005-07-01', null]), '2005-07-01');
      expect(computeFromDate('max', today), fallbackStartDate);
    });
    test('groupFor', () {
      expect(groupFor('1m'), '');
      expect(groupFor('1y'), 'week');
      expect(groupFor('max'), 'month');
    });
    test('indexSeries: 100 at its first value, gaps kept', () {
      expect(indexSeries([null, 2, 3, null, 4], indexed: true), [null, 100, 150, null, 200]);
      expect(indexSeries([2, 3], indexed: false), [2, 3]);
    });
  });

  group('numbers, as Intl.NumberFormat writes them', () {
    test('grouped, trimmed, at most six places', () {
      expect(formatNumber(1), '1');
      expect(formatNumber(1234567.891), '1,234,567.891');
      expect(formatNumber(3.2692307692), '3.269231');
      expect(formatNumber(0.1 + 0.2), '0.3');
      expect(formatNumber(326.92307, maxDecimals: 2), '326.92');
      expect(formatNumber(-1500), '-1,500');
    });
    test('days', () {
      expect(formatDay('2026-11-13'), '13 Nov 2026');
      expect(formatDay('nope'), 'nope');
    });
  });

  group('history, as js/history.js keeps it', () {
    setUp(() {
      Store.memory();
      var n = 0;
      ConvHistory.I.makeId = () => 'entry${(++n).toString().padLeft(7, '0')}';
    });

    final t0 = DateTime(2026, 11, 16, 14, 0);

    test('a conversion is kept, newest first', () {
      ConvHistory.I.record(amount: 100, from: 'SGD', to: 'MYR', rate: 3.25, date: '2026-11-13', now: t0);
      ConvHistory.I.record(amount: 5, from: 'USD', to: 'JPY', rate: 154, now: t0.add(const Duration(minutes: 1)));
      final all = ConvHistory.I.all;
      expect(all.map((e) => e.from), ['USD', 'SGD']);
      expect(all.last.result, 325);
      expect(all.last.line, '100 SGD → 325 MYR');
    });

    test('the same pair a moment later replaces it, with a new id', () {
      ConvHistory.I.record(amount: 1, from: 'SGD', to: 'MYR', rate: 3.25, now: t0);
      ConvHistory.I.record(amount: 100, from: 'SGD', to: 'MYR', rate: 3.25, now: t0.add(const Duration(seconds: 3)));
      final all = ConvHistory.I.all;
      expect(all, hasLength(1));
      expect(all.single.amount, 100);
      expect(all.single.id, 'entry0000002');
    });

    test('exactly the last one again, later, adds nothing; a new amount does', () {
      ConvHistory.I.record(amount: 100, from: 'SGD', to: 'MYR', rate: 3.25, now: t0);
      ConvHistory.I.record(amount: 100, from: 'SGD', to: 'MYR', rate: 3.25, now: t0.add(const Duration(minutes: 5)));
      expect(ConvHistory.I.all, hasLength(1));
      ConvHistory.I.record(amount: 200, from: 'SGD', to: 'MYR', rate: 3.25, now: t0.add(const Duration(minutes: 6)));
      expect(ConvHistory.I.all, hasLength(2));
    });

    test('another device\'s entries: checked, merged by id, never overwriting', () {
      ConvHistory.I.record(amount: 100, from: 'SGD', to: 'MYR', rate: 3.25, now: t0);
      final mine = ConvHistory.I.all.single;
      final n = ConvHistory.I.merge([
        {'id': mine.id, 'at': 1, 'amount': 9, 'from': 'EUR', 'to': 'GBP', 'rate': 0.8},
        {'id': 'otherDevice1', 'at': t0.millisecondsSinceEpoch + 1, 'amount': 2, 'from': 'EUR', 'to': 'JPY', 'rate': 179.3},
        {'id': '<script>', 'at': 1, 'amount': 2, 'from': 'EUR', 'to': 'JPY', 'rate': 1},
        {'id': 'badAmount001', 'at': 1, 'amount': -2, 'from': 'EUR', 'to': 'JPY', 'rate': 1},
        'nonsense',
      ]);
      expect(n, 1);
      final all = ConvHistory.I.all;
      expect(all.map((e) => e.id), ['otherDevice1', mine.id]);
      expect(all.last.amount, 100);
      expect(all.first.result, closeTo(358.6, 1e-9));
    });

    test('cleanHistory: newest first, ties by id, each id once, capped', () {
      final raw = [
        for (var i = 0; i < historyMax + 20; i++) {'id': 'id${i.toString().padLeft(6, '0')}', 'at': 1000 + (i ~/ 2), 'amount': 1, 'from': 'SGD', 'to': 'USD', 'rate': 0.77},
      ];
      final out = cleanHistory(raw)!;
      expect(out, hasLength(historyMax));
      expect(out.first.at, greaterThanOrEqualTo(out.last.at));
      expect(out[0].id.compareTo(out[1].id), lessThan(0));
      expect(cleanHistory('no'), isNull);
    });

    test('remove and clear', () {
      ConvHistory.I.record(amount: 1, from: 'SGD', to: 'MYR', rate: 3.25, now: t0);
      ConvHistory.I.record(amount: 1, from: 'USD', to: 'MYR', rate: 4.25, now: t0.add(const Duration(minutes: 1)));
      ConvHistory.I.remove(ConvHistory.I.all.first.id);
      expect(ConvHistory.I.all.single.from, 'SGD');
      ConvHistory.I.clear();
      expect(ConvHistory.I.all, isEmpty);
    });
  });

  group('the desktop\'s glance', () {
    test('the pairs converted lately, each once', () {
      final h = cleanHistory([
        {'id': 'aaaaaaaaaaaa', 'at': 3, 'amount': 1, 'from': 'SGD', 'to': 'MYR', 'rate': 3},
        {'id': 'bbbbbbbbbbbb', 'at': 2, 'amount': 5, 'from': 'SGD', 'to': 'MYR', 'rate': 3},
        {'id': 'cccccccccccc', 'at': 1, 'amount': 1, 'from': 'USD', 'to': 'JPY', 'rate': 150},
      ])!;
      expect(recentPairs(h).map((p) => p['name']), ['SGD → MYR', 'USD → JPY']);
      expect(pairOf('SGD-MYR'), ('SGD', 'MYR'));
      expect(pairOf('nope'), isNull);
    });
    test('the tray tooltip, within Windows\' 127 characters', () {
      final t = trayText('SGD', 'MYR', 3.2692307, date: '2026-11-13');
      expect(t, 'SGD → MYR\n1 SGD = 3.2692 MYR\n100 SGD = 326.92 MYR\nRates as of 13 Nov 2026');
      expect(trayText('SGD', 'MYR', null), contains('couldn’t get the rate'));
      expect(t.length, lessThanOrEqualTo(127));
    });
  });
}
