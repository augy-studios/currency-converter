// Sharing conversion history, and the theme, with another device (main-site/js/sync.js): the
// same session, wire and merging, so the app shares with the site in a browser and with another
// copy of the app. One device shows a code (with a link and a QR code of it), the other enters it.
// Once connected, each side sees the other's conversions and ticks which to import, or which of
// its own to send over. Copying adds and never removes: entries never change once made, so a
// merge is a union by id (data/history.dart). Closing the window ends the session.
//
// The wire, on top of p2p.dart's hello and bye:
//   { type: 'history', entries, theme }   all of the sender's conversions and its theme
//   { type: 'add', id, entries, theme }   merge these into yours
//   { type: 'added', id, count }          the answer to add
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../api/api.dart';
import '../../data/history.dart';
import '../../data/store.dart';
import '../../native/bridge.dart';
import '../../share/p2p.dart';
import '../../theme/theme.dart';

const _hostKey = 'uwuconvert.sync.hostCode';
const _lastKey = 'uwuconvert.sync.lastCode';
const _ackMs = 6000;

typedef Json = Map<String, dynamic>;

String syncLink(String code) => '$siteOrigin/#sync/$code';

/// One setting the theme carries across: its label, what it starts as (only one changed from
/// that is offered), its value as words, and how it's read and set.
class _Setting {
  const _Setting(this.label, this.start, this.values, this.text, this.get, this.set);
  final String label;
  final String start;
  final List<String> Function() values;
  final String Function(String) text;
  final String Function() get;
  final void Function(String) set;
}

final _settings = <String, _Setting>{
  'mode': _Setting(
    'Light or dark',
    'light',
    () => modePreferences,
    (v) => const {'light': 'Light', 'dark': 'Dark', 'time': 'Time-based'}[v] ?? v,
    () => ThemeController.I.modePreference,
    ThemeController.I.setMode,
  ),
  'colour': _Setting(
    'Brand colour',
    'classic',
    () => [for (final t in colorThemes) t.id],
    (v) => colorThemes.where((t) => t.id == v).map((t) => t.label).firstOrNull ?? v,
    () => ThemeController.I.colorThemeId,
    ThemeController.I.setColorTheme,
  ),
};

bool _settingOk(Object? field, Object? value) => _settings.containsKey(field) && value is String && _settings[field]!.values().contains(value);

List<Json> _ownTheme() => [
  for (final e in _settings.entries)
    if (e.value.get() != e.value.start) {'field': e.key, 'value': e.value.get()},
];

List<Json> _cleanTheme(Object? raw) {
  final seen = <String>{};
  return [
    for (final s in (raw is List ? raw.take(10) : const []))
      if (s is Map && _settingOk(s['field'], s['value']) && seen.add('${s['field']}')) {'field': s['field'], 'value': s['value']},
  ];
}

/// One row the Sync window offers.
class SyncItem {
  SyncItem(this.key, this.kind, this.item, {this.done = false, this.update = false});
  final String key;
  final String kind; // conv | setting
  final Object item; // a HistoryEntry, or a setting's { field, value }
  final bool done;

  /// Never: an entry never changes once made, so one there already is just there.
  final bool update;

  String get title => item is HistoryEntry ? (item as HistoryEntry).line : _settings[(item as Json)['field']]!.label;
  String get sub => item is HistoryEntry ? (item as HistoryEntry).sub : _settings[(item as Json)['field']]!.text('${(item as Json)['value']}');
}

class SyncController extends ChangeNotifier {
  SyncController._();
  static final SyncController I = SyncController._();

  String? role; // host | guest while a session runs
  dynamic conn; // Host or Guest
  String status = 'idle';
  ({List<HistoryEntry> entries, List<Json> theme})? theirs;
  String tab = 'import';
  final Map<String, Set<String>> picked = {'import': {}, 'export': {}};
  final Map<int, Timer> _pending = {};
  int _lastId = 0;
  bool _retriedTaken = false;
  String droppedCode = '';

