// The theme, built in one place for every look and both modes.
//
//   The UwU Apps look   the site's own (main-site/style.css and js/theme.js): seven brand
//                       swatches, the Jua font, flat tinted pages and glass panels. The
//                       desktop's default, and a switch away on Android.
//   Material You        Android's second look: the device's palette and fonts. On by default on
//                       Android 12+, where the system has a palette to give.
//   Glass               the desktop's second look, in place of Material You, as close to its
//                       system's own glass as the system lets an app get (glassKind()):
//                         Windows  Fluent 2: Mica behind the window, Acrylic-like panels over
//                                  it, Segoe UI Variable, the system's accent, 8 px corners
//                         macOS    Tahoe: the desktop through the window (NSVisualEffectView),
//                                  rounded glass panels with a light catching their top edge,
//                                  capsule buttons, SF, the system's accent
//                         Linux    Deepin (DDE) and COSMIC frosted glass: a soft painted
//                                  backdrop in the accent's colours, frosted panels blurred
//                                  over it, 14 px corners, the system's font and accent
//                       The window's own material comes from the runner (lib/desktop/runner.dart
//                       setGlass); where the system has none to give (Linux, Windows 10, the
//                       browser build), the app paints the backdrop itself (GlassBackdrop).
//
// Mode is the site's: light, dark, or time-based (light from 09:00 to 18:00), kept under the
// site's keys so a synced theme means the same on every device. Colours reach widgets as
// tokens (UwuColors), never as literals.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../data/store.dart';

class ColorTheme {
  const ColorTheme(this.id, this.label, this.hex);
  final String id;
  final String label;
  final int hex;
  Color get color => Color(0xFF000000 | hex);
}

/// The site's swatches, by the site's ids and names.
const colorThemes = [
  ColorTheme('classic', 'Classic', 0xccffcc),
  ColorTheme('not-green-1', 'Not green 1', 0xffcccc),
  ColorTheme('not-green-2', 'Not green 2', 0xccccff),
  ColorTheme('not-green-3', 'Not green 3', 0xffffcc),
  ColorTheme('not-green-4', 'Not green 4', 0xffccff),
  ColorTheme('not-green-5', 'Not green 5', 0xccffff),
  ColorTheme('really-light-green', 'Really really light green', 0xffffff),
];

const modePreferences = ['light', 'dark', 'time'];
const lightFromHour = 9;
const lightUntilHour = 18;

const _keyColor = 'uwuconvert.colorTheme';
const _keyMode = 'uwuconvert.mode';
// The site's key from before mode was its own setting, read once and dropped (js/theme.js).
const _keyLegacy = 'uwuconvert.theme';
const _legacyColors = {
  'classic': 'classic',
  'notgreen1': 'not-green-1',
  'notgreen2': 'not-green-2',
  'notgreen3': 'not-green-3',
  'notgreen4': 'not-green-4',
  'notgreen5': 'not-green-5',
  'white': 'really-light-green',
};

/// The app's own key: which look, 'material' or 'uwuapps'. Unset follows the platform.
const keyLook = 'app.look';
const lookMaterial = 'material';
const lookUwuApps = 'uwuapps';
const lookGlass = 'glass';

/// Which glass the desktop's second look is, by its system: 'fluent' (Windows), 'tahoe'
/// (macOS) or 'frosted' (Linux, Deepin and COSMIC). Tests may set it.
String Function() glassKind = () {
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.windows) return 'fluent';
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.macOS) return 'tahoe';
  return 'frosted';
};

/// The second look's name, as the Theme window offers it.
String glassLabel([String? kind]) =>
    const {'fluent': 'Fluent 2', 'tahoe': 'macOS Tahoe', 'frosted': 'Frosted Glass'}[kind ?? glassKind()] ?? 'Glass';

/// What the second look is, in a line.
String glassNote([String? kind]) =>
    const {
      'fluent': 'Windows 11’s own look: Mica and Acrylic, Segoe UI and your accent colour.',
      'tahoe': 'macOS Tahoe’s glass: the desktop through the window, your accent colour and the system’s font.',
      'frosted': 'Deepin and COSMIC’s frosted glass, in your accent colour and the system’s font.',
    }[kind ?? glassKind()] ??
    '';

bool isDaylightHours([DateTime? now]) {
  final h = (now ?? DateTime.now()).hour;
  return h >= lightFromHour && h < lightUntilHour;
}

