// Every link that opens the app goes through Links.open() (docs/flutter-android-app-spec.md §5):
// the site's own https links (verified with assetlinks.json), the uwu://currency/ scheme shared
// with the sibling apps, text shared from another app, the desktop's command bar and Jump List.
//
//   https://currency.uwuapps.org/#sync/CODE      Share with another device, the code filled in
//   https://currency.uwuapps.org/?text=50%20USD  the site's share target: the amount and currency
//   uwu://currency/sync/CODE                     the same as the first
//   uwu://currency/pair/SGD/MYR[/100]            that pair (and amount), converted
//   uwu://currency/history                       History
//   uwu://currency/shared?text=…                 text shared from another app (Android)
//   uwu://currency/updates                       the Updates page (Android)
//   uwu://currency/  or the site's home           the app as it is
import 'package:url_launcher/url_launcher.dart';

import '../api/api.dart';
import '../features/history/history_card.dart';
import '../features/sync/sync_sheet.dart';
import '../features/update/update_bar.dart';
import 'nav.dart';
import 'state.dart';

const appScheme = 'uwu';
const appHost = 'currency';

/// What a link asks for.
sealed class LinkTarget {
  const LinkTarget();
}

class LinkHome extends LinkTarget {
  const LinkHome();
}

class LinkSync extends LinkTarget {
  const LinkSync(this.code);
  final String code;
}

/// A pair to convert, with an amount or not.
class LinkPair extends LinkTarget {
  const LinkPair(this.from, this.to, [this.amount]);
  final String from;
  final String to;
  final double? amount;
}

/// History, scrolled into view.
class LinkHistory extends LinkTarget {
  const LinkHistory();
}

/// Words shared from another app, or the site's share target: an amount and a currency in them.
class LinkShared extends LinkTarget {
  const LinkShared(this.text);
  final String text;
}

/// The Updates page (a "new version is out" notification, tapped).
class LinkUpdates extends LinkTarget {
  const LinkUpdates();
}

/// Somewhere else: opened in the browser.
class LinkOut extends LinkTarget {
  const LinkOut(this.uri);
  final Uri uri;
}

final _plainPath = RegExp(r'^[A-Za-z0-9/_\-.]*$');
final _code = RegExp(r'^[A-Z0-9]{2,10}$');
final _syncHash = RegExp(r'^sync/([A-Za-z0-9-]{1,20})$');

/// Reads a link, or null if it's nothing the app can open. Only plain path characters are
/// taken from the app's own scheme.
LinkTarget? parseLink(String raw) {
  final text = raw.trim();
  if (text.isEmpty) return null;
  // A path or hash typed into the desktop's command bar.
  if (text.startsWith('#') || text.startsWith('/#')) return parseLink('$siteOrigin/${text.replaceFirst(RegExp(r'^/'), '')}');
  final uri = Uri.tryParse(text);
  if (uri == null || !uri.hasScheme) return null;
  if (uri.scheme == appScheme) {
    if (uri.host != appHost) return null;
    final path = uri.path.replaceAll(RegExp(r'^/+|/+$'), '');
    if (!_plainPath.hasMatch(path)) return null;
    final parts = path.isEmpty ? <String>[] : path.split('/');
    if (parts.isEmpty) return const LinkHome();
    if (parts[0] == 'sync' && parts.length == 2) return LinkSync(parts[1]);
    if (parts[0] == 'pair' && (parts.length == 3 || parts.length == 4)) {
      final f = parts[1].toUpperCase(), t = parts[2].toUpperCase();
      if (!_code.hasMatch(f) || !_code.hasMatch(t)) return const LinkHome();
      final amount = parts.length == 4 ? double.tryParse(parts[3]) : null;
      return LinkPair(f, t, amount != null && amount > 0 && amount < 1e15 ? amount : null);
    }
    if (parts[0] == 'history') return const LinkHistory();
    if (parts[0] == 'shared') {
      final text = uri.queryParameters['text'] ?? '';
      return text.isEmpty ? const LinkHome() : LinkShared(text.length > 2000 ? text.substring(0, 2000) : text);
    }
    if (parts[0] == 'updates') return const LinkUpdates();
    return const LinkHome();
  }
  if ((uri.scheme == 'https' || uri.scheme == 'http') && uri.host == siteHost) {
    final m = _syncHash.firstMatch(uri.fragment);
    if (m != null) return LinkSync(m.group(1)!);
    // The site's share target (manifest.json): ?text=, ?title= or ?url=.
    final q = uri.queryParameters;
    final text = q['text'] ?? q['title'] ?? q['url'] ?? '';
    if (text.isNotEmpty) return LinkShared(text.length > 2000 ? text.substring(0, 2000) : text);
    return const LinkHome();
  }
  if (uri.scheme == 'https' || uri.scheme == 'http' || uri.scheme == 'mailto') return LinkOut(uri);
  return null;
}

/// The app's own link for what's on show, as the desktop's Copy link gives it: the pair and
/// amount converted last.
String linkFor() {
  final c = AppState.I.last;
  return c == null ? 'uwu://currency/' : pairLink(c.from, c.to, c.amount);
}

class Links {
  Links._();

  /// A link that came before the currencies had loaded, used once they have.
  static LinkTarget? _pending;

  /// Opens a link. Returns false when it was nothing the app knows.
  static Future<bool> open(String raw) async {
    final target = parseLink(raw);
    if (target == null) return false;
    final ctx = AppNav.context;
    final app = AppState.I;
    switch (target) {
      case LinkHome():
        return true;
      case LinkOut(:final uri):
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return true;
      case LinkSync(:final code):
        if (!app.shown || ctx == null) {
          // Kept until the app is on screen.
          app.pendingSyncCode = code;
          return true;
        }
        AppNav.closeSheets();
        await openSync(ctx, code: code);
        return true;
      case LinkPair(:final from, :final to, :final amount):
        if (!app.ready) {
          _pending = target;
          return true;
        }
        AppNav.closeSheets();
        if (!await app.applyPair(from, to, amount: amount)) AppNav.toast('Not found', error: true);
        HistoryCard.showConverter?.call();
        return true;
      case LinkHistory():
        AppNav.closeSheets();
        HistoryCard.show?.call();
        return true;
      case LinkShared(:final text):
        if (!app.ready) {
          _pending = target;
          return true;
        }
        AppNav.closeSheets();
        if (app.applySharedText(text)) {
          AppNav.toast('Detected shared amount');
          await app.convert(record: Record.now);
          HistoryCard.showConverter?.call();
        } else {
          AppNav.toast('No amount and currency found in that');
        }
        return true;
      case LinkUpdates():
        await openUpdates();
        return true;
    }
  }

  /// The currencies have loaded: a pair or shared words that opened the app, now usable.
  static Future<void> currenciesReady() async {
    final t = _pending;
    _pending = null;
    if (t is LinkPair) await open('uwu://currency/pair/${t.from}/${t.to}${t.amount == null ? '' : '/${t.amount}'}');
    if (t is LinkShared) await open('uwu://currency/shared?text=${Uri.encodeQueryComponent(t.text)}');
  }

  /// Once the app is on screen: a sync link that opened it, now usable.
  static void appShown() {
    final code = AppState.I.pendingSyncCode;
    final ctx = AppNav.context;
    if (code == null || ctx == null) return;
    AppState.I.pendingSyncCode = null;
    openSync(ctx, code: code);
  }
}