  /// What the window shows: a status line with its tone, and a note under the list.
  String statusText = '';
  String statusTone = 'busy';
  String note = '';
  bool noteError = false;
  String hostCode = '';
  String codeInput = '';

  bool get connected => status == 'connected';

  void _changed() => notifyListeners();

  void showStatus(String message, [String tone = 'busy']) {
    statusText = message;
    statusTone = tone;
    _changed();
  }

  void showNote(String message, {bool error = false}) {
    note = message;
    noteError = error;
    _changed();
  }

  void _begin(String r) {
    role = r;
    status = 'connecting';
    theirs = null;
    droppedCode = '';
    tab = 'import';
    picked['import']!.clear();
    picked['export']!.clear();
    note = '';
    Native.tryCall('App', 'keepScreenOn', {'on': true});
  }

  void _end({bool bye = false, String text = '', String tone = 'busy'}) {
    final c = conn;
    conn = null;
    if (c != null) {
      if (bye && role == 'guest' && c is Guest) {
        c.leave();
      } else {
        c.close();
      }
    }
    for (final t in _pending.values) {
      t.cancel();
    }
    _pending.clear();
    role = null;
    status = 'idle';
    theirs = null;
    Native.tryCall('App', 'keepScreenOn', {'on': false});
    showStatus(text, tone);
  }

  /// Stop, Cancel or Disconnect, or the window closing.
  void stop() {
    droppedCode = '';
    if (role != null) _end(bye: true);
  }

  /// The window closed: nothing is left running out of sight.
  void closed() {
    stop();
    statusText = '';
    note = '';
  }

  Future<void> startHosting() async {
    if (role != null) return;
    final stored = Store.I.get(_hostKey);
    final code = isValidCode(stored) ? stored! : generateCode();
    Store.I.put(_hostKey, code);
    _begin('host');
    hostCode = code;
    final host = Host();
    conn = host;
    host.onStatus = (s, {message, taken = false}) {
      if (!identical(conn, host)) return;
      // The stored code is held by something else: a fresh one, once.
      if (taken && !_retriedTaken) {
        _retriedTaken = true;
        newHostCode();
        return;
      }
      if (s == 'error') {
        if (taken) Store.I.remove(_hostKey);
        _end(text: message ?? 'The connection failed.', tone: 'error');
        return;
      }
      if (s == 'waiting') _retriedTaken = false;
      _onStatus(s);
    };
    // A newcomer replaces the device that was connected, whose history no longer applies.
    host.onJoin = () {
      theirs = null;
      _changed();
    };
    host.onMessage = (m) {
      if (identical(conn, host)) _onMessage(m);
    };
    _render();
    try {
      await host.start(code);
    } catch (_) {
      if (identical(conn, host)) _end(text: 'Could not load sharing. Check your connection.', tone: 'error');
    }
  }

  Future<void> newHostCode([String noteText = '']) async {
    _end();
    Store.I.remove(_hostKey);
    await startHosting();
    if (noteText.isNotEmpty) showNote(noteText);
  }

  Future<void> join(String input) async {
    final code = normaliseCode(input);
    if (!isValidCode(code)) {
      showStatus('The code is the $codeLength letters and numbers on the other device’s screen.', 'error');
      return;
    }
    if (role != null) _end();
    _begin('guest');
    Store.I.put(_lastKey, code);
    codeInput = code;
    final guest = Guest();
    conn = guest;
    guest.onStatus = (s, {message, taken = false}) {
      if (!identical(conn, guest)) return;
      if (s == 'dropped') {
        _end(text: 'Lost the connection to the other device. Press Connect to try again.', tone: 'warn');
        droppedCode = code;
      } else if (s == 'unreachable') {
        _end(
          text: 'Could not reach the other device. Both have to be on the same network: join the same wifi, or turn on a hotspot on one and join it from the other. Check the code is still the one on screen.',
          tone: 'error',
        );
      } else if (s == 'error') {
        _end(text: message ?? 'The connection failed.', tone: 'error');
      } else {
        _onStatus(s);
      }
    };
    guest.onMessage = (m) {
      if (identical(conn, guest)) _onMessage(m);
    };
    _render();
    try {
      await guest.connect(code);
    } catch (_) {
      if (identical(conn, guest)) _end(text: 'Could not load sharing. Check your connection.', tone: 'error');
    }
  }