String resolveMode(String preference, [DateTime? now]) {
  if (preference == 'time') return isDaylightHours(now) ? 'light' : 'dark';
  return preference == 'dark' ? 'dark' : 'light';
}

/// How long until the next 09:00 or 18:00, whichever comes first, with a second of slack.
Duration untilNextBoundary([DateTime? at]) {
  final now = at ?? DateTime.now();
  DateTime next;
  if (now.hour < lightFromHour) {
    next = DateTime(now.year, now.month, now.day, lightFromHour);
  } else if (now.hour < lightUntilHour) {
    next = DateTime(now.year, now.month, now.day, lightUntilHour);
  } else {
    next = DateTime(now.year, now.month, now.day + 1, lightFromHour);
  }
  final ms = next.difference(now).inMilliseconds + 1000;
  return Duration(milliseconds: ms < 1000 ? 1000 : ms);
}

class ThemeController extends ChangeNotifier with WidgetsBindingObserver {
  ThemeController._();
  static final ThemeController I = ThemeController._();

  Timer? _timer;
  bool _watching = false;

  /// Whether the device has a palette of its own to give (Android 12+). Set by the app's root
  /// once the system has answered.
  bool hasDynamic = false;

  /// The desktop's "Use system accent colour", kept in its settings file.
  bool systemAccent = false;

  /// Whether this is the Android app (Env.android, given here to keep the theme free of the app).
  static bool Function() isAndroid = () => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// Whether this is a desktop app (Env.desktop), whose second look is glass, not Material You.
  static bool Function() isDesktop = () => false;

  /// For tests and screenshots: the clock the time-based mode reads.
  DateTime Function() clock = DateTime.now;

  void init() {
    final old = Store.I.get(_keyLegacy);
    if (old != null) {
      if (!Store.I.has(_keyColor) && _legacyColors[old] != null) Store.I.put(_keyColor, _legacyColors[old]);
      Store.I.remove(_keyLegacy);
    }
    _schedule();
    if (!_watching) {
      _watching = true;
      WidgetsBinding.instance.addObserver(this);
    }
  }

  String get colorThemeId {
    final v = Store.I.get(_keyColor);
    return colorThemes.any((t) => t.id == v) ? v! : 'classic';
  }

  ColorTheme get colorTheme => colorThemes.firstWhere((t) => t.id == colorThemeId);

  /// What the person chose, which can be "time".
  String get modePreference {
    final v = Store.I.get(_keyMode);
    return modePreferences.contains(v) ? v! : 'light';
  }

  /// What the app is in right now: only ever light or dark.
  String get mode => resolveMode(modePreference, clock());
  Brightness get brightness => mode == 'dark' ? Brightness.dark : Brightness.light;

  String get look {
    final v = Store.I.get(keyLook);
    // The desktop offers the UwU Apps look and glass; a phone the UwU Apps look and Material You.
    if (isDesktop()) return v == lookGlass ? lookGlass : lookUwuApps;
    if (v == lookMaterial || v == lookUwuApps) return v!;
    return isAndroid() && hasDynamic ? lookMaterial : lookUwuApps;
  }

  bool get isMaterial => look == lookMaterial;
  bool get isGlass => look == lookGlass;

  void setColorTheme(String id) {
    if (!colorThemes.any((t) => t.id == id)) return;
    Store.I.put(_keyColor, id);
    notifyListeners();
  }

  void setMode(String preference) {
    Store.I.put(_keyMode, modePreferences.contains(preference) ? preference : 'light');
    _schedule();
    notifyListeners();
  }

  void setLook(String look) {
    Store.I.put(keyLook, look == lookMaterial || look == lookGlass ? look : lookUwuApps);
    notifyListeners();
  }

  void setSystemAccent(bool on) {
    systemAccent = on;
    notifyListeners();
  }

  void setHasDynamic(bool has) {
    if (hasDynamic == has) return;
    hasDynamic = has;
    // After this frame: it's learnt while building.
    scheduleMicrotask(notifyListeners);
  }

  /// Something else changed the stored theme (a sync, the welcome window).
  void refresh() {
    _schedule();
    notifyListeners();
  }

