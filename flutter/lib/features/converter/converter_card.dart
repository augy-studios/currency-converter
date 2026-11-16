// The converter (the site's .card--converter): the amount, From and To with Swap between them,
// the answer and its rate, and Convert, Invert rate and Share. It converts as the amount is
// typed (after a quarter of a second without a key), and when either currency is picked, as the
// site does. Which conversions are remembered is AppState's (History).
import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api.dart';
import '../../app/edge_tray.dart';
import '../../app/env.dart';
import '../../app/files.dart';
import '../../app/nav.dart';
import '../../app/state.dart';
import '../../data/currency.dart';
import '../../native/bridge.dart';
import '../../theme/icons.dart';
import '../../theme/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/sheet.dart';
import '../tour/tour.dart';
import 'currency_picker.dart';

const coffeeUrl = 'https://donate.stripe.com/28o2akeAr3hv0DK6oo';

/// Round the answer, for Share's picture of it.
final resultKey = GlobalKey();

/// The Amount field, for the desktop's command bar and shortcuts to focus.
final amountFocus = FocusNode(debugLabel: 'amount');

class ConverterCard extends StatefulWidget {
  const ConverterCard({super.key});

  @override
  State<ConverterCard> createState() => _ConverterCardState();
}

class _ConverterCardState extends State<ConverterCard> {
  late final TextEditingController _amount;
  Timer? _typing;

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(text: AppState.I.amountText);
    AppState.I.addListener(_follow);
  }

  @override
  void dispose() {
    AppState.I.removeListener(_follow);
    _typing?.cancel();
    _amount.dispose();
    super.dispose();
  }

  // The amount changed elsewhere (a history entry, a link, shared words): the field follows.
  void _follow() {
    final a = AppState.I.amountText;
    if (_amount.text != a && !amountFocus.hasFocus) _amount.text = a;
  }

  Future<void> _convert(Record record) async {
    final error = await AppState.I.convert(record: record);
    if (error != null) AppNav.toast(error);
  }

  void _typed(String text) {
    AppState.I.setAmount(text);
    _typing?.cancel();
    _typing = Timer(const Duration(milliseconds: 250), () => _convert(Record.soon));
  }

  Future<void> _pick(bool from) async {
    final app = AppState.I;
    if (app.currencies.isEmpty) {
      AppNav.toast('Could not load currencies.');
      return;
    }
    final code = await pickCurrency(context, title: from ? 'From' : 'To', current: from ? app.from : app.to);
    if (code == null) return;
    from ? app.setFrom(code) : app.setTo(code);
    await _convert(Record.now);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) => ListenableBuilder(
      listenable: AppState.I,
      builder: (context, _) {
        final c = UwuColors.of(context);
        final app = AppState.I;
        // From and To side by side where the card has room, as the site's grid does.
        final wide = box.maxWidth >= 540;
        final conv = app.last;
        return GlassPanel(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _header(c, app, wide),
              const FieldLabel('Amount'),
              TourTargets.wrap(context, 'amount', TextField(
                  key: const ValueKey('amount'),
                  controller: _amount,
                  focusNode: amountFocus,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                  style: TextStyle(fontSize: 18, color: c.ink),
                  textInputAction: TextInputAction.done,
                  onChanged: _typed,
                  onSubmitted: (_) => _convert(Record.now),
                ),
              ),
              const SizedBox(height: 4),
              if (wide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(child: _field(c, true)),
                    Padding(padding: const EdgeInsets.fromLTRB(10, 0, 10, 4), child: _swap(c)),
                    Expanded(child: _field(c, false)),
                  ],
                )
              else ...[
                _field(c, true),
                Padding(padding: const EdgeInsets.only(top: 12), child: Center(child: _swap(c))),
                _field(c, false),
              ],
              const SizedBox(height: 16),
              TourTargets.wrap(context, 'result', _result(c, app, conv)),
              const SizedBox(height: 16),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 10,
                runSpacing: 10,
                children: [
                  FilledButton(
                    key: const ValueKey('convert'),
                    onPressed: app.converting ? null : () => _convert(Record.now),
                    child: Text(app.converting ? 'Converting…' : 'Convert'),
                  ),
                  OutlinedButton(
                    key: const ValueKey('invert'),
                    onPressed: () {
                      final e = app.invert();
                      if (e != null) AppNav.toast(e);
                    },
                    child: const Text('Invert rate'),
                  ),
                  OutlinedButton.icon(
                    key: const ValueKey('share'),
                    onPressed: () => openShareMenu(context),
                    icon: AppIcon('share', size: 15, color: c.ink),
                    label: const Text('Share'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
      ),
    );
  }

  Widget _header(UwuColors c, AppState app, bool wide) {
    final updated = app.last == null || app.last!.date.isEmpty ? '' : 'Rates as of ${formatDay(app.last!.date)}';
    final logo = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(color: c.brandFill, borderRadius: BorderRadius.circular(12)),
      child: Center(child: AppIcon('dollar', size: 22, stroke: 2.5, color: c.onBrand)),
    );
    final buttons = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        MiniButton(
          key: const ValueKey('refresh'),
          icon: 'refresh',
          label: 'Refresh rates',
          size: 36,
          color: c.ink,
          onPressed: () {
            AppNav.toast('Refreshing…');
            _convert(Record.none);
          },
        ),
        const SizedBox(width: 4),
        MiniButton(
          icon: 'coffee',
          label: 'Buy Augy a Coffee',
          size: 36,
          color: const Color(0xFF8A5A2B),
          onPressed: () => launchUrl(Uri.parse(coffeeUrl), mode: LaunchMode.externalApplication),
        ),
      ],
    );
    // On a phone the tray floats over the page's right edge: while it's open, the header's
    // buttons move in from under it.
    final phone = MediaQuery.sizeOf(context).width <= Env.phoneWidth;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ValueListenableBuilder<bool>(
          valueListenable: EdgeTray.open,
          builder: (context, trayOpen, row) => AnimatedPadding(
            duration: Duration(milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 220),
            curve: Curves.easeOutCubic,
            padding: EdgeInsets.only(right: phone && trayOpen && !PageShot.of(context) ? 52 : 0),
            child: row,
          ),
          child: Row(
          children: [
            logo,
            const SizedBox(width: 12),
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  'Currency Converter',
                  style: TextStyle(fontSize: 21, color: c.ink, fontWeight: FontWeight.w700),
                ),
              ),
            ),
            if (wide && updated.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Text(updated, style: TextStyle(color: c.muted, fontSize: 12)),
              ),
            buttons,
          ],
          ),
        ),
        if (!wide && updated.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Semantics(liveRegion: true, child: Text(updated, style: TextStyle(color: c.muted, fontSize: 12))),
          ),
      ],
    );
  }

  Widget _field(UwuColors c, bool from) {
    final app = AppState.I;
    final code = from ? app.from : app.to;
    final label = app.currencies.containsKey(code) ? optionLabel(code, app.nameOf(code)) : 'Choose a currency';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(from ? 'From' : 'To'),
        TourTargets.wrap(context, from ? 'from' : 'to', Semantics(
            button: true,
            label: '${from ? 'From' : 'To'}: $label. Press to choose another',
            excludeSemantics: true,
            child: InkWell(
              key: ValueKey(from ? 'from' : 'to'),
              mouseCursor: WidgetStateMouseCursor.clickable,
              borderRadius: BorderRadius.circular(10),
              onTap: () => _pick(from),
              child: InputDecorator(
                decoration: InputDecoration(
                  suffixIcon: Padding(padding: const EdgeInsets.all(12), child: AppIcon('chevron-down', size: 16, color: c.muted)),
                ),
                child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, color: c.ink)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _swap(UwuColors c) => TourTargets.wrap(context, 'swap', Tooltip(
      message: 'Swap currencies',
      excludeFromSemantics: true,
      child: Semantics(
        button: true,
        label: 'Swap currencies',
        excludeSemantics: true,
        child: Material(
          color: c.brandFill,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            key: const ValueKey('swap'),
            mouseCursor: WidgetStateMouseCursor.clickable,
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              final e = await AppState.I.swap();
              if (e != null) AppNav.toast(e);
            },
            child: SizedBox(
              width: 46,
              height: 46,
              child: Center(child: AppIcon('swap', size: 20, stroke: 2, color: c.onBrand)),
            ),
          ),
        ),
      ),
    ),
  );

  Widget _result(UwuColors c, AppState app, Conversion? conv) {
    final big = TextStyle(fontSize: 26, color: c.ink, fontWeight: FontWeight.w700);
    final normal = TextStyle(fontSize: 22, color: c.ink);
    return RepaintBoundary(
      key: PageShot.of(context) ? null : resultKey,
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        decoration: BoxDecoration(
          color: Color.alphaBlend(c.surfaceStrong, c.page == null ? c.bg : Color.alphaBlend(c.surface, c.bg)),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border),
        ),
        child: Semantics(
          liveRegion: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                key: const ValueKey('result-line'),
                TextSpan(
                  children: conv == null
                      ? [TextSpan(text: app.loadError ?? '—', style: normal)]
                      : [
                          TextSpan(text: '${formatNumber(conv.amount)} ${conv.from}', style: normal),
                          TextSpan(text: '  =  ', style: normal.copyWith(color: c.muted)),
                          TextSpan(text: '${formatNumber(conv.result)} ${conv.to}', style: big),
                        ],
                ),
              ),
              const SizedBox(height: 6),
              Text(app.rateLine, key: const ValueKey('rate-line'), style: TextStyle(color: c.muted, fontSize: 13)),
              if (conv != null && conv.cached)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('Offline: the last rates this device saw.', style: TextStyle(color: c.warn, fontSize: 12)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/* ---- Share ---- */

/// "100 SGD = 326.92 MYR\n1 SGD = 3.269231 MYR", as the site's buildShareText().
String shareText() {
  final c = AppState.I.last;
  if (c == null) return '';
  return '${formatNumber(c.amount)} ${c.from} = ${formatNumber(c.result)} ${c.to}\n${AppState.I.rateLine}';
}

/// The answer as a PNG, drawn at three times its size.
Future<Uint8List?> resultPng() async {
  final box = resultKey.currentContext?.findRenderObject();
  if (box is! RenderRepaintBoundary) return null;
  final image = await box.toImage(pixelRatio: 3);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return data?.buffer.asUint8List();
}

Future<void> _openOut(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

/// Share: the system's share sheet (on Android, the words and a picture), the messaging apps'
/// own share links, and Save as image, as the site's share menu.
Future<void> openShareMenu(BuildContext context) async {
  if (AppState.I.last == null) {
    AppNav.toast('Convert first');
    return;
  }
  final text = shareText();
  final url = '$siteOrigin/';
  final encText = Uri.encodeComponent(text);
  final encUrl = Uri.encodeComponent(url);

  Future<void> device() async {
    if (Native.has('share')) {
      final png = await resultPng();
      await Native.tryCall('App', 'share', {'title': 'Currency Converter', 'text': '$text\n$url', 'image': png == null ? '' : base64Encode(png)});
      return;
    }
    // The desktop: the words on the clipboard, as the spec's host says.
    await copyText('$text\n$url');
    AppNav.toast('Copied to the clipboard');
  }

  Future<void> save() async {
    final png = await resultPng();
    if (png == null) {
      AppNav.toast('Could not generate image.');
      return;
    }
    final where = await saveFile('conversion.png', png, mime: 'image/png');
    if (where != null) AppNav.toast('Saved conversion.png');
  }

  final items = <(String, String, Future<void> Function())>[
    ('device', Native.has('share') ? 'Share…' : 'Copy', device),
    ('telegram', 'Telegram', () => _openOut('https://t.me/share/url?url=$encUrl&text=$encText')),
    ('twitter', 'Twitter / X', () => _openOut('https://twitter.com/intent/tweet?text=$encText&url=$encUrl')),
    ('whatsapp', 'WhatsApp', () => _openOut('https://wa.me/?text=$encText%0A$encUrl')),
    ('facebook', 'Facebook', () => _openOut('https://www.facebook.com/sharer/sharer.php?u=$encUrl')),
    ('save-image', 'Save as Image', save),
  ];
  await AppSheet.show(
    context,
    id: 'share',
    width: 380,
    builder: (context) {
      final c = UwuColors.of(context);
      return SheetFrame(
        title: 'Share',
        children: [
          for (final (icon, label, run) in items)
            ListTile(
              key: ValueKey('share-$icon'),
              mouseCursor: SystemMouseCursors.click,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              leading: AppIcon(icon, size: 20, color: c.ink),
              title: Text(label, style: TextStyle(color: c.ink, fontSize: 15)),
              onTap: () async {
                AppSheet.close(context);
                // After the window has gone, so a picture of the answer has nothing over it.
                await Future<void>.delayed(const Duration(milliseconds: 250));
                await run();
              },
            ),
        ],
      );
    },
  );
}
