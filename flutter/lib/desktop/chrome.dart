// The desktop's own title bar and command bar, round the shared app (docs/desktop-features-spec.md
// §5, docs/flutter-desktop-app-spec.md §2.3–2.5). 40 px tall, in the brand colour (writing light
// or dark by contrast), draggable where there's nothing to click, double-click to maximise:
//
//   (macOS traffic lights) Back Forward Reload  [ Command / Search bar ]  Copy link Screenshot
//   Long screenshot (Update) (Windows, Linux: minimise, maximise, close)
//
// The command bar shows the conversion on show at rest; Ctrl+K, Ctrl+F, Ctrl+L or F6 (⌘K, ⌘F, ⌘L)
// opens a live search of currencies, past conversions and the app's commands, and converts what's
// typed as a sentence ("100 usd to eur", "50 sgd myr"). A pasted uwu://currency/ link, the site's
// address or a #sync/… path opens in the app; another site's address opens in the browser. Back
// and Forward step through the pairs converted this session. The title bar hides in full screen.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:window_manager/window_manager.dart';

import '../app/env.dart';
import '../app/links.dart';
import '../app/nav.dart';
import '../app/state.dart';
import '../data/currency.dart';
import '../data/history.dart';
import '../features/bug/bug_report.dart';
import '../features/converter/converter_card.dart';
import '../features/history/history_card.dart';
import '../features/sync/sync_sheet.dart';
import '../features/theme/theme_sheet.dart';
import '../features/tour/tour.dart';
import '../theme/icons.dart';
import '../theme/theme.dart';
import '../widgets/sheet.dart';
import 'desk.dart';
import 'screenshot.dart';
import 'updater.dart';

const titleBarHeight = 40.0;

/// Back and Forward through the pairs converted this session.
class ViewHistory {
  ViewHistory._();
  static final List<(String, String)> _stack = [];
  static int _at = -1;
  static bool _moving = false;
  static final ValueNotifier<int> changed = ValueNotifier(0);

  static void start() {
    AppState.I.addListener(() {
      final c = AppState.I.last;
      if (_moving || c == null) return;
      final pair = (c.from, c.to);
      if (_at >= 0 && _stack[_at] == pair) return;
      _stack.removeRange(_at + 1, _stack.length);
      _stack.add(pair);
      _at = _stack.length - 1;
      changed.value++;
    });
  }

  static bool get canBack => _at > 0;
  static bool get canForward => _at < _stack.length - 1;

  static Future<void> _go(int d) async {
    final to = _at + d;
    if (to < 0 || to >= _stack.length) return;
    _at = to;
    _moving = true;
    final (f, t) = _stack[_at];
    AppState.I.from = f;
    AppState.I.to = t;
    AppState.I.saveState();
    await AppState.I.convert();
    _moving = false;
    changed.value++;
  }

  static void back() => _go(-1);
  static void forward() => _go(1);
}

/// A conversion typed as words: "100 usd to eur", "50 sgd myr", "eur in jpy". The amount is
/// optional; the two currencies are codes or names the app knows.
({double? amount, String from, String to})? parseCommand(
  String text,
  Map<String, String> currencies,
) {
  final m = RegExp(
    r'^\s*(\d[\d,]*(?:\.\d+)?)?\s*([A-Za-z][A-Za-z ]*?)\s+(?:to|in|into|->|→)?\s*([A-Za-z][A-Za-z ]*?)\s*$',
    caseSensitive: false,
  ).firstMatch(text);
  if (m == null) return null;
  String code(String w) {
    final up = w.trim().toUpperCase();
    if (currencies.containsKey(up)) return up;
    return codeFromInput(w, currencies);
  }

  final from = code(m.group(2)!), to = code(m.group(3)!);
  if (from.isEmpty || to.isEmpty) return null;
  final amount = m.group(1) == null
      ? null
      : double.tryParse(m.group(1)!.replaceAll(',', ''));
  return (amount: amount, from: from, to: to);
}

/// One thing the command bar offers.
class _Hit {
  _Hit(this.icon, this.title, this.sub, this.run);
  final String icon;
  final String title;
  final String sub;
  final VoidCallback run;
}

class DesktopChrome extends StatefulWidget {
  const DesktopChrome({super.key, required this.child});
  final Widget child;

  @override
  State<DesktopChrome> createState() => _DesktopChromeState();
}

