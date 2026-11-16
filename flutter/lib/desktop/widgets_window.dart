// Desktop widgets (docs/desktop-features-spec.md §8), for rates: small frameless windows on the
// desktop, each showing one currency against a few others, because a third-party app can't add
// to the system's widget board. Each is its own window and Flutter engine (desktop_multi_window),
// started from main(args) with { kind: 'widget', id } and running only this small screen.
//
// - Added from the tray (Add a desktop widget) or a conversion's right-click menu in History
//   (Pin to Desktop Widget). A new one opens in its setup state: pick one of the pairs converted
//   lately, or type a currency's code and the ones to show against it (a comma-separated list);
//   Save.
// - Shows one row per currency: 1 of the base in it, and how much 100 is. Rates change once a
//   working day, so they're read again every ten minutes (and on Refresh), from the same API.
// - Its own buttons: refresh, change what it shows, pin on top of other windows, remove (×).
// - Moved by dragging its top; resized from any edge, down to 200 × 110. Default 320 × 300.
// - Clicking a row converts that pair in the main window.
// - Kept: each widget's currencies, pin and place, reopened where it was when the app starts.
//   Removing one with × forgets it; quitting keeps them all. Not in the taskbar or Alt+Tab.
//
// Keys: widgets: [{ id, code: 'SGD', name: 'SGD', items: ['MYR', 'USD'], onTop, bounds }].
import 'dart:async';
import 'dart:convert';

import 'package:desktop_multi_window/desktop_multi_window.dart';
import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';

import '../api/api.dart';
import '../data/currency.dart';
import '../data/history.dart';
import '../data/store.dart';
import '../features/history/history_card.dart';
import '../theme/icons.dart';
import '../theme/theme.dart';
import 'glance.dart';
import 'settings.dart';

const widgetChannel = WindowMethodChannel('org.uwuapps.currency/widgets');

class DeskWidgets {
  DeskWidgets._();

  static List<Map<String, dynamic>> _all() => [
    for (final w in (DeskSettings.get<List<dynamic>>('widgets') ?? const []))
      if (w is Map) Map<String, dynamic>.from(w),
  ];

  static void _save(List<Map<String, dynamic>> list) => DeskSettings.write({'widgets': list});

  static Future<void> _open(Map<String, dynamic> w) async {
    try {
      final c = await WindowController.create(WindowConfiguration(hiddenAtLaunch: true, arguments: jsonEncode({'kind': 'widget', 'id': w['id']})));
      await c.show();
    } catch (_) {
      // No second window on this system.
    }
  }

  /// A new widget, in its setup state, or already showing `from` against `to`.
  static Future<void> add([String? from, String? to]) async {
    final w = <String, dynamic>{
      'id': makeHistoryId(),
      'code': from,
      'name': from ?? '',
      'items': <dynamic>[?to],
      'onTop': false,
      'bounds': null,
    };
    _save([..._all(), w]);
    await _open(w);
  }

  /// Every kept widget, where it was, as the app starts.
  static Future<void> reopenAll() async {
    for (final w in _all()) {
      await _open(w);
    }
  }

  /// The main window hears what its widgets ask: convert a pair.
  static void listen(void Function(String link) open) {
    widgetChannel.setMethodCallHandler((call) async {
      if (call.method == 'open' && call.arguments is String) open(call.arguments as String);
      return null;
    });
  }
}

/// A widget's own engine: its window set up, then its screen.
Future<void> runWidgetWindow(String id) async {
  await Store.open();
  ThemeController.I.init();
  await windowManager.ensureInitialized();
  final w = DeskWidgets._all().where((x) => x['id'] == id).firstOrNull;
  if (w == null) return;
  final b = w['bounds'];
  await windowManager.waitUntilReadyToShow(
    WindowOptions(
      size: b is Map ? Size((b['width'] as num).toDouble(), (b['height'] as num).toDouble()) : const Size(320, 300),
      minimumSize: const Size(200, 110),
      skipTaskbar: true,
      titleBarStyle: TitleBarStyle.hidden,
      windowButtonVisibility: false,
      alwaysOnTop: w['onTop'] == true,
      backgroundColor: Colors.transparent,
    ),
  );
  if (b is Map) await windowManager.setPosition(Offset((b['x'] as num).toDouble(), (b['y'] as num).toDouble()));
  await windowManager.setAsFrameless();
  await windowManager.show();
  runApp(_WidgetApp(id: id));
}

