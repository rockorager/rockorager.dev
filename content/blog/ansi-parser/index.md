---
title: "An ANSI Parser State Machine"
date: 2026-07-14T00:00:00Z
description: "A complete, UTF-8-aware state machine for parsing ANSI terminal control sequences."
draft: true
aliases:
  - /misc/ansi-parser/
  - /posts/ansi-parser/
---

This is a work-in-progress replacement for Paul Flo Williams's excellent
[DEC ANSI parser](https://vt100.net/emu/dec_ansi_parser). The original diagram
documents DEC's eight-bit terminal behavior. This version instead describes a
modern UTF-8 terminal parser with two deliberate differences:

1. UTF-8 is decoded before values enter the ANSI state machine. There is no
   implicit mapping from `A0–FF` onto `20–7F`.
2. C1 values `U+0080–U+009F` are ignored in the current state. They never act
   as eight-bit CSI, DCS, OSC, or ST controls. Their seven-bit `ESC` forms are
   still recognized.

The diagrams describe byte-valued inputs from `00` through `FF`, along with
decoded Unicode values above `U+00FF`.

## CSI subparameters

[ECMA-48 §5.4.2](https://ecma-international.org/wp-content/uploads/ECMA-48_5th_edition_june_1991.pdf)
allows `:` (`3A`) as a separator inside a parameter substring. Modern terminal
protocols use these fields as **subparameters**, notably for RGB colors:

```text
CSI 38:2::r:g:b m
```

Conceptually, semicolons produce an outer list of parameters and colons produce
an inner list. The sequence above is retained as:

```text
[
  [38, 2, empty, r, g, b]
]
```

The omitted color-space identifier between `::` must be retained; collapsing it
would change the positions of every following field. The chart tracks this with
a separate `csi subparam` state: `3A` performs `subparam` and enters or remains
in that state, while `3B` performs `param` and returns to `csi param` to start
the next top-level parameter.

{% include "shortcodes/ansi_parser.html" %}

[Download the editable Excalidraw source](ansi-parser.excalidraw).

## Scope

These diagrams specify recognition and error recovery, not terminal behavior.
The dispatch actions still need separate tables describing individual control
functions such as SGR, cursor movement, and mode changes.

The machine follows the separation used by
[Vaxis](https://github.com/rockorager/vaxis/blob/master/ansi/parser.go) and
[Ghostty](https://github.com/ghostty-org/ghostty/blob/main/src/terminal/stream.zig):
UTF-8 decoding is an input layer, while escape-sequence recognition is a
separate state machine. Invalid UTF-8 handling is consequently a decoder policy,
not an ANSI transition.

The diagrams are deliberately hand-authored: they are a reference to read and
review, not generated parser code.