  void _onStatus(String s) {
    final was = status;
    status = s;
    if (s != 'connected') {
      theirs = null;
    } else if (was != 'connected' && role == 'guest') {
      // The host answers hello with its history; this is ours for it.
      _sendHistory();
    }
    _render();
  }

  void _render() {
    if (role == 'host' && status == 'waiting') {
      showStatus('Waiting for the other device. On it, open Share with another device and enter this code, or scan the QR code with its camera.', 'warn');
    } else if (role != null && status == 'connecting') {
      showStatus(role == 'host' ? 'Getting the code ready…' : 'Connecting to the other device…', 'busy');
    } else if (connected) {
      showStatus('Connected to the other device.', 'ok');
    } else {
      _changed();
    }
  }

  void _send(Map<String, Object?> m) => conn?.send(m);

  /// Odd on the host and even on the guest, so one side's answer is never taken for the other's.
  int _nextId() => ++_lastId * 2 + (role == 'host' ? 1 : 0);

  void _sendHistory() => _send({
    'type': 'history',
    'entries': [for (final e in ConvHistory.I.all) e.toJson()],
    'theme': _ownTheme(),
  });

  Timer? _changeTimer;

  /// This device's history changed: the other side's lists follow.
  void historyChanged() {
    if (!connected) return;
    _changeTimer?.cancel();
    _changeTimer = Timer(const Duration(milliseconds: 300), () {
      if (connected) _sendHistory();
      _changed();
    });
  }

  /* ---- merging ---- */

  int _mergeIn(List<HistoryEntry> entries, List<Json> theme) {
    var count = 0;
    for (final s in theme) {
      final setting = _settings[s['field']]!;
      if (setting.get() != s['value']) {
        setting.set('${s['value']}');
        count++;
      }
    }
    return count + ConvHistory.I.merge([for (final e in entries) e.toJson()]);
  }

  /* ---- messages ---- */

  // Everything the other device sends goes through here. Unknown types are ignored, never thrown
  // on: the other device may be a version ahead or behind.
  void _onMessage(Json m) {
    switch (m['type']) {
      case 'hello':
        if (role == 'host') _sendHistory();
      case 'history':
        final entries = cleanHistory(m['entries']);
        if (entries == null) break;
        theirs = (entries: entries, theme: _cleanTheme(m['theme']));
        _changed();
      case 'add':
        _onAdd(m);
      case 'added':
        final id = m['id'];
        final timer = _pending.remove(id);
        if (timer == null) break;
        timer.cancel();
        final n = m['count'] is num ? (m['count'] as num).floor().clamp(0, historyMax + 10) : 0;
        showNote(n > 0 ? 'Sent. The other device took ${n == 1 ? '1 new thing' : '$n new things'}.' : 'Sent. The other device already had all of those.');
      case 'bye':
        if (role == 'host') newHostCode('The other device disconnected. The old code no longer works; this is a new one.');
    }
  }

  void _onAdd(Json m) {
    final entries = cleanHistory(m['entries']);
    final id = m['id'];
    if (entries == null || id is! int) return;
    final count = _mergeIn(entries, _cleanTheme(m['theme']));
    _send({'type': 'added', 'id': id, 'count': count});
    if (count > 0) _sendHistory();
    showNote(
      count > 0
          ? 'The other device sent ${count == 1 ? '1 thing' : '$count things'}, now saved here.'
          : 'The other device sent things this device already has.',
    );
  }

