// History (main-site/js/history.js's card): every conversion that settled, newest first, kept on
// this device. Pressing one converts it again; × forgets it; Clear forgets them all here; Share
// copies them to another device (features/sync/). The first eight show, then "Show all".
// On the desktop a right-click on one opens the desktop's own menu for it (desktopEntryActions).
import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../app/state.dart';
import '../../data/history.dart';
import '../../desktop/adaptive.dart';
import '../../theme/icons.dart';
import '../../theme/theme.dart';
import '../../widgets/common.dart';
import '../sync/sync_sheet.dart';
import '../tour/tour.dart';

const _short = 8;

/// The desktop's extra actions for an entry, set by its start-up: Pin to Desktop Widget and Set
/// as Tray Rate (docs/desktop-features-spec.md §8, §9).
List<MenuAction> Function(HistoryEntry e)? desktopEntryActions;

/// The app's own link for a pair, for Copy Link and the Jump List.
String pairLink(String from, String to, [double? amount]) =>
    'uwu://currency/pair/$from/$to${amount == null ? '' : '/${amount.toString().replaceFirst(RegExp(r'\.0$'), '')}'}';

/// Puts an entry back in the converter and brings the converter into view.
Future<void> reopenEntry(HistoryEntry e) async {
  final ok = await AppState.I.applyHistory(e);
  if (!ok) AppNav.toast('That currency is no longer available');
  HistoryCard.showConverter?.call();
}

class HistoryCard extends StatefulWidget {
  const HistoryCard({super.key});

  /// Set by the home screen: scrolls the converter into view.
  static void Function()? showConverter;

  /// Set by the home screen: scrolls History into view (the tray's History button).
  static void Function()? show;

  @override
  State<HistoryCard> createState() => _HistoryCardState();
}

class _HistoryCardState extends State<HistoryCard> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ConvHistory.I,
      builder: (context, _) {
        final c = UwuColors.of(context);
        final list = ConvHistory.I.all;
        final shown = _all ? list : list.take(_short).toList();
        return TourTargets.wrap(context, 'history-card', GlassPanel(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 12,
                  runSpacing: 10,
                  children: [
                    Semantics(
                      header: true,
                      child: Text('History', style: TextStyle(fontSize: 18, color: c.ink, fontWeight: FontWeight.w700)),
                    ),
                    Wrap(
                      spacing: 8,
                      children: [
                        TourTargets.wrap(context, 'history-share', OutlinedButton.icon(
                            key: const ValueKey('history-share'),
                            onPressed: () => openSync(context),
                            icon: AppIcon('sync', size: 15, color: c.ink),
                            label: const Text('Share'),
                          ),
                        ),
                        if (list.isNotEmpty)
                          TourTargets.wrap(context, 'history-clear', OutlinedButton.icon(
                              key: const ValueKey('history-clear'),
                              style: OutlinedButton.styleFrom(foregroundColor: c.error),
                              onPressed: () async {
                                if (await AppNav.confirm('Clear every conversion saved on this device? Other devices keep theirs.', yes: 'Clear')) {
                                  ConvHistory.I.clear();
                                }
                              },
                              icon: AppIcon('trash', size: 15, color: c.error),
                              label: const Text('Clear'),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  list.isEmpty ? 'Your conversions will be kept here, on this device only.' : '${list.length} saved on this device',
                  key: const ValueKey('history-count'),
                  style: TextStyle(color: c.muted, fontSize: 13),
                ),
                const SizedBox(height: 8),
                for (var i = 0; i < shown.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: i == 0 ? TourTargets.wrap(context, 'history-first', _row(c, shown[i])) : _row(c, shown[i]),
                  ),
                if (list.length > _short)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton(
                      key: const ValueKey('history-more'),
                      onPressed: () => setState(() => _all = !_all),
                      child: Text(_all ? 'Show fewer' : 'Show all ${list.length}'),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _row(UwuColors c, HistoryEntry e) {
    final actions = [
      MenuAction('Convert again', () => reopenEntry(e), icon: 'refresh'),
      ...?desktopEntryActions?.call(e),
      MenuAction('Copy Link', () async {
        await copyText(pairLink(e.from, e.to, e.amount));
        AppNav.toast('Link copied');
      }, icon: 'link'),
      MenuAction('Remove', () => ConvHistory.I.remove(e.id), icon: 'trash', danger: true),
    ];
    return ContextMenuRegion(
      actions: () => actions,
      longPress: true,
      child: Container(
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border.withValues(alpha: 0.6)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                button: true,
                label: '${e.line}. ${e.sub}. Convert this again',
                excludeSemantics: true,
                child: InkWell(
                  key: ValueKey('history-${e.id}'),
                  mouseCursor: WidgetStateMouseCursor.clickable,
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => reopenEntry(e),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.line, style: TextStyle(color: c.ink, fontSize: 16)),
                        const SizedBox(height: 2),
                        Text(e.sub, style: TextStyle(color: c.muted, fontSize: 12.5)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            MiniButton(
              key: ValueKey('history-remove-${e.id}'),
              icon: 'close',
              label: 'Remove ${e.line} from history',
              size: 34,
              onPressed: () => ConvHistory.I.remove(e.id),
            ),
            const SizedBox(width: 6),
          ],
        ),
      ),
    );
  }
}