class _WidgetApp extends StatefulWidget {
  const _WidgetApp({required this.id});
  final String id;

  @override
  State<_WidgetApp> createState() => _WidgetAppState();
}

class _WidgetAppState extends State<_WidgetApp> with WindowListener {
  Map<String, dynamic> _w = {};
  Map<String, double> _rates = {};
  String _date = '';
  bool _setup = false;
  bool _loading = true;
  String? _error;
  Timer? _fetch;
  Timer? _keep;
  final _base = TextEditingController();
  final _items = TextEditingController();

  String get _code => '${_w['code'] ?? ''}';
  List<String> get _quotes => [
    for (final q in (_w['items'] as List? ?? const []))
      if (q is String && q.isNotEmpty) q,
  ];

  @override
  void initState() {
    super.initState();
    _w = DeskWidgets._all().firstWhere((x) => x['id'] == widget.id, orElse: () => {'id': widget.id});
    _setup = _code.isEmpty || _quotes.isEmpty;
    _base.text = _code;
    _items.text = _quotes.join(', ');
    windowManager.addListener(this);
    _load();
    _fetch = Timer.periodic(const Duration(minutes: 10), (_) => _load());
  }

  @override
  void dispose() {
    _fetch?.cancel();
    _base.dispose();
    _items.dispose();
    windowManager.removeListener(this);
    super.dispose();
  }

  void _update(Map<String, dynamic> changes) {
    _w = {..._w, ...changes};
    final list = DeskWidgets._all();
    final i = list.indexWhere((x) => x['id'] == widget.id);
    if (i >= 0) {
      list[i] = _w;
    } else {
      list.add(_w);
    }
    DeskWidgets._save(list);
  }

  // Bounds, a moment after the last move or resize.
  void _keepBounds() {
    _keep?.cancel();
    _keep = Timer(const Duration(milliseconds: 500), () async {
      final r = await windowManager.getBounds();
      _update({
        'bounds': {'x': r.left.round(), 'y': r.top.round(), 'width': r.width.round(), 'height': r.height.round()},
      });
    });
  }

  @override
  void onWindowMoved() => _keepBounds();

  @override
  void onWindowResized() => _keepBounds();

  /// The base's rates, from the same API as the app (kept for offline, as the app keeps them).
  Future<void> _load() async {
    await Store.I.reload();
    if (_code.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final r = await Api.rates(_code);
      _rates = r.rates;
      _date = r.date;
      _error = null;
    } catch (_) {
      _error = 'Couldn’t get the rates just now';
    }
    if (mounted) setState(() => _loading = false);
  }

  static final _codeRe = RegExp(r'^[A-Z0-9]{2,10}$');

  /// Save: what's typed (or a pair picked), checked as codes.
  void _save(String base, Iterable<String> quotes) {
    final code = base.trim().toUpperCase();
    final items = {
      for (final q in quotes)
        if (_codeRe.hasMatch(q.trim().toUpperCase()) && q.trim().toUpperCase() != code) q.trim().toUpperCase(),
    }.take(8).toList();
    if (!_codeRe.hasMatch(code) || items.isEmpty) {
      setState(() => _error = 'Type a currency code, like SGD, and at least one to show against it.');
      return;
    }
    _update({'code': code, 'name': code, 'items': items});
    _base.text = code;
    _items.text = items.join(', ');
    setState(() {
      _setup = false;
      _loading = true;
      _error = null;
    });
    _load();
  }

  List<String> _typed() => _items.text.split(RegExp(r'[,\s]+'));