  /* ---- copying ---- */

  List<SyncItem> _items(({List<HistoryEntry> entries, List<Json> theme})? side) => side == null
      ? const []
      : [
          for (final e in side.entries) SyncItem('conv:${e.id}', 'conv', e),
          for (final s in side.theme) SyncItem('setting:${s['field']}=${s['value']}', 'setting', s),
        ];

  ({List<HistoryEntry> entries, List<Json> theme}) _own() => (entries: ConvHistory.I.all, theme: _ownTheme());
  ({List<HistoryEntry> entries, List<Json> theme})? get _source => tab == 'import' ? theirs : _own();
  ({List<HistoryEntry> entries, List<Json> theme})? get _dest => tab == 'import' ? _own() : theirs;

  /// What's on offer in the tab on show, and whether each is already at the other end.
  List<SyncItem> offered() {
    final from = _source, to = _dest;
    if (from == null || to == null) return const [];
    final have = {for (final e in to.entries) e.id};
    return [
      for (final f in _items(from))
        if (f.item is HistoryEntry)
          SyncItem(f.key, f.kind, f.item, done: have.contains((f.item as HistoryEntry).id))
        else
          () {
            final s = f.item as Json;
            final there = tab == 'import'
                ? _settings[s['field']]!.get()
                : (to.theme.where((x) => x['field'] == s['field']).firstOrNull?['value'] ?? _settings[s['field']]!.start);
            return SyncItem(f.key, f.kind, f.item, done: s['value'] == there);
          }(),
    ];
  }

  void setTab(String t) {
    tab = t;
    _changed();
  }

  void toggle(String key, bool on) {
    final p = picked[tab]!;
    on ? p.add(key) : p.remove(key);
    _changed();
  }

  void toggleAll(bool on) {
    final p = picked[tab]!;
    for (final f in offered()) {
      if (f.done) continue;
      on ? p.add(f.key) : p.remove(f.key);
    }
    _changed();
  }

  Future<void> copyPicked() async {
    final p = picked[tab]!;
    if (p.isEmpty || _source == null) return;
    final chosen = _items(_source).where((f) => p.contains(f.key)).toList();
    final entries = [
      for (final f in chosen)
        if (f.item is HistoryEntry) f.item as HistoryEntry,
    ];
    final theme = [
      for (final f in chosen)
        if (f.item is Json) f.item as Json,
    ];
    p.clear();
    if (tab == 'import') {
      // Everything the other side has is here already: merged straight in.
      final count = _mergeIn(entries, theme);
      showNote(count == 1 ? 'Imported 1 thing to this device.' : 'Imported $count things to this device.');
      if (count > 0) _sendHistory();
    } else {
      final id = _nextId();
      final n = chosen.length;
      showNote(n == 1 ? 'Sending 1 thing…' : 'Sending $n things…');
      _send({
        'type': 'add',
        'id': id,
        'entries': [for (final e in entries) e.toJson()],
        'theme': theme,
      });
      _pending[id] = Timer(const Duration(milliseconds: _ackMs), () {
        _pending.remove(id);
        showNote('No answer from the other device. Check it still says connected, then try again.', error: true);
      });
    }
    _changed();
  }

  /// The window opening: the last code this device joined with, ready to use again.
  void opened() {
    if (role == null && codeInput.isEmpty) codeInput = Store.I.get(_lastKey) ?? '';
    _render();
  }

  /// A link from another device's QR code: the code filled in, waiting for Connect, since
  /// connecting shows this device's history to whoever made the link.
  void fromLink(String code) {
    if (role != null) return;
    codeInput = normaliseCode(code);
    showStatus('Press Connect to share with the device showing this code.', 'busy');
  }

  /// Back in front with a session that dropped meanwhile: try again.
  void resumed(bool windowOpen) {
    if (role == null && droppedCode.isNotEmpty && windowOpen) join(droppedCode);
  }

  void retryTaken() => _retriedTaken = false;
}
