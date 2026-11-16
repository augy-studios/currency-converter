// Picking a currency: the site's "Search code or name…" box and its list, as a window of its own
// (a sheet on a phone, a dialog on the desktop). Typing narrows the list by code or name, codes
// that start with what's typed first (data/currency.dart searchCurrencies); Enter takes the
// first one.
import 'package:flutter/material.dart';

import '../../app/state.dart';
import '../../data/currency.dart';
import '../../theme/icons.dart';
import '../../theme/theme.dart';
import '../../widgets/sheet.dart';

/// The code picked, or null when the window was closed without one.
Future<String?> pickCurrency(BuildContext context, {required String title, String? current, Set<String> exclude = const {}}) {
  return AppSheet.show<String>(context, id: 'currency', width: 440, builder: (context) => _CurrencyPicker(title: title, current: current, exclude: exclude));
}

class _CurrencyPicker extends StatefulWidget {
  const _CurrencyPicker({required this.title, this.current, this.exclude = const {}});
  final String title;
  final String? current;
  final Set<String> exclude;

  @override
  State<_CurrencyPicker> createState() => _CurrencyPickerState();
}

class _CurrencyPickerState extends State<_CurrencyPicker> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  List<String> get _codes => searchCurrencies(_query.text, AppState.I.currencies).where((c) => !widget.exclude.contains(c)).toList();

  @override
  Widget build(BuildContext context) {
    final c = UwuColors.of(context);
    final codes = _codes;
    final height = MediaQuery.sizeOf(context).height;
    return SheetFrame(
      title: widget.title,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      children: [
        TextField(
          key: const ValueKey('currency-search'),
          controller: _query,
          autofocus: true,
          textInputAction: TextInputAction.done,
          decoration: InputDecoration(
            hintText: 'Search code or name…',
            prefixIcon: Padding(padding: const EdgeInsets.all(12), child: AppIcon('search', size: 16, color: c.muted)),
          ),
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) {
            if (codes.isNotEmpty) AppSheet.close(context, codes.first);
          },
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: (height * 0.55).clamp(220, 520),
          child: codes.isEmpty
              ? Center(
                  child: Text('No currency matches “${_query.text.trim()}”', style: TextStyle(color: c.muted)),
                )
              : ListView.builder(
                  itemCount: codes.length,
                  itemExtent: 48,
                  itemBuilder: (context, i) {
                    final code = codes[i];
                    final on = code == widget.current;
                    return ListTile(
                      key: ValueKey('currency-$code'),
                      dense: true,
                      mouseCursor: SystemMouseCursors.click,
                      selected: on,
                      selectedTileColor: c.brandFill,
                      selectedColor: c.onBrand,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      leading: SizedBox(
                        width: 44,
                        child: Text(code, style: TextStyle(color: on ? c.onBrand : c.ink, fontSize: 15, fontWeight: FontWeight.w600)),
                      ),
                      title: Text(
                        AppState.I.nameOf(code),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: on ? c.onBrand : c.ink, fontSize: 14),
                      ),
                      trailing: on ? AppIcon('check', size: 16, color: c.onBrand) : null,
                      onTap: () => AppSheet.close(context, code),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