  @override
  Widget build(BuildContext context) {
    final t = ThemeController.I;
    final theme = buildTheme(look: lookUwuApps, brightness: t.brightness, brand: t.colorTheme.color, desktop: true);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: theme,
      home: Builder(
        builder: (context) {
          final c = UwuColors.of(context);
          return Scaffold(
            backgroundColor: Colors.transparent,
            body: Container(
              decoration: BoxDecoration(
                color: c.bg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: c.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _top(c),
                  Expanded(child: _setup ? _setupView(c) : _rows(c)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _top(UwuColors c) {
    Widget btn(String icon, String label, VoidCallback onTap, {bool on = false}) => Tooltip(
      excludeFromSemantics: true,
      message: label,
      child: InkWell(
        mouseCursor: WidgetStateMouseCursor.clickable,
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: AppIcon(icon, size: 14, color: on ? c.brandInk : c.muted),
        ),
      ),
    );
    return Container(
      color: c.surfaceStrong,
      padding: const EdgeInsets.only(left: 10, right: 4),
      height: 32,
      child: Row(
        children: [
          Expanded(
            child: DragToMoveArea(
              child: Container(
                alignment: Alignment.centerLeft,
                child: Text(
                  _setup ? 'Desktop widget' : '1 $_code${_date.isEmpty ? '' : ' · ${formatDay(_date)}'}',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.ink, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),
          if (!_setup) ...[btn('refresh', 'Refresh', _load), btn('pencil', 'Change what it shows', () => setState(() => _setup = true))],
          btn('pin', _w['onTop'] == true ? 'Stop keeping on top' : 'Keep on top of other windows', () async {
            final on = _w['onTop'] != true;
            _update({'onTop': on});
            await windowManager.setAlwaysOnTop(on);
            setState(() {});
          }, on: _w['onTop'] == true),
          btn('close', 'Remove', () async {
            DeskWidgets._save(DeskWidgets._all().where((x) => x['id'] != widget.id).toList());
            await windowManager.destroy();
          }),
        ],
      ),
    );
  }

  Widget _setupView(UwuColors c) {
    final recent = recentPairs(ConvHistory.I.all, max: 6);
    return ListView(
      padding: const EdgeInsets.all(10),
      children: [
        Text('Show a currency against others', style: TextStyle(color: c.muted, fontSize: 12)),
        const SizedBox(height: 6),
        TextField(
          controller: _base,
          style: TextStyle(color: c.ink, fontSize: 13),
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(labelText: 'Currency', hintText: 'SGD'),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _items,
          style: TextStyle(color: c.ink, fontSize: 13),
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(labelText: 'Against', hintText: 'MYR, USD, EUR'),
          onSubmitted: (_) => _save(_base.text, _typed()),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(_error!, style: TextStyle(color: c.error, fontSize: 12)),
          ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(onPressed: () => _save(_base.text, _typed()), child: const Text('Save')),
        ),
        if (recent.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('Or one you converted lately', style: TextStyle(color: c.muted, fontSize: 12)),
          for (final p in recent)
            ListTile(
              dense: true,
              mouseCursor: SystemMouseCursors.click,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              title: Text('${p['name']}', style: TextStyle(color: c.ink, fontSize: 13)),
              onTap: () {
                final pair = pairOf(p['code']);
                if (pair != null) _save(pair.$1, [pair.$2]);
              },
            ),
        ],
      ],
    );
  }

  Widget _rows(UwuColors c) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_rates.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(_error ?? 'No rates for $_code. Change what it shows.', textAlign: TextAlign.center, style: TextStyle(color: c.muted, fontSize: 12)),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: _quotes.length,
      separatorBuilder: (_, _) => Divider(height: 1, color: c.border),
      itemBuilder: (context, i) {
        final q = _quotes[i];
        final rate = q == _code ? 1.0 : _rates[q];
        return InkWell(
          mouseCursor: WidgetStateMouseCursor.clickable,
          onTap: () => widgetChannel.invokeMethod('open', pairLink(_code, q)).catchError((Object _) => null),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                Text(q, style: TextStyle(color: c.ink, fontSize: 14, fontWeight: FontWeight.w600)),
                const Spacer(),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(rate == null ? '—' : formatNumber(rate, maxDecimals: 4), style: TextStyle(color: c.ink, fontSize: 14)),
                    if (rate != null) Text('100 = ${formatNumber(rate * 100, maxDecimals: 2)}', style: TextStyle(color: c.muted, fontSize: 11)),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