  // Keeping the time-based mode honest while the app stays open.
  void _schedule() {
    _timer?.cancel();
    _timer = null;
    if (modePreference != 'time') return;
    _timer = Timer(untilNextBoundary(clock()), () {
      _schedule();
      notifyListeners();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && modePreference == 'time') {
      _schedule();
      notifyListeners();
    }
  }
}

/// The colours widgets draw with, by what they're for.
@immutable
class UwuColors extends ThemeExtension<UwuColors> {
  const UwuColors({
    required this.bg,
    required this.surface,
    required this.surfaceStrong,
    required this.border,
    required this.ink,
    required this.muted,
    required this.brand,
    required this.brandInk,
    required this.brandFill,
    required this.brandFillStrong,
    required this.onBrand,
    required this.ok,
    required this.warn,
    required this.busy,
    required this.error,
    required this.errorFill,
    required this.scrim,
    required this.glass,
    this.corner = 18,
    this.page,
    this.glassKind,
    this.glassShine = false,
  });

  final Color bg;
  final Color surface;
  final Color surfaceStrong;
  final Color border;
  final Color ink;
  final Color muted;
  final Color brand;
  final Color brandInk;
  final Color brandFill;
  final Color brandFillStrong;
  final Color onBrand;
  final Color ok;
  final Color warn;
  final Color busy;
  final Color error;
  final Color errorFill;
  final Color scrim;

  /// Whether panels are glass (blurred, see-through) or solid.
  final bool glass;

  /// How round a panel's corners are, in this look.
  final double corner;

  /// The page behind everything, where it isn't `bg`: see-through in the desktop's glass look,
  /// so the window's material (or the painted backdrop) shows.
  final Color? page;

  /// The desktop's glass look's kind ('fluent', 'tahoe', 'frosted'), or null in the others.
  final String? glassKind;

  /// Panels catch the light along their top edge (Tahoe's glass).
  final bool glassShine;

  static UwuColors of(BuildContext context) => Theme.of(context).extension<UwuColors>()!;

  @override
  UwuColors copyWith() => this;

