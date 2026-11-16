// The page drawn whole, not just what's on screen: the converter, the graph, History and About,
// top to bottom, at the width the page has. Drawn off to the side of the window, where it's never
// seen, then captured. For the desktop's Long screenshot (lib/desktop/screenshot.dart) and a bug
// report's Screenshot a page (lib/features/bug/bug_report.dart), as the site's html-to-image
// draws its whole page.
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../features/converter/converter_card.dart';
import '../features/graph/graph_card.dart';
import '../features/history/history_card.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import 'home.dart';
import 'nav.dart';

/// `context` is any under the app's theme. At most `maxHeight` pixels tall, and at most `maxSide`
/// along its longer side, its resolution lowered to fit; null if it couldn't be drawn.
Future<ui.Image?> drawWholePage(BuildContext context, {double maxHeight = 16384, double maxSide = 16384}) async {
  // Called from above the navigator too (the title bar): the navigator's overlay.
  final overlay = AppNav.navigatorKey.currentState?.overlay;
  if (overlay == null) return null;
  final key = GlobalKey();
  OverlayEntry? entry;
  try {
    final size = MediaQuery.sizeOf(context);
    final width = math.min(size.width, 980.0);
    final theme = Theme.of(context);
    final ratio = MediaQuery.devicePixelRatioOf(context);
    final mq = MediaQuery.of(context).copyWith(size: Size(width, maxHeight));
    final grid = width >= 880;
    entry = OverlayEntry(
      builder: (_) => Positioned(
        // Far off the window, where it's drawn but never seen.
        left: -size.width * 4 - 20000,
        top: 0,
        child: OverflowBox(
          alignment: Alignment.topLeft,
          minWidth: width,
          maxWidth: width,
          minHeight: 0,
          maxHeight: maxHeight,
          child: RepaintBoundary(
            key: key,
            child: PageShot(
              child: Theme(
                data: theme,
                child: Material(
                  // The page's colour: the glass look's page is see-through.
                  color: theme.extension<UwuColors>()!.bg,
                  child: MediaQuery(
                    data: mq,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (grid)
                            const IntrinsicHeight(
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(flex: 2, child: ConverterCard()),
                                  SizedBox(width: 20),
                                  Expanded(child: AboutCard()),
                                ],
                              ),
                            )
                          else
                            const ConverterCard(),
                          const SizedBox(height: 20),
                          const GraphCard(),
                          const SizedBox(height: 20),
                          const HistoryCard(),
                          if (!grid) ...[const SizedBox(height: 20), const AboutCard()],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    overlay.insert(entry);
    // Long enough for the graph to lay itself out.
    await Future<void>.delayed(const Duration(milliseconds: 700));
    final box = key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (box == null) return null;
    final longest = math.max(box.size.width, box.size.height);
    final r = math.min(ratio, math.min(maxHeight / math.max(box.size.height, 1), maxSide / math.max(longest, 1)));
    return await box.toImage(pixelRatio: r);
  } finally {
    entry?.remove();
  }
}
