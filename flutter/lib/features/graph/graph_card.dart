// Historical Rates (the site's .card--graph): the range (5D to Max), the currencies on the graph
// as chips, Add a currency to compare, and the line chart. It follows the converter's pair
// until a currency is added or removed here (AppState). With more than one currency, each is
// shown as a share of its first day, times 100, so their changes line up whatever their size.
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../app/state.dart';
import '../../data/currency.dart';
import '../../theme/icons.dart';
import '../../theme/theme.dart';
import '../../widgets/common.dart';
import '../converter/currency_picker.dart';
import '../tour/tour.dart';

class GraphCard extends StatelessWidget {
  const GraphCard({super.key, this.chartHeight = 260});

  final double chartHeight;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppState.I,
      builder: (context, _) {
        final c = UwuColors.of(context);
        final app = AppState.I;
        return GlassPanel(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
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
                    child: Text('Historical Rates', style: TextStyle(fontSize: 18, color: c.ink, fontWeight: FontWeight.w700)),
                  ),
                  TourTargets.wrap(context, 'graph-range', _ranges(c, app)),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < app.graphQuotes.length; i++) _chip(c, app.graphQuotes[i], Color(chartColours[i % chartColours.length])),
                ],
              ),
              const SizedBox(height: 10),
              TourTargets.wrap(context, 'graph-add', Align(
                  alignment: Alignment.centerLeft,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: InkWell(
                      key: const ValueKey('graph-add'),
                      mouseCursor: WidgetStateMouseCursor.clickable,
                      borderRadius: BorderRadius.circular(10),
                      onTap: () async {
                        final code = await pickCurrency(context, title: 'Compare with', exclude: {app.graphBase, ...app.graphQuotes});
                        if (code == null) return;
                        final e = app.addGraphQuote(code);
                        if (e != null) AppNav.toast(e);
                      },
                      child: InputDecorator(
                        decoration: InputDecoration(
                          prefixIcon: Padding(padding: const EdgeInsets.all(12), child: AppIcon('plus', size: 16, color: c.muted)),
                        ),
                        child: Text('Add a currency to compare…', style: TextStyle(color: c.muted, fontSize: 14)),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TourTargets.wrap(context, 'graph-chart', SizedBox(height: chartHeight, child: _Chart(app: app)),
              ),
              if (app.graphStatus.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(app.graphStatus, key: const ValueKey('graph-status'), style: TextStyle(color: c.muted, fontSize: 12.5)),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _ranges(UwuColors c, AppState app) => Wrap(
    spacing: 6,
    runSpacing: 6,
    children: [
      for (final r in graphRanges)
        Semantics(
          button: true,
          selected: r == app.graphRange,
          child: Material(
            color: r == app.graphRange ? c.brandFill : c.surfaceStrong,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: c.border)),
            child: InkWell(
              key: ValueKey('range-$r'),
              mouseCursor: WidgetStateMouseCursor.clickable,
              borderRadius: BorderRadius.circular(8),
              onTap: () => app.setRange(r),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                child: Text(graphRangeLabels[r]!, style: TextStyle(fontSize: 13, color: r == app.graphRange ? c.onBrand : c.ink)),
              ),
            ),
          ),
        ),
    ],
  );

  Widget _chip(UwuColors c, String code, Color colour) => Container(
    padding: const EdgeInsets.fromLTRB(10, 4, 4, 4),
    decoration: BoxDecoration(color: c.surfaceStrong, borderRadius: BorderRadius.circular(20), border: Border.all(color: c.border)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: colour, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(code, style: TextStyle(color: c.ink, fontSize: 13)),
        MiniButton(
          key: ValueKey('chip-remove-$code'),
          icon: 'close',
          label: 'Remove $code from graph',
          size: 24,
          onPressed: () {
            final e = AppState.I.removeGraphQuote(code);
            if (e != null) AppNav.toast(e);
          },
        ),
      ],
    ),
  );
}

class _Chart extends StatelessWidget {
  const _Chart({required this.app});
  final AppState app;

