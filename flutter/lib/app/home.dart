// The converter's one page (main-site/index.html): the converter, Historical Rates, History and
// About, as the site lays them out, with the edge tray at the top right and the update and
// offline bars above.
//
//   Narrow (a phone)      one column: converter, graph, History, About, as the site's page.
//   Wide (880 px and up)  the site's grid: the converter beside About, then the graph, then
//                         History, each as wide as the page.
//   The desktop, wider    two panes (docs/flutter-desktop-app-spec.md §2.3): the converter and
//   than 1024 px          History in a 400 px pane on the left, the graph (taller) and About
//                         beside them on the right, each scrolling on its own.
//
// Back on Android closes what's open, then asks once more before leaving, and the second press
// sends the app to the background rather than closing it.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api.dart';
import '../features/converter/converter_card.dart';
import '../features/graph/graph_card.dart';
import '../features/history/history_card.dart';
import '../features/tour/tour.dart';
import '../features/update/update_bar.dart';
import '../native/bridge.dart';
import '../theme/icons.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import 'edge_tray.dart';
import 'env.dart';
import 'links.dart';
import 'nav.dart';
import 'state.dart';

/// Where the tray needs room beside the page: below this width the page keeps a strip clear.
const _trayRoomWidth = 1160.0;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  DateTime? _backAt;
  final _converterKey = GlobalKey();
  final _historyKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    Tour.currentPage = () => AppState.I.ready ? 'home' : null;
    Tour.openPage = (_) async {};
    HistoryCard.showConverter = () => _reveal(_converterKey);
    HistoryCard.show = () => _reveal(_historyKey);
    AppState.I.addListener(_readyOnce);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Tour.init(skipFirst: AppState.I.pendingSyncCode != null);
      Links.appShown();
      _readyOnce();
    });
  }

  @override
  void dispose() {
    AppState.I.removeListener(_readyOnce);
    super.dispose();
  }

  bool _toldReady = false;

  // The currencies have loaded: the welcome tour can look for its first step.
  void _readyOnce() {
    if (_toldReady || !AppState.I.ready) return;
    _toldReady = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => AppState.I.pageChanged());
  }

  void _reveal(GlobalKey key) {
    final ctx = key.currentContext;
    if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), curve: Curves.easeOutCubic);
  }

  void _back(bool didPop, Object? _) {
    if (didPop) return;
    if (Tour.active) {
      Tour.end();
      return;
    }
    final now = DateTime.now();
    if (_backAt != null && now.difference(_backAt!) < const Duration(seconds: 2)) {
      _backAt = null;
      // To the background, not closed: a share with another device carries on.
      Native.tryCall('App', 'background').then((r) {
        if (r == null) SystemNavigator.pop();
      });
      return;
    }
    _backAt = now;
    AppNav.toast('Press back again to exit');
  }

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final split = Env.desktop && width > Env.splitWidth;
    final page = ValueListenableBuilder<bool>(
      valueListenable: EdgeTray.open,
      builder: (context, trayOpen, _) {
        // Clear of the open tray where it can't sit beside the page.
        // The desktop's two panes run to the window's edge, so they always leave the tray its room.
        // A phone keeps no strip at all: the page takes the whole width and the tray floats over
        // its right edge, open or tucked away (the converter's header makes room for it).
        final phone = width <= Env.phoneWidth;
        final needsRoom = !phone && (split || width < _trayRoomWidth);
        final trayRoom = !needsRoom ? 0.0 : (trayOpen ? EdgeTray.openWidth + 4.0 : EdgeTray.tabWidth + 6.0);
        return AnimatedPadding(
          duration: Duration(milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 220),
          curve: Curves.easeOutCubic,
          padding: EdgeInsets.only(right: trayRoom),
          child: split ? _split(context) : _scroll(context, width - trayRoom),
        );
      },
    );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: _back,
      child: Scaffold(
        body: Column(
          children: [
            const UpdateBar(),
            ValueListenableBuilder<bool>(
              valueListenable: Api.offline,
              builder: (context, off, _) => off
                  ? Container(
                      width: double.infinity,
                      color: c.warn.withValues(alpha: 0.18),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      child: SafeArea(
                        bottom: false,
                        child: Semantics(
                          liveRegion: true,
                          child: Text(
                            'You’re offline. Conversions use the last rates this device saw.',
                            style: TextStyle(color: c.ink, fontSize: 13),
                          ),
                        ),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
            Expanded(
              child: SafeArea(
                top: !Env.desktop,
                child: Stack(
                  children: [
                    Positioned.fill(child: page),
                    const Positioned(top: 10, right: 0, child: EdgeTray()),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // One scrolling page: a column on a phone, the site's grid when there's room.
  Widget _scroll(BuildContext context, double width) {
    final grid = width >= 880;
    final converter = KeyedSubtree(key: _converterKey, child: const ConverterCard());
    final history = KeyedSubtree(key: _historyKey, child: const HistoryCard());
    return SingleChildScrollView(
      key: const ValueKey('page'),
      padding: EdgeInsets.fromLTRB(16, grid ? 40 : 16, 16, 64),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 980),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: grid
                ? [
                    // Not in an IntrinsicHeight: the converter card lays itself out with a
                    // LayoutBuilder, which can't report its height, so the row took About's
                    // height and cut the converter off below From and To.
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 2, child: converter),
                        const SizedBox(width: 20),
                        const Expanded(flex: 1, child: AboutCard()),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const GraphCard(),
                    const SizedBox(height: 20),
                    history,
                  ]
                : [
                    converter,
                    const SizedBox(height: 20),
                    const GraphCard(),
                    const SizedBox(height: 20),
                    history,
                    const SizedBox(height: 20),
                    const AboutCard(),
                  ],
          ),
        ),
      ),
    );
  }

  // The desktop's two panes: the converter and History on the left, the graph and About on the
  // right, so a conversion and its graph are on screen together.
  Widget _split(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 420,
          child: SingleChildScrollView(
            key: const ValueKey('pane-left'),
            padding: const EdgeInsets.fromLTRB(20, 20, 10, 40),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KeyedSubtree(key: _converterKey, child: const ConverterCard()),
                const SizedBox(height: 16),
                KeyedSubtree(key: _historyKey, child: const HistoryCard()),
              ],
            ),
          ),
        ),
        Expanded(
          child: LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              key: const ValueKey('pane-right'),
              padding: const EdgeInsets.fromLTRB(10, 20, 20, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GraphCard(chartHeight: (box.maxHeight * 0.55).clamp(260, 620)),
                  const SizedBox(height: 16),
                  const AboutCard(),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// About (the site's .card--info): where the rates come from, who made it, and the links.
class AboutCard extends StatelessWidget {
  const AboutCard({super.key});

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    final muted = TextStyle(color: c.muted, fontSize: 14, height: 1.6);
    final link = TextStyle(color: c.brandInk, fontSize: 14, height: 1.6, decoration: TextDecoration.underline, decorationColor: c.brandInk);
    Widget a(String text, String url) => InkWell(
      mouseCursor: WidgetStateMouseCursor.clickable,
      onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      child: Text(text, style: link),
    );
    return GlassPanel(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('About', style: TextStyle(color: c.muted, fontSize: 12.5, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          // One run of text with the link inline, so the sentence wraps as prose rather than
          // breaking onto a new line after the link.
          Text.rich(
            TextSpan(
              style: muted,
              children: [
                const TextSpan(text: 'Live rates via '),
                WidgetSpan(
                  alignment: PlaceholderAlignment.baseline,
                  baseline: TextBaseline.alphabetic,
                  child: a('Frankfurter', 'https://frankfurter.dev'),
                ),
                const TextSpan(text: ', self-hosted. Search by currency code or name (e.g. “USD”, “Euro”).'),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Made with ', style: muted),
              const AppIcon('heart', size: 14, color: Color(0xFFE34948)),
              Text(' by Augy.', style: muted),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              a('Privacy', '$siteOrigin/privacy'),
              a('Buy Augy a Coffee', coffeeUrl),
              a('The website', '$siteOrigin/'),
            ],
          ),
          if (Env.version.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('uwuCurrency ${Env.version}', style: TextStyle(color: c.muted, fontSize: 12)),
            ),
        ],
      ),
    );
  }
}
