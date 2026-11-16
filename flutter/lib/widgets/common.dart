// Small pieces the screens share: the site's glass panels and round glass buttons, a small icon
// button, a field's label and a form's error.
import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/icons.dart';
import '../theme/theme.dart';

/// The site's .glass-panel: a see-through panel with a bright edge, solid in Material You. In the
/// desktop's glass look it takes that look's corners, and Tahoe's catches the light along its top.
class GlassPanel extends StatelessWidget {
  const GlassPanel({super.key, required this.child, this.radius, this.padding, this.strong = false, this.blur = true});

  final Widget child;
  final double? radius;
  final EdgeInsets? padding;
  final bool strong;
  final bool blur;

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    final r = radius ?? c.corner;
    final box = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: strong ? c.surfaceStrong : c.surface,
        borderRadius: BorderRadius.circular(r),
        border: Border.all(color: c.border),
        boxShadow: c.glass ? [BoxShadow(color: Colors.black.withValues(alpha: c.glassKind == null ? 0.08 : 0.12), blurRadius: 24, offset: const Offset(0, 8))] : null,
      ),
      // Liquid glass: light along the top edge, fading down the panel.
      foregroundDecoration: c.glassShine
          ? BoxDecoration(
              borderRadius: BorderRadius.circular(r),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0, 0.08, 0.35],
                colors: [Colors.white.withValues(alpha: 0.28), Colors.white.withValues(alpha: 0.06), Colors.white.withValues(alpha: 0)],
              ),
            )
          : null,
      child: child,
    );
    if (!c.glass || !blur) return box;
    return ClipRRect(
      borderRadius: BorderRadius.circular(r),
      child: BackdropFilter(filter: ImageFilter.blur(sigmaX: c.glassKind == null ? 14 : 24, sigmaY: c.glassKind == null ? 14 : 24), child: box),
    );
  }
}

/// The site's .glass-btn: a round icon button, labelled for screen readers and with its label
/// on hover (and, in the edge tray, on a long press).
class GlassButton extends StatelessWidget {
  const GlassButton({super.key, required this.icon, required this.label, required this.onPressed, this.danger = false, this.size = 44, this.active = false});

  final String icon;
  final String label;
  final VoidCallback? onPressed;
  final bool danger;
  final double size;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    return Tooltip(
      excludeFromSemantics: true,
      message: label,
      child: Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: Material(
          color: active ? c.brandFill : c.surfaceStrong,
          shape: CircleBorder(side: BorderSide(color: c.border)),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            mouseCursor: WidgetStateMouseCursor.clickable,
            onTap: onPressed,
            child: SizedBox(
              width: size,
              height: size,
              child: Center(
                child: AppIcon(icon, size: size * 0.45, color: danger ? c.error : (active ? c.onBrand : c.ink)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A small square icon button (the site's .mini-btn).
class MiniButton extends StatelessWidget {
  const MiniButton({super.key, required this.icon, required this.label, required this.onPressed, this.size = 30, this.color});

  final String icon;
  final String label;
  final VoidCallback? onPressed;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    return Tooltip(
      excludeFromSemantics: true,
      message: label,
      child: Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: InkWell(
          mouseCursor: WidgetStateMouseCursor.clickable,
          borderRadius: BorderRadius.circular(8),
          onTap: onPressed,
          child: SizedBox(
            width: size,
            height: size,
            child: Center(
              child: AppIcon(icon, size: size * 0.52, color: color ?? c.muted),
            ),
          ),
        ),
      ),
    );
  }
}

/// A form field's label, as the site writes them.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.note});
  final String text;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, top: 12),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: text,
              style: TextStyle(fontSize: 12.5, color: c.muted, fontWeight: FontWeight.w600),
            ),
            if (note != null)
              TextSpan(
                text: ' $note',
                style: TextStyle(fontSize: 12, color: c.muted),
              ),
          ],
        ),
      ),
    );
  }
}

/// The error under a form (the site's .form-error).
class FormError extends StatelessWidget {
  const FormError(this.message, {super.key});
  final String? message;

  @override
  Widget build(BuildContext context) {
    final m = message;
    if (m == null || m.isEmpty) return const SizedBox.shrink();
    final c = UwuColors.of(context);
    return Semantics(
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(color: c.errorFill, borderRadius: BorderRadius.circular(8)),
        child: Text(m, style: TextStyle(color: c.error, fontSize: 13)),
      ),
    );
  }
}

/// Round a copy of the page drawn off screen for a picture of it (app/page_shot.dart): the
/// widgets under it leave out their global keys (tour targets, the answer's picture), which the
/// page on screen already holds.
class PageShot extends InheritedWidget {
  const PageShot({super.key, required super.child});

  static bool of(BuildContext context) => context.getInheritedWidgetOfExactType<PageShot>() != null;

  @override
  bool updateShouldNotify(PageShot oldWidget) => false;
}