  String _short(String iso) {
    final d = formatDay(iso).split(' ');
    return d.length == 3 ? (app.graphRange == '5y' || app.graphRange == 'max' ? '${d[1]} ${d[2]}' : '${d[0]} ${d[1]}') : iso;
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) => _chart(context, box.maxWidth));

  Widget _chart(BuildContext context, double width) {
    final c = UwuColors.of(context);
    final dates = app.graphDates;
    final series = app.graphSeries;
    if (series.isEmpty || dates.isEmpty) {
      return Center(child: app.graphLoading ? const CircularProgressIndicator() : Text('—', style: TextStyle(color: c.muted)));
    }
    var lo = double.infinity, hi = -double.infinity;
    for (final s in series) {
      for (final v in s.values) {
        if (v == null) continue;
        lo = math.min(lo, v);
        hi = math.max(hi, v);
      }
    }
    if (!lo.isFinite) return const SizedBox.shrink();
    final pad = (hi - lo) == 0 ? (hi.abs() * 0.05 + 0.01) : (hi - lo) * 0.08;
    // As many dates under the chart as fit: three on a narrow phone, up to six on a wide screen.
    final labels = width < 360 ? 3 : (width < 560 ? 4 : 6);
    final step = math.max(1, ((dates.length - 1) / (labels - 1)).ceil()).toDouble();
    final decimals = hi < 10 ? 3 : (hi < 1000 ? 2 : 0);
    final grid = c.ink.withValues(alpha: 0.12);
    return LineChart(
      duration: Duration.zero,
      LineChartData(
        minY: lo - pad,
        maxY: hi + pad,
        minX: 0,
        maxX: (dates.length - 1).toDouble().clamp(1, double.infinity),
        clipData: const FlClipData.all(),
        gridData: FlGridData(
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(color: grid, strokeWidth: 1),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(
            axisNameWidget: app.graphIndexed ? Text('Indexed (100 = start of range)', style: TextStyle(color: c.muted, fontSize: 11)) : null,
            axisNameSize: app.graphIndexed ? 18 : 0,
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 52,
              // Only the grid's own steps: the padded ends would print as odd extra numbers.
              minIncluded: false,
              maxIncluded: false,
              getTitlesWidget: (v, meta) => SideTitleWidget(
                meta: meta,
                child: Text(formatNumber(v, maxDecimals: decimals), style: TextStyle(color: c.muted, fontSize: 11)),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 26,
              interval: step,
              getTitlesWidget: (v, meta) {
                final i = v.round();
                if (i < 0 || i >= dates.length || (v - i).abs() > 0.01) return const SizedBox.shrink();
                return SideTitleWidget(meta: meta, child: Text(_short(dates[i]), style: TextStyle(color: c.muted, fontSize: 11)));
              },
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          handleBuiltInTouches: true,
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => c.ink,
            fitInsideHorizontally: true,
            fitInsideVertically: true,
            getTooltipItems: (spots) => [
              for (final s in spots)
                LineTooltipItem(
                  '${s.barIndex == 0 ? '${formatDay(dates[s.x.round().clamp(0, dates.length - 1)])}\n' : ''}'
                  '${app.graphBase}/${series[s.barIndex].quote}: ${formatNumber(s.y, maxDecimals: app.graphIndexed ? 2 : 6)}',
                  TextStyle(color: Color(series[s.barIndex].colour).withValues(alpha: 1), fontSize: 12, fontWeight: FontWeight.w600),
                ),
            ],
          ),
        ),
        lineBarsData: [
          for (final s in series)
            LineChartBarData(
              spots: [
                for (var i = 0; i < s.values.length; i++)
                  if (s.values[i] != null) FlSpot(i.toDouble(), s.values[i]!),
              ],
              color: Color(s.colour),
              barWidth: 2,
              isCurved: true,
              curveSmoothness: 0.2,
              preventCurveOverShooting: true,
              dotData: const FlDotData(show: false),
            ),
        ],
      ),
    );
  }
}
