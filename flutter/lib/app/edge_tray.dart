// The edge tray (docs/edge-tray-spec.md, main-site/js/tray.js): the app's actions in a column at
// the top right, with a tab that slides it off the edge: Theme, History, Share with another
// device, Updates (Android), Show me around and Report a bug. Open unless it was last left
// collapsed. A long press on a button shows its label.
import 'package:flutter/material.dart';

import '../data/store.dart';
import '../features/bug/bug_report.dart';
import '../features/history/history_card.dart';
import '../features/sync/sync_sheet.dart';
import '../features/theme/theme_sheet.dart';
import '../features/tour/tour.dart';
import '../features/update/update_bar.dart';
import '../theme/icons.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import 'env.dart';

const _trayKey = 'uwuconvert.trayOpen';

class EdgeTray extends StatefulWidget {
  const EdgeTray({super.key});

  /// Whether it's open. Where the window isn't wide enough for it beside the page, the page
  /// keeps a strip clear for it while it is (home.dart).
  static final ValueNotifier<bool> open = ValueNotifier(true);

  /// How far it reaches in from the right edge: just the tab when it's closed, and the tab, its
  /// gap, a button and the edge's margin when it's open.
  static const tabWidth = 26.0;
  static const openWidth = tabWidth + 6 + 44 + 10;

  @override
  State<EdgeTray> createState() => _EdgeTrayState();
}

class _EdgeTrayState extends State<EdgeTray> {
  bool get _open => EdgeTray.open.value;

  @override
  void initState() {
    super.initState();
    EdgeTray.open.value = Store.I.get(_trayKey) != '0';
  }

  void _toggle() {
    setState(() => EdgeTray.open.value = !_open);
    Store.I.put(_trayKey, _open ? '1' : '0');
  }

  Widget _button(String target, String icon, String label, VoidCallback onTap, {bool danger = false}) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: KeyedSubtree(
      key: TourTargets.key(target),
      child: Tooltip(
        excludeFromSemantics: true,
        triggerMode: TooltipTriggerMode.longPress,
        message: label,
        preferBelow: false,
        child: GlassButton(icon: icon, label: label, onPressed: onTap, danger: danger),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: KeyedSubtree(
            key: TourTargets.key('tray-tab'),
            child: Semantics(
              button: true,
              expanded: _open,
              label: _open ? 'Hide menu' : 'Show menu',
              excludeSemantics: true,
              child: Tooltip(
                excludeFromSemantics: true,
                message: _open ? 'Hide menu' : 'Show menu',
                child: Material(
                  color: c.surfaceStrong,
                  shape: RoundedRectangleBorder(
                    borderRadius: const BorderRadius.horizontal(left: Radius.circular(12)),
                    side: BorderSide(color: c.border),
                  ),
                  child: InkWell(
                    mouseCursor: WidgetStateMouseCursor.clickable,
                    borderRadius: const BorderRadius.horizontal(left: Radius.circular(12)),
                    onTap: _toggle,
                    child: SizedBox(
                      width: 26,
                      height: 44,
                      child: Center(child: AppIcon(_open ? 'chevron-right' : 'chevron-left', size: 16, color: c.ink)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        AnimatedSize(
          duration: Duration(milliseconds: reduce ? 0 : 220),
          curve: Curves.easeOutCubic,
          alignment: Alignment.centerLeft,
          child: !_open
              ? const SizedBox(width: 0)
              : Padding(
                  padding: const EdgeInsets.only(left: 6, right: 10),
                  child: KeyedSubtree(
                    key: TourTargets.key('tray-buttons'),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _button('tray-theme', ThemeController.I.mode == 'dark' ? 'moon' : 'sun', 'Theme: colour, light or dark', () => openThemeSheet(context)),
                        _button('tray-history', 'history', 'History of your conversions', () => HistoryCard.show?.call()),
                        _button('tray-sync', 'sync', 'Share history with another device', () => openSync(context)),
                        if (Env.android) _button('tray-updates', 'download', 'Updates', openUpdates),
                        _button('tray-tour', 'help', 'Show me around', () => openTourPicker(context)),
                        _button('tray-bug', 'bug', 'Report a bug', () => openBugReport(context)),
                      ],
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}
