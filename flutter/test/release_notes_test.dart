// The Updates page reads each release's notes as announcements/release-notes-<version>.md writes
// them: a summary, then groups of titled items, with the Markdown taken out.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:uwucurrency/features/update/release_notes.dart';

void main() {
  test('1.0.0: the summary, three groups, the download table and install steps left out', () {
    final n = ReleaseNotes.parse(File('../announcements/release-notes-1.0.0.md').readAsStringSync());
    expect(n.summary, startsWith('The Currency Converter is now uwuCurrency'));
    expect(n.groups.map((g) => g.title), ['Everywhere', 'Android app', 'Windows, macOS and Linux apps']);
    final first = n.groups.first.items.first;
    expect(first.title, 'History');
    expect(first.text, startsWith('every conversion is kept on your device'));
    expect(n.count, greaterThan(15));
    for (final g in n.groups) {
      for (final i in g.items) {
        expect('${i.title}${i.text}', isNot(contains('**')));
        expect('${i.title}${i.text}', isNot(contains('`')));
      }
    }
  });

  test('"What\'s fixed" is read as its changes', () {
    final n = ReleaseNotes.parse('A fix.\n\n## What\'s fixed\n\n### Android app\n- **Opens again**: it closed as it opened.\n- **Faster**: less to load.');
    expect(n.summary, 'A fix.');
    expect(n.count, 2);
    expect(n.groups.single.items.first.title, 'Opens again');
  });

  test('items without a title, and notes with no heading', () {
    final n = ReleaseNotes.parse('Small fixes.\n\n## What\'s new\n- Faster start\n  and less memory');
    expect(n.summary, 'Small fixes.');
    expect(n.groups.single.items.single.title, '');
    expect(n.groups.single.items.single.text, 'Faster start and less memory');
    expect(ReleaseNotes.parse('').groups, isEmpty);
  });
}
