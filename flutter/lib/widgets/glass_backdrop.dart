// The desktop's glass look's backdrop, where the system has no material to put behind the window
// (Linux, whose Deepin and COSMIC blur only their own windows; Windows, Fluent 2's Mica-like
// backdrop; the browser build): a soft wash of the accent's colours, blurred, as a frosted
// desktop would show through. On macOS (NSVisualEffectView) the window's own material shows
// instead, and this stays away (lib/desktop/desktop_main.dart sets [native]).
import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/theme.dart';

class GlassBackdrop extends StatelessWidget {
  const GlassBackdrop({super.key});

  /// The window has its system's material behind it, so nothing is painted here.
  static final ValueNotifier<bool> native = ValueNotifier(false);

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final hsl = HSLColor.fromColor(c.brand);
    Color hue(double shift, double light) =>
        hsl.withHue((hsl.hue + shift) % 360).withLightness(light).withSaturation((hsl.saturation * 0.85).clamp(0.25, 0.8)).toColor();
    final base = dark ? const Color(0xFF14171C) : const Color(0xFFE9EDF3);
    Widget blob(Alignment at, double size, Color colour) => Align(
      alignment: at,
      child: FractionallySizedBox(
        widthFactor: size,
        heightFactor: size,
        child: DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: colour)),
      ),
    );
    return ColoredBox(
      color: base,
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 90, sigmaY: 90, tileMode: TileMode.decal),
        child: Stack(
          fit: StackFit.expand,
          children: [
            blob(const Alignment(-1.1, -1.0), 0.9, hue(0, dark ? 0.30 : 0.78).withValues(alpha: dark ? 0.55 : 0.65)),
            blob(const Alignment(1.1, -0.6), 0.75, hue(45, dark ? 0.28 : 0.80).withValues(alpha: dark ? 0.45 : 0.55)),
            blob(const Alignment(0.2, 1.2), 0.95, hue(-40, dark ? 0.26 : 0.82).withValues(alpha: dark ? 0.45 : 0.55)),
          ],
        ),
      ),
    );
  }
}
