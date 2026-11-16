// The app's root: the theme (the device's Material You palette when there is one, or the
// desktop's glass over the window's material), the navigator and messenger keys, the converter,
// and the desktop's chrome round all of it where it applies.
import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';

import '../desktop/adaptive.dart';
import '../features/bug/bug_report.dart';
import '../features/update/update_bar.dart';
import '../theme/theme.dart';
import '../widgets/glass_backdrop.dart';
import '../widgets/sheet.dart';
import 'env.dart';
import 'home.dart';
import 'nav.dart';
import 'state.dart';

/// Wraps the app on the desktop: the title bar, the command bar and the shortcuts
/// (lib/desktop/chrome.dart). Set by the desktop's start-up.
Widget Function(BuildContext context, Widget child)? desktopChrome;

/// For the Playwright suite: a device palette, as Android 12+ would give one.
ColorScheme? testLightDynamic;
ColorScheme? testDarkDynamic;

/// The desktop's system accent, as a colour scheme, when "Use system accent colour" is on.
ColorScheme? Function(Brightness brightness)? desktopAccentScheme;

class UwuCurrencyApp extends StatefulWidget {
  const UwuCurrencyApp({super.key});

  @override
  State<UwuCurrencyApp> createState() => _UwuCurrencyAppState();
}

class _UwuCurrencyAppState extends State<UwuCurrencyApp> {
  @override
  void initState() {
    super.initState();
    // A window opening or closing changes what's on screen, for the tours.
    AppSheet.open.addListener(AppState.I.pageChanged);
  }

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(
      builder: (deviceLight, deviceDark) {
        final lightDynamic = testLightDynamic ?? deviceLight;
        final darkDynamic = testDarkDynamic ?? deviceDark;
        ThemeController.I.setHasDynamic(lightDynamic != null && Env.android);
        lightDynamicScheme = lightDynamic?.harmonized();
        darkDynamicScheme = darkDynamic?.harmonized();
        return ListenableBuilder(
          listenable: ThemeController.I,
          builder: (context, _) {
            final t = ThemeController.I;
            final brand = t.colorTheme.color;
            ThemeData make(Brightness b, {bool hc = false}) {
              // Material You: the device's palette. Glass, and the UwU Apps look with "Use system
              // accent colour" on: the computer's accent.
              final ColorScheme? dyn = t.isMaterial
                  ? (b == Brightness.dark ? darkDynamic : lightDynamic)?.harmonized()
                  : (t.systemAccent || t.isGlass ? desktopAccentScheme?.call(b) : null);
              return buildTheme(
                look: t.look,
                brightness: b,
                brand: brand,
                dynamicScheme: dyn,
                systemAccent: t.systemAccent,
                highContrast: hc,
                desktop: Env.desktop,
              );
            }

            final b = t.brightness;
            return MaterialApp(
              title: 'uwuCurrency',
              debugShowCheckedModeBanner: false,
              navigatorKey: AppNav.navigatorKey,
              scaffoldMessengerKey: AppNav.messengerKey,
              scrollBehavior: const AppScrollBehavior(),
              theme: make(b),
              highContrastTheme: make(b, hc: true),
              themeAnimationDuration: const Duration(milliseconds: 250),
              builder: (context, child) {
                // Text grows with the device's setting, up to twice, so layouts hold.
                final mq = MediaQuery.of(context);
                Widget app = MediaQuery(
                  data: mq.copyWith(textScaler: mq.textScaler.clamp(minScaleFactor: 1, maxScaleFactor: 2)),
                  // Fills what it's given, as the navigator did on its own. The desktop's title bar
                  // puts the app in a Column, whose width is loose: sized by its children, the
                  // Stack would be as wide as the hidden bar's SizedBox.shrink, 0, and the window
                  // black (1.0.2).
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Positioned.fill(child: RepaintBoundary(key: AppNav.repaintKey, child: child ?? const SizedBox.shrink())),
                      // A bug report's Screenshot a page: outside what's taken, so not in the picture.
                      ValueListenableBuilder<bool>(
                        valueListenable: BugShot.shooting,
                        builder: (context, shooting, _) => shooting ? const BugShotBar() : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                );
                final chrome = desktopChrome;
                if (chrome != null) app = chrome(context, app);
                // The glass look over a system with no material of its own to put behind the
                // window: the app paints a frosted backdrop itself. The same shape of tree in
                // every look, so switching looks doesn't build the app (and its focus) afresh.
                return ValueListenableBuilder<bool>(
                  valueListenable: GlassBackdrop.native,
                  child: app,
                  builder: (context, native, child) => Stack(
                    fit: StackFit.expand,
                    children: [
                      Positioned.fill(child: t.isGlass && !native ? const GlassBackdrop() : const SizedBox.shrink()),
                      child!,
                    ],
                  ),
                );
              },
              home: const HomeScreen(),
            );
          },
        );
      },
    );
  }
}