class _DesktopChromeState extends State<DesktopChrome> {
  final _search = TextEditingController();
  final _focus = FocusNode();
  final _layer = LayerLink();
  OverlayEntry? _results;
  String _message = '';
  Timer? _messageTimer;
  bool _reloading = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (_focus.hasFocus) {
        _search.selection = TextSelection(
          baseOffset: 0,
          extentOffset: _search.text.length,
        );
        _showResults();
      } else {
        Timer(const Duration(milliseconds: 150), _hideResults);
      }
    });
    _search.addListener(() => _results?.markNeedsBuild());
  }

  @override
  void dispose() {
    _hideResults();
    _search.dispose();
    _focus.dispose();
    super.dispose();
  }

  void say(String text) {
    _messageTimer?.cancel();
    setState(() => _message = text);
    _messageTimer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _message = '');
    });
  }

  BuildContext? get _ctx => AppNav.context;

  void _focusSearch() {
    _search.text = '';
    _focus.requestFocus();
  }

  Future<void> _reload() async {
    if (_reloading) return;
    setState(() => _reloading = true);
    await Future.wait([AppState.I.convert(), AppState.I.loadGraph()]);
    AppState.I.pageChanged();
    if (mounted) setState(() => _reloading = false);
  }

  Future<void> _copyLink() async {
    await copyText(linkFor());
    say('Link copied');
  }

  Future<void> _swap() async {
    final e = await AppState.I.swap();
    if (e != null) say(e);
  }

  void _closeTop() {
    if (AppSheet.anyOpen ||
        (AppNav.navigatorKey.currentState?.canPop() ?? false)) {
      AppNav.navigatorKey.currentState?.maybePop();
    } else {
      Desktop.hide();
    }
  }

  void _escape() {
    if (_focus.hasFocus) {
      _focus.unfocus();
      return;
    }
    if (Desktop.fullScreen.value) {
      Desktop.setFullScreen(false);
      return;
    }
    AppNav.navigatorKey.currentState?.maybePop();
  }

  /// What the command bar finds for what's typed.
  List<_Hit> _hits(String q) {
    final ctx = _ctx;
    final app = AppState.I;
    final query = q.trim().toLowerCase();
    final hits = <_Hit>[];
    final text = q.trim();
    if (text.isNotEmpty && parseLink(text) != null) {
      hits.add(_Hit('link', 'Open $text', 'Link', () => _openTyped(text)));
    }
    // A sentence: convert it.
    final cmd = text.isEmpty ? null : parseCommand(text, app.currencies);
    if (cmd != null) {
      final amount = cmd.amount ?? app.amount;
      hits.add(
        _Hit(
          'swap',
          'Convert ${formatNumber(amount)} ${cmd.from} to ${cmd.to}',
          'Convert',
          () async {
            if (!await app.applyPair(cmd.from, cmd.to, amount: amount)) {
              say('Not found');
            }
          },
        ),
      );
    }
    final commands = <_Hit>[
      _Hit('swap', 'Swap currencies', 'Command', _swap),
      _Hit('history', 'History', 'Command', () => HistoryCard.show?.call()),
      _Hit(
        'share',
        'Share this conversion',
        'Command',
        () => ctx == null ? null : openShareMenu(ctx),
      ),
      _Hit(
        'sync',
        'Share history with another device',
        'Command',
        () => ctx == null ? null : openSync(ctx),
      ),
      _Hit(
        'sun',
        'Theme',
        'Command · Ctrl+,',
        () => ctx == null ? null : openThemeSheet(ctx),
      ),
      _Hit(
        'help',
        'Show me around',
        'Command',
        () => ctx == null ? null : openTourPicker(ctx),
      ),
      _Hit(
        'bug',
        'Report a bug',
        'Command',
        () => ctx == null ? null : openBugReport(ctx),
      ),
      _Hit(
        'screenshot',
        'Screenshot',
        'Command',
        () => ctx == null ? null : Screenshots.take(ctx),
      ),
      _Hit('refresh', 'Refresh rates', 'Command · F5', _reload),
    ];
    for (final c in commands) {
      if (query.isEmpty || c.title.toLowerCase().contains(query)) hits.add(c);
    }
    // A currency: as From or as To.
    if (query.isNotEmpty && cmd == null) {
      for (final code in searchCurrencies(query, app.currencies).take(4)) {
        final name = app.nameOf(code);
        hits.add(
          _Hit('dollar', 'Convert from $code', name, () async {
            app.setFrom(code);
            await app.convert(record: Record.now);
          }),
        );
        hits.add(
          _Hit('dollar', 'Convert to $code', name, () async {
            app.setTo(code);
            await app.convert(record: Record.now);
          }),
        );
      }
    }
    // Past conversions.
    for (final e in ConvHistory.I.all.take(query.isEmpty ? 3 : 50)) {
      if (query.isEmpty || e.line.toLowerCase().contains(query)) {
        hits.add(
          _Hit('history', e.line, 'History · ${e.sub}', () => reopenEntry(e)),
        );
      }
    }
    return hits.take(12).toList();
  }

  Future<void> _openTyped(String text) async {
    final target = parseLink(text);
    if (target is LinkOut) {
      await Desktop.openExternal(target.uri.toString());
      say('Opened in your browser');
      return;
    }
    if (!await Links.open(text)) say('Not found');
  }

  void _submit(String text) {
    _focus.unfocus();
    final t = text.trim();
    if (t.isEmpty) return;
    if (parseLink(t) != null) {
      _openTyped(t);
      return;
    }
    // A bare address: the site's own, or another's. Not a number like 1.50.
    if (RegExp(r'^[^\s/?#]+\.[^\s/?#]+').hasMatch(t) &&
        !t.contains(' ') &&
        double.tryParse(t) == null) {
      _openTyped('https://$t');
      return;
    }
    final hits = _hits(t);
    if (hits.isEmpty) {
      say('Not found');
    } else {
      hits.first.run();
    }
  }

  void _showResults() {
    if (_results != null) return;
    // The chrome sits above the navigator, so its overlay is the navigator's.
    final overlay = AppNav.navigatorKey.currentState?.overlay;
    if (overlay == null) return;
    _results = OverlayEntry(
      builder: (context) {
        final c = UwuColors.of(context);
        final hits = _hits(_search.text);
        return Positioned(
          width: 520,
          child: CompositedTransformFollower(
            link: _layer,
            targetAnchor: Alignment.bottomCenter,
            followerAnchor: Alignment.topCenter,
            offset: const Offset(0, 6),
            child: Material(
              elevation: 12,
              color: Color.alphaBlend(c.surfaceStrong, c.bg),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: c.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 420),
                child: hits.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(14),
                        child: Text(
                          'Nothing found',
                          style: TextStyle(color: c.muted),
                        ),
                      )
                    : ListView(
                        shrinkWrap: true,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        children: [
                          for (final h in hits)
                            ListTile(
                              dense: true,
                              leading: AppIcon(
                                h.icon,
                                size: 16,
                                color: c.muted,
                              ),
                              title: Text(
                                h.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: c.ink, fontSize: 13.5),
                              ),
                              subtitle: Text(
                                h.sub,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: c.muted,
                                  fontSize: 11.5,
                                ),
                              ),
                              onTap: () {
                                _focus.unfocus();
                                h.run();
                              },
                            ),
                        ],
                      ),
              ),
            ),
          ),
        );
      },
    );
    overlay.insert(_results!);
  }

  void _hideResults() {
    _results?.remove();
    _results = null;
  }

  Map<ShortcutActivator, VoidCallback> get _shortcuts {
    final mac = Env.macOS;
    SingleActivator mod(LogicalKeyboardKey k, {bool shift = false}) =>
        SingleActivator(k, control: !mac, meta: mac, shift: shift);
    final ctx = _ctx;
    return {
      mod(LogicalKeyboardKey.keyK): _focusSearch,
      mod(LogicalKeyboardKey.keyF): _focusSearch,
      mod(LogicalKeyboardKey.keyL): _focusSearch,
      const SingleActivator(LogicalKeyboardKey.f6): _focusSearch,
      mod(LogicalKeyboardKey.keyC, shift: true): _copyLink,
      const SingleActivator(LogicalKeyboardKey.f5): _reload,
      mod(LogicalKeyboardKey.keyR): _reload,
      mod(LogicalKeyboardKey.comma): () =>
          ctx == null ? null : openThemeSheet(ctx),
      mod(LogicalKeyboardKey.keyW): _closeTop,
      const SingleActivator(LogicalKeyboardKey.escape): _escape,
      if (mac) ...{
        const SingleActivator(LogicalKeyboardKey.bracketLeft, meta: true):
            ViewHistory.back,
        const SingleActivator(LogicalKeyboardKey.bracketRight, meta: true):
            ViewHistory.forward,
        const SingleActivator(
          LogicalKeyboardKey.keyF,
          meta: true,
          control: true,
        ): () =>
            Desktop.setFullScreen(!Desktop.fullScreen.value),
        const SingleActivator(LogicalKeyboardKey.keyQ, meta: true):
            Desktop.quit,
        const SingleActivator(LogicalKeyboardKey.keyM, meta: true): () =>
            windowManager.minimize(),
      } else ...{
        const SingleActivator(LogicalKeyboardKey.arrowLeft, alt: true):
            ViewHistory.back,
        const SingleActivator(LogicalKeyboardKey.arrowRight, alt: true):
            ViewHistory.forward,
        const SingleActivator(LogicalKeyboardKey.f11): () =>
            Desktop.setFullScreen(!Desktop.fullScreen.value),
      },
      // Swap, and Share's window.
      mod(LogicalKeyboardKey.keyS, shift: true): _swap,
      mod(LogicalKeyboardKey.keyE): () =>
          ctx == null ? null : openShareMenu(ctx),
    };
  }

  @override
  Widget build(BuildContext context) {
    final body = ValueListenableBuilder<bool>(
      valueListenable: Desktop.fullScreen,
      builder: (context, full, _) => Column(
        children: [
          if (!full) _bar(context),
          // Its own semantics container: a window's barrier below blocks what was drawn before it
          // in the same container, which would take the title bar, command bar and all, from
          // screen readers (uwuHere found it).
          Expanded(
            child: Semantics(
              container: true,
              explicitChildNodes: true,
              child: widget.child,
            ),
          ),
        ],
      ),
    );
    Widget app = CallbackShortcuts(
      bindings: _shortcuts,
      // The title bar sits above the navigator, so its tooltips and the command bar's text menus
      // need an overlay of their own. Without one, showing a tooltip throws, and the error box
      // fills the title bar.
      child: Focus(autofocus: true, child: Overlay.wrap(child: body)),
    );
    if (Env.macOS) app = _MacMenus(chrome: this, child: app);
    return app;
  }

  Widget _bar(BuildContext context) {
    final c = UwuColors.of(context);
    final brand = c.glass ? ThemeController.I.colorTheme.color : c.brandFill;
    final dark = c.glass && ThemeController.I.brightness == Brightness.dark;
    // In the glass look the bar is part of the glass, as Fluent's and Tahoe's title bars are: the
    // window's material (or the painted backdrop) shows through it, with a faint wash.
    final glassBar = c.glassKind != null;
    final bg = glassBar
        ? c.surface.withValues(alpha: c.surface.a * 0.6)
        : (dark ? Color.lerp(brand, Colors.black, 0.72)! : brand);
    final ink = glassBar
        ? c.ink
        : (ThemeData.estimateBrightnessForColor(bg) == Brightness.dark
              ? Colors.white
              : const Color(0xFF121815));
    final mac = Env.macOS;
    Widget tool(
      String icon,
      String label,
      VoidCallback? onTap, {
      Color? colour,
    }) => Tooltip(
      excludeFromSemantics: true,
      message: label,
      child: Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: InkWell(
          mouseCursor: WidgetStateMouseCursor.clickable,
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: SizedBox(
            width: 32,
            height: 30,
            child: Center(
              child: AppIcon(
                icon,
                size: 16,
                color: onTap == null
                    ? ink.withValues(alpha: 0.35)
                    : (colour ?? ink),
              ),
            ),
          ),
        ),
      ),
    );
    return Material(
      color: bg,
      child: SizedBox(
        height: titleBarHeight,
        child: Row(
          children: [
            SizedBox(width: mac ? 78 : 8),
            ValueListenableBuilder<int>(
              valueListenable: ViewHistory.changed,
              builder: (context, _, _) => Row(
                children: [
                  tool(
                    'arrow-left',
                    'Back',
                    ViewHistory.canBack ? ViewHistory.back : null,
                  ),
                  tool(
                    'arrow-right',
                    'Forward',
                    ViewHistory.canForward ? ViewHistory.forward : null,
                  ),
                ],
              ),
            ),
            _reloading
                ? SizedBox(
                    width: 32,
                    child: Center(
                      child: SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: ink,
                        ),
                      ),
                    ),
                  )
                : tool('refresh', 'Reload', _reload),
            Expanded(
              child: DragToMoveArea(
                child: SizedBox(
                  height: titleBarHeight,
                  child: Center(child: _commandBar(c, ink, bg)),
                ),
              ),
            ),
            tool('link', 'Copy link', _copyLink),
            ValueListenableBuilder<bool>(
              valueListenable: Screenshots.busy,
              builder: (context, busy, _) => Row(
                children: [
                  tool(
                    'screenshot',
                    'Screenshot',
                    busy ? null : () => Screenshots.take(context),
                  ),
                  tool(
                    'screenshot-long',
                    'Long screenshot',
                    busy ? null : () => Screenshots.takeLong(context),
                  ),
                ],
              ),
            ),
            ValueListenableBuilder<String?>(
              valueListenable: Updater.ready,
              builder: (context, ready, _) => ready == null
                  ? const SizedBox.shrink()
                  : Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          minimumSize: const Size(0, 28),
                        ),
                        onPressed: Updater.restartToUpdate,
                        icon: const AppIcon(
                          'download',
                          size: 14,
                          color: Colors.white,
                        ),
                        label: Text(
                          'Update to $ready',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                    ),
            ),
            if (!mac) _WindowButtons(ink: ink) else const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }

  Widget _commandBar(UwuColors c, Color ink, Color bg) {
    final conv = AppState.I.last;
    final rest = _message.isNotEmpty
        ? _message
        : (conv == null
              ? 'uwuCurrency'
              : '${formatNumber(conv.amount)} ${conv.from} = ${formatNumber(conv.result, maxDecimals: 2)} ${conv.to}');
    return CompositedTransformTarget(
      link: _layer,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, minWidth: 160),
        child: SizedBox(
          height: 28,
          child: ListenableBuilder(
            listenable: Listenable.merge([_focus, AppState.I]),
            // Named, so a screen reader (and the test suite) finds it by one name, whatever the
            // hint says at the moment.
            builder: (context, _) => Semantics(
              label: 'Search',
              child: TextField(
                controller: _search,
                focusNode: _focus,
                onSubmitted: _submit,
                textAlign: _focus.hasFocus ? TextAlign.start : TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: _focus.hasFocus ? c.ink : ink,
                ),
                cursorColor: c.brandInk,
                decoration: InputDecoration(
                  isDense: true,
                  filled: true,
                  fillColor: _focus.hasFocus
                      ? c.surfaceStrong
                      : Colors.black.withValues(alpha: 0.08),
                  hintText: _focus.hasFocus
                      ? 'Search currencies, history and commands, or type “100 usd to eur”'
                      : rest,
                  hintStyle: TextStyle(
                    fontSize: 13,
                    color: _focus.hasFocus
                        ? c.muted
                        : ink.withValues(alpha: 0.85),
                  ),
                  prefixIcon: Padding(
                    padding: const EdgeInsets.only(left: 8, right: 6),
                    child: AppIcon(
                      'search',
                      size: 14,
                      color: _focus.hasFocus
                          ? c.muted
                          : ink.withValues(alpha: 0.7),
                    ),
                  ),
                  prefixIconConstraints: const BoxConstraints(
                    minWidth: 28,
                    minHeight: 0,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 6,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: c.brandInk, width: 1.5),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Minimise, maximise or restore, and close (which keeps the app in the tray): full bar height,
/// 46 px wide each, close turning red on hover.
class _WindowButtons extends StatelessWidget {
  const _WindowButtons({required this.ink});
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: Desktop.maximized,
      builder: (context, max, _) => Row(
        children: [
          _WinButton(
            icon: 'minimise',
            label: 'Minimise',
            ink: ink,
            onTap: windowManager.minimize,
          ),
          _WinButton(
            icon: max ? 'restore' : 'maximise',
            label: max ? 'Restore' : 'Maximise',
            ink: ink,
            onTap: () async =>
                max ? windowManager.unmaximize() : windowManager.maximize(),
          ),
          _WinButton(
            icon: 'close',
            label: 'Close',
            ink: ink,
            close: true,
            onTap: Desktop.hide,
          ),
        ],
      ),
    );
  }
}

class _WinButton extends StatefulWidget {
  const _WinButton({
    required this.icon,
    required this.label,
    required this.ink,
    required this.onTap,
    this.close = false,
  });
  final String icon;
  final String label;
  final Color ink;
  final Future<void> Function() onTap;
  final bool close;

  @override
  State<_WinButton> createState() => _WinButtonState();
}

class _WinButtonState extends State<_WinButton> {
  bool _over = false;

  @override
  Widget build(BuildContext context) {
    final hover = widget.close
        ? const Color(0xFFE81123)
        : widget.ink.withValues(alpha: 0.12);
    return Semantics(
      button: true,
      label: widget.label,
      excludeSemantics: true,
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => _over = true),
        onExit: (_) => setState(() => _over = false),
        child: GestureDetector(
          onTap: widget.onTap,
          child: Container(
            width: 46,
            height: titleBarHeight,
            color: _over ? hover : Colors.transparent,
            child: Center(
              child: AppIcon(
                widget.icon,
                size: 14,
                stroke: 1.4,
                color: _over && widget.close ? Colors.white : widget.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The macOS menu bar: App, File, Edit, View, Window and Help, wired to the app's actions.
class _MacMenus extends StatelessWidget {
  const _MacMenus({required this.chrome, required this.child});
  final _DesktopChromeState chrome;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ctx = AppNav.context;
    PlatformMenuItem item(
      String label,
      VoidCallback onTap, [
      MenuSerializableShortcut? key,
    ]) => PlatformMenuItem(label: label, onSelected: onTap, shortcut: key);
    return PlatformMenuBar(
      menus: [
        PlatformMenu(
          label: 'uwuCurrency',
          menus: [
            PlatformMenuItemGroup(
              members: [
                item(
                  'Settings…',
                  () => ctx == null ? null : openThemeSheet(ctx),
                  const SingleActivator(LogicalKeyboardKey.comma, meta: true),
                ),
                item('Check for Updates…', Updater.checkNow),
              ],
            ),
            if (PlatformProvidedMenuItem.hasMenu(
              PlatformProvidedMenuItemType.hide,
            ))
              const PlatformProvidedMenuItem(
                type: PlatformProvidedMenuItemType.hide,
              ),
            item(
              'Quit uwuCurrency',
              Desktop.quit,
              const SingleActivator(LogicalKeyboardKey.keyQ, meta: true),
            ),
          ],
        ),
        PlatformMenu(
          label: 'File',
          menus: [
            item(
              'Share Conversion…',
              () => ctx == null ? null : openShareMenu(ctx),
              const SingleActivator(LogicalKeyboardKey.keyE, meta: true),
            ),
            item(
              'Swap Currencies',
              chrome._swap,
              const SingleActivator(
                LogicalKeyboardKey.keyS,
                meta: true,
                shift: true,
              ),
            ),
            item(
              'Close',
              chrome._closeTop,
              const SingleActivator(LogicalKeyboardKey.keyW, meta: true),
            ),
          ],
        ),
        PlatformMenu(
          label: 'Edit',
          menus: [
            item(
              'Find…',
              chrome._focusSearch,
              const SingleActivator(LogicalKeyboardKey.keyF, meta: true),
            ),
            item(
              'Copy Link',
              chrome._copyLink,
              const SingleActivator(
                LogicalKeyboardKey.keyC,
                meta: true,
                shift: true,
              ),
            ),
          ],
        ),
        PlatformMenu(
          label: 'View',
          menus: [
            item(
              'Refresh Rates',
              chrome._reload,
              const SingleActivator(LogicalKeyboardKey.keyR, meta: true),
            ),
            item(
              'Back',
              ViewHistory.back,
              const SingleActivator(LogicalKeyboardKey.bracketLeft, meta: true),
            ),
            item(
              'Forward',
              ViewHistory.forward,
              const SingleActivator(
                LogicalKeyboardKey.bracketRight,
                meta: true,
              ),
            ),
            item(
              'Toggle Full Screen',
              () => Desktop.setFullScreen(!Desktop.fullScreen.value),
              const SingleActivator(
                LogicalKeyboardKey.keyF,
                meta: true,
                control: true,
              ),
            ),
          ],
        ),
        PlatformMenu(
          label: 'Window',
          menus: [
            item(
              'Minimise',
              () => windowManager.minimize(),
              const SingleActivator(LogicalKeyboardKey.keyM, meta: true),
            ),
            item('History', () => HistoryCard.show?.call()),
            item(
              'Share History with Another Device…',
              () => ctx == null ? null : openSync(ctx),
            ),
          ],
        ),
        PlatformMenu(
          label: 'Help',
          menus: [
            item(
              'Show Me Around',
              () => ctx == null ? null : openTourPicker(ctx),
            ),
            item(
              'Report a Bug…',
              () => ctx == null ? null : openBugReport(ctx),
            ),
            item(
              'uwuCurrency on the Web',
              () => Desktop.openExternal(Desktop.site),
            ),
          ],
        ),
      ],
      child: child,
    );
  }
}