  @override
  UwuColors lerp(ThemeExtension<UwuColors>? other, double t) => t < 0.5 || other is! UwuColors ? this : other;
}

Color _mix(Color a, double amount, Color b) => Color.lerp(b, a, amount)!;

const _ink = Color(0xFF121815);

/// The site's tokens, for one swatch and mode.
UwuColors uwuAppsColors(Color brand, Brightness brightness, {Color? accent}) {
  final dark = brightness == Brightness.dark;
  final base = dark ? const Color(0xFF0C100E) : const Color(0xFFEEF2F0);
  final bg = _mix(brand, 0.10, base);
  // The site's surfaces are white at an opacity over the page. Here they're laid over the page
  // colour once, so words on them keep the contrast the site measured.
  Color over(double a) => Color.alphaBlend(Colors.white.withValues(alpha: a), bg);
  final surface = over(dark ? 0.06 : 0.55);
  final surfaceStrong = over(dark ? 0.11 : 0.78);
  var brandInk = dark ? const Color(0xFFBFF5CF) : const Color(0xFF1F6B3D);
  if (accent != null) {
    final hsl = HSLColor.fromColor(accent);
    brandInk = hsl.withLightness(dark ? 0.82 : 0.28).withSaturation(hsl.saturation.clamp(0.3, 0.75)).toColor();
  }
  final tint = accent == null ? brand : HSLColor.fromColor(accent).withLightness(0.88).toColor();
  final error = dark ? const Color(0xFFFA9696) : const Color(0xFFB91C1C);
  return UwuColors(
    bg: bg,
    surface: surface,
    surfaceStrong: surfaceStrong,
    // Component edges at 3:1 or more against every surface, for all seven brand colours (WCAG
    // 1.4.11): the site's white-on-white glass edges vanish in light mode.
    border: dark ? const Color(0xFF84938A) : const Color(0xFF6F7E75),
    ink: dark ? const Color(0xFFEEF2EF) : _ink,
    muted: dark ? const Color(0xFFB4BEB8) : const Color(0xFF4A554E),
    brand: tint,
    brandInk: brandInk,
    brandFill: _mix(tint, 0.55, surfaceStrong),
    brandFillStrong: _mix(tint, 0.75, surfaceStrong),
    onBrand: _ink,
    ok: dark ? const Color(0xFF4ADE80) : const Color(0xFF0F7234),
    warn: dark ? const Color(0xFFFBBF24) : const Color(0xFFA24B08),
    busy: dark ? const Color(0xFF94A3B8) : const Color(0xFF627288),
    error: error,
    errorFill: _mix(error, 0.14, bg),
    scrim: Colors.black.withValues(alpha: dark ? 0.6 : 0.35),
    glass: true,
  );
}

/// The same tokens from a Material colour scheme.
UwuColors materialColors(ColorScheme s) {
  final dark = s.brightness == Brightness.dark;
  return UwuColors(
    bg: s.surface,
    surface: s.surfaceContainerLow,
    surfaceStrong: s.surfaceContainerHigh,
    // outline, not outlineVariant: Material's outline is the one made for 3:1 edges (WCAG 1.4.11).
    border: s.outline,
    ink: s.onSurface,
    muted: s.onSurfaceVariant,
    brand: s.primaryContainer,
    brandInk: s.primary,
    brandFill: s.primaryContainer,
    brandFillStrong: _mix(s.primary, 0.18, s.primaryContainer),
    onBrand: s.onPrimaryContainer,
    ok: dark ? const Color(0xFF7DDC9A) : const Color(0xFF0F7234),
    warn: dark ? const Color(0xFFFBBF24) : const Color(0xFFA24B08),
    busy: s.onSurfaceVariant,
    error: s.error,
    errorFill: s.errorContainer,
    scrim: s.scrim.withValues(alpha: dark ? 0.6 : 0.4),
    glass: false,
  );
}

/// The desktop's glass look's tokens: see-through surfaces over the window's material, in the
/// system's accent. `kind` is glassKind()'s.
UwuColors glassColors(Brightness brightness, Color accent, String kind) {
  final dark = brightness == Brightness.dark;
  final hsl = HSLColor.fromColor(accent);
  final accentInk = hsl.withLightness(dark ? 0.78 : 0.36).withSaturation(hsl.saturation.clamp(0.35, 0.9)).toColor();
  final accentFill = hsl.withLightness(dark ? 0.62 : 0.45).withSaturation(hsl.saturation.clamp(0.35, 0.9)).toColor();
  final onAccent = ThemeData.estimateBrightnessForColor(accentFill) == Brightness.dark ? Colors.white : const Color(0xFF111111);
  final error = dark ? const Color(0xFFFF99A4) : const Color(0xFFC42B1C);
  late final Color bg, surface, surfaceStrong, border, ink, muted;
  late final double corner;
  switch (kind) {
    case 'fluent':
      // Fluent 2's card and layer fills over Mica, its neutral text and its control strokes.
      bg = dark ? const Color(0xFF202020) : const Color(0xFFF3F3F3);
      surface = dark ? const Color(0x0DFFFFFF) : const Color(0xB3FFFFFF);
      surfaceStrong = dark ? const Color(0x15FFFFFF) : const Color(0xE6FFFFFF);
      border = dark ? const Color(0x5CFFFFFF) : const Color(0x52000000);
      ink = dark ? const Color(0xFFFFFFFF) : const Color(0xE4000000);
      muted = dark ? const Color(0xC5FFFFFF) : const Color(0x9E000000);
      corner = 8;
    case 'tahoe':
      // Tahoe's Liquid Glass: clear, bright panels with a soft edge, over the desktop.
      bg = dark ? const Color(0xFF1C1C1E) : const Color(0xFFF2F2F7);
      surface = dark ? const Color(0x24FFFFFF) : const Color(0x8CFFFFFF);
      surfaceStrong = dark ? const Color(0x38FFFFFF) : const Color(0xC7FFFFFF);
      border = dark ? const Color(0x52FFFFFF) : const Color(0x47000000);
      ink = dark ? const Color(0xFFF5F5F7) : const Color(0xFF1D1D1F);
      muted = dark ? const Color(0xFFAEAEB2) : const Color(0xFF5E5E63);
      corner = 22;
    default:
      // Deepin's and COSMIC's frosted panels: a little more body than Tahoe's.
      bg = dark ? const Color(0xFF15181D) : const Color(0xFFEEF1F5);
      surface = dark ? const Color(0x2E2A3038) : const Color(0x99FFFFFF);
      surfaceStrong = dark ? const Color(0x4D2A3038) : const Color(0xD1FFFFFF);
      border = dark ? const Color(0x57FFFFFF) : const Color(0x4D000000);
      ink = dark ? const Color(0xFFF1F3F6) : const Color(0xFF1B1F24);
      muted = dark ? const Color(0xFFB2B8C2) : const Color(0xFF545B66);
      corner = 14;
  }
  return UwuColors(
    bg: bg,
    surface: surface,
    surfaceStrong: surfaceStrong,
    border: border,
    ink: ink,
    muted: muted,
    brand: accent,
    brandInk: accentInk,
    brandFill: accentFill,
    brandFillStrong: Color.lerp(accentFill, dark ? Colors.white : Colors.black, 0.12)!,
    onBrand: onAccent,
    ok: dark ? const Color(0xFF6CCB5F) : const Color(0xFF0F7B0F),
    warn: dark ? const Color(0xFFFCE100) : const Color(0xFF9D5D00),
    busy: muted,
    error: error,
    errorFill: Color.alphaBlend(error.withValues(alpha: 0.14), bg),
    scrim: Colors.black.withValues(alpha: dark ? 0.5 : 0.3),
    glass: true,
    corner: corner,
    page: Colors.transparent,
    glassKind: kind,
    glassShine: kind == 'tahoe',
  );
}

/// The whole theme. `dynamicScheme` is the device's palette (Material You), or the desktop's
/// accent as a scheme, when there is one.
ThemeData buildTheme({
  required String look,
  required Brightness brightness,
  required Color brand,
  ColorScheme? dynamicScheme,
  bool systemAccent = false,
  bool highContrast = false,
  bool desktop = false,
}) {
  final material = look == lookMaterial;
  final glassLook = look == lookGlass;
  late final ColorScheme scheme;
  late final UwuColors colors;
  if (glassLook) {
    colors = glassColors(brightness, dynamicScheme?.primary ?? const Color(0xFF0067C0), glassKind());
    scheme = ColorScheme.fromSeed(seedColor: colors.brandFill, brightness: brightness).copyWith(
      primary: colors.brandInk,
      onPrimary: colors.onBrand,
      primaryContainer: colors.brandFill,
      onPrimaryContainer: colors.onBrand,
      secondaryContainer: colors.brandFill,
      onSecondaryContainer: colors.onBrand,
      surface: colors.bg,
      onSurface: colors.ink,
      onSurfaceVariant: colors.muted,
      surfaceContainerLowest: colors.bg,
      surfaceContainerLow: Color.alphaBlend(colors.surface, colors.bg),
      surfaceContainer: Color.alphaBlend(colors.surface, colors.bg),
      surfaceContainerHigh: Color.alphaBlend(colors.surfaceStrong, colors.bg),
      surfaceContainerHighest: Color.alphaBlend(colors.surfaceStrong, colors.bg),
      outline: colors.muted,
      outlineVariant: colors.border,
      error: colors.error,
      onError: colors.bg,
      errorContainer: colors.errorFill,
      onErrorContainer: colors.error,
    );
  } else if (material) {
    scheme = (dynamicScheme ?? ColorScheme.fromSeed(seedColor: const Color(0xFF22A85A), brightness: brightness, contrastLevel: highContrast ? 1.0 : 0.0))
        .copyWith(brightness: brightness);
    colors = materialColors(scheme);
  } else {
    colors = uwuAppsColors(brand, brightness, accent: systemAccent ? dynamicScheme?.primary : null);
    scheme = ColorScheme.fromSeed(seedColor: colors.brandInk, brightness: brightness).copyWith(
      primary: colors.brandInk,
      onPrimary: colors.bg,
      primaryContainer: colors.brandFill,
      onPrimaryContainer: colors.onBrand,
      secondaryContainer: colors.brandFill,
      onSecondaryContainer: colors.onBrand,
      surface: colors.bg,
      onSurface: colors.ink,
      onSurfaceVariant: colors.muted,
      surfaceContainerLowest: colors.bg,
      surfaceContainerLow: colors.surface,
      surfaceContainer: colors.surface,
      surfaceContainerHigh: colors.surfaceStrong,
      surfaceContainerHighest: colors.surfaceStrong,
      outline: colors.muted,
      outlineVariant: colors.border,
      error: colors.error,
      onError: colors.bg,
      errorContainer: colors.errorFill,
      onErrorContainer: colors.error,
    );
  }

  final kind = colors.glassKind;
  // Controls' corners: Fluent's 4, Tahoe's capsules (a large radius on a short control), the
  // frosted look's 10.
  final radius = BorderRadius.circular(
    glassLook
        ? (kind == 'fluent'
              ? 4
              : kind == 'tahoe'
              ? 20
              : 10)
        : (material ? 14 : 10),
  );
  // The UwU Apps look's Jua; the system's own font in Material You and in glass, Windows' by name.
  final String? font = glassLook ? (kind == 'fluent' ? 'Segoe UI Variable Text' : null) : (material ? null : 'Jua');
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    brightness: brightness,
    fontFamily: font,
    fontFamilyFallback: kind == 'fluent' ? const ['Segoe UI', 'Segoe UI Emoji'] : null,
    scaffoldBackgroundColor: colors.page ?? colors.bg,
    // A computer's rows and buttons are closer set than a phone's.
    visualDensity: desktop ? VisualDensity.compact : VisualDensity.standard,
    extensions: [colors],
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: colors.ink, displayColor: colors.ink),
    iconTheme: IconThemeData(color: colors.ink, size: 20),
    dividerTheme: DividerThemeData(color: colors.border, space: 1, thickness: 1),
    tooltipTheme: TooltipThemeData(
      waitDuration: const Duration(milliseconds: 400),
      decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(8)),
      textStyle: TextStyle(color: colors.bg, fontSize: 12, fontFamily: font),
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      filled: true,
      fillColor: colors.surfaceStrong,
      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: desktop ? 10 : 13),
      hintStyle: TextStyle(color: colors.muted),
      border: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: colors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: colors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: colors.brandInk, width: 2),
      ),
    ),
    // Flutter gives buttons a pointing hand only on the web, and the arrow everywhere else; the
    // site points at what can be pressed, so every button here does the same, on the desktop too.
    // InkWells, dropdowns and chips can't take this from the theme, so they name it themselves.
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: material ? null : colors.brandFill,
        foregroundColor: material ? null : colors.onBrand,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: material || glassLook ? BorderSide.none : BorderSide(color: colors.border),
        ),
        padding: EdgeInsets.symmetric(horizontal: 18, vertical: desktop ? 12 : 14),
        textStyle: TextStyle(fontFamily: font, fontSize: 14, fontWeight: material || glassLook ? FontWeight.w600 : FontWeight.w400),
        enabledMouseCursor: SystemMouseCursors.click,
        disabledMouseCursor: SystemMouseCursors.basic,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.ink,
        backgroundColor: material ? null : colors.surfaceStrong,
        side: BorderSide(color: colors.border),
        shape: RoundedRectangleBorder(borderRadius: radius),
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: desktop ? 10 : 12),
        textStyle: TextStyle(fontFamily: font, fontSize: 13),
        enabledMouseCursor: SystemMouseCursors.click,
        disabledMouseCursor: SystemMouseCursors.basic,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: colors.brandInk,
        textStyle: TextStyle(fontFamily: font, fontSize: 13),
        enabledMouseCursor: SystemMouseCursors.click,
        disabledMouseCursor: SystemMouseCursors.basic,
      ),
    ),
    iconButtonTheme: const IconButtonThemeData(style: ButtonStyle(mouseCursor: WidgetStateMouseCursor.clickable)),
    popupMenuTheme: const PopupMenuThemeData(mouseCursor: WidgetStateMouseCursor.clickable),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? colors.brandInk : null),
      checkColor: WidgetStatePropertyAll(colors.bg),
      side: BorderSide(color: colors.muted, width: 1.5),
      mouseCursor: WidgetStateMouseCursor.clickable,
    ),
    switchTheme: material
        ? null
        : SwitchThemeData(
            trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? colors.brandInk : colors.surfaceStrong),
            thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? colors.bg : colors.muted),
            trackOutlineColor: WidgetStatePropertyAll(colors.border),
          ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: colors.ink,
      contentTextStyle: TextStyle(color: colors.bg, fontFamily: font, fontSize: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: colors.glass ? Color.alphaBlend(colors.surfaceStrong.withValues(alpha: 0.9), colors.bg) : scheme.surfaceContainerHigh,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(material ? 28 : (glassLook ? colors.corner + 4 : 18)),
        side: BorderSide(color: colors.border),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.glass ? Color.alphaBlend(colors.surfaceStrong.withValues(alpha: 0.9), colors.bg) : scheme.surfaceContainerLow,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(material ? 28 : 18))),
    ),
    scrollbarTheme: ScrollbarThemeData(
      thumbColor: WidgetStatePropertyAll(colors.muted.withValues(alpha: 0.5)),
      thickness: const WidgetStatePropertyAll(8),
      radius: const Radius.circular(4),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: colors.surface,
      indicatorColor: colors.brandFill,
      selectedIconTheme: IconThemeData(color: colors.onBrand, size: 20),
      unselectedIconTheme: IconThemeData(color: colors.ink, size: 20),
      selectedLabelTextStyle: TextStyle(color: colors.ink, fontSize: 11, fontFamily: font),
      unselectedLabelTextStyle: TextStyle(color: colors.muted, fontSize: 11, fontFamily: font),
    ),
  );
}
