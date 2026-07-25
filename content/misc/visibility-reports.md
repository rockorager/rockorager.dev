---
title: "Private Mode for Terminal Visibility Reports"
date: 2026-07-25T00:00:00Z
description: "A terminal specification for reporting whether a terminal view is visible, allowing applications to reduce expensive rendering work while hidden."
---

Terminal applications may perform expensive rendering work even when their
output cannot be seen. Focus reports do not solve this problem: an unfocused
terminal may remain visible, while a focused terminal may be occluded,
suspended, or displayed in a background tab.

This specification defines a new DEC Private Mode that enables terminal
visibility reports:

- `2033` - Enable or disable terminal visibility reports

Visibility is an advisory, conservative state. It combines the terminal's own
knowledge of its tabs, panes, and views with visibility information provided by
the host platform. Applications can use the report to reduce expensive visual
updates while their terminal view is not visible.

## Detection and Enabling

Support is detected with a standard `DECRQM` query:

`CSI ? 2033 $ p`

The terminal responds with a `DECRPM` response:

`CSI ? 2033 ; Ps $ y`

A `Ps` value of `0` or `4` means the mode is not supported. A value of `1`
means reports are enabled, and a value of `2` means reports are disabled.

Reports are enabled and disabled using `DECSET` and `DECRST`:

- `CSI ? 2033 h` enables visibility reports.
- `CSI ? 2033 l` disables visibility reports.

Whenever the terminal receives `CSI ? 2033 h`, it MUST immediately report the
current visibility state, even if the mode was already enabled. While the mode
is enabled, the terminal MUST send another report whenever the effective
visibility state changes. It SHOULD NOT send duplicate reports at other times.

## Querying Visibility

The current visibility state can be requested without enabling change reports:

`CSI ? 998 n`

A supporting terminal MUST reply with a visibility report. This query does not
change private mode `2033`.

## Visibility Report

Both query responses and unsolicited notifications use the same private Device
Status Report:

`CSI ? 999 ; Ps n`

The visibility state `Ps` is one of:

| Value | State | Meaning |
|---|---|---|
| `1` | Potentially visible | The terminal view may be observable. |
| `2` | Not visible | The terminal knows that the terminal view is not ordinarily observable. |

Applications MUST treat unknown values as potentially visible.

Potentially visible is deliberately conservative. It does not guarantee that
any terminal cell is currently onscreen. A terminal MUST report `1` whenever
visibility is unknown or any associated view may be observable. It MUST report
`2` only when it has positive knowledge that the terminal view is not visible.

## Determining Visibility

A terminal MUST determine visibility for the view associated with the terminal
session, not merely for its top-level operating-system window. Relevant state
may include:

- whether the terminal's tab is selected;
- whether its pane or view is displayed;
- whether any window displaying the session is minimized, hidden, or on an
  inactive workspace;
- whether the window is fully occluded; and
- whether the compositor has suspended presentation of the surface.

If the same terminal session is displayed in more than one view, the terminal
MUST report potentially visible if any view may be observable.

On macOS, an implementation can use `NSWindow.occlusionState` as one input. An
unset `NSWindowOcclusionStateVisible` bit indicates that the entire window is
occluded. A set bit means that at least part of the window's bounding box is
visible and must therefore be treated as potentially visible.

On Wayland, an implementation can use the `suspended` `xdg_toplevel` state as
one input. A suspended surface can be treated as not visible; a surface that is
not suspended must be treated as potentially visible unless the terminal has
other internal knowledge that its view is hidden.

These platform mechanisms are examples, not requirements. Implementations
SHOULD use all reliable platform and internal state available to them and MUST
resolve uncertainty in favor of potentially visible.

## Application Behavior

A not-visible report is a performance hint. An application MAY pause animations,
coalesce visual updates, or skip other expensive presentation work while the
state is `2`. It SHOULD continue processing input and updating the internal state
needed to produce its next frame.

When the state returns to `1`, the application SHOULD render its latest complete
state. Applications MUST NOT assume that the terminal will remain hidden for any
minimum duration.

This mode is independent of focus reporting. Focus indicates which view receives
keyboard input; visibility indicates whether output may be observed.

## Example

An application first checks whether visibility reports are supported:

```text
A: \x1b[?2033$p
T: \x1b[?2033;2$y
```

The terminal supports the mode and reports that it is currently disabled. The
application enables reports, and the terminal immediately reports that the view
is potentially visible:

```text
A: \x1b[?2033h
T: \x1b[?999;1n
```

The terminal view becomes fully hidden, then later becomes visible again:

```text
T: \x1b[?999;2n
T: \x1b[?999;1n
```

An application that only needs the current state can issue a one-shot query:

```text
A: \x1b[?998n
T: \x1b[?999;1n
```

## References

- [Dark and Light Mode Detection](https://contour-terminal.org/vt-extensions/color-palette-update-notifications/)
- [Request Mode (DECRQM)](https://vt100.net/docs/vt510-rm/DECRQM.html)
- [macOS Window Occlusion State](https://developer.apple.com/documentation/appkit/nswindow/occlusionstate-swift.struct/visible)
- [Wayland XDG Toplevel States](https://wayland.app/protocols/xdg-shell#xdg_toplevel:enum:state)
