---
title: "Private Mode for In-Band Window Resize Notifications"
date: 2024-06-28T00:00:00Z
description: "A terminal specification for automatic in-band resize notifications, eliminating the need for polling or racy SIGWINCH signal handling."
---

<aside style="font-style: italic; color: var(--text-muted); margin-bottom: 2rem;">
Originally published at <a href="https://gist.github.com/rockorager/e695fb2924d36b2bcf1fff4a3704bd83">GitHub Gist</a>
</aside>

Terminal emulators typically receive window resize events by installing a signal
handler for the SIGWINCH signal. Handling of these signals can create challenges
due to their inherently racy properties. Resize events must be synchronized with
other application state in a safe manner.

Standard control sequences exist to query the current terminal size from the
terminal and receive an in-band control sequence with the window size. However,
this system requires polling - which is not ideal. Usually, `SIGWINCH` handling
is preferred.

This specification defines a single new Private Mode which enables automatic
reporting of in-band text area resize events -

- `2048` - Enable/disable reports for text area size in both characters and pixels

> [!NOTE]
> When using `ReadConsoleInput` on Windows, resize notifications are already delivered in band.

## Detection and Enabling

Detection is performed with a standard `DECRQM` query:

`CSI ? 2048 $ p`

To which the terminal will respond with a `DECRPM` response:

`CSI ? 2048 ; Ps $ y`

A `Ps` value of 0 or 4 means the mode is not supported. [Reference](https://www.vt100.net/docs/vt510-rm/DECRPM.html) 

The reports can be enabled using `DECSET` or `DECRST` control sequences:

`CSI ? 2048 h` to enable the mode.
`CSI ? 2048 l` to disable the mode.

## Reports

The format of the response / notification is:

`CSI 48 ; height_chars ; width_chars ; height_pix ; width_pix t`

If a terminal is not capable of reporting pixel sizes, it must report them as 0. A terminal MUST report pixel sizes if it is capable of reporting them.

Any field MAY contain sub-parameters, separated by colons (':', ASCII 0x3A). If a client does not understand these, it MUST ignore subparameters. Currently, no subparameters are defined.

> [!NOTE]
> The reported size MUST be the text area size. Text area does not include any padding the terminal applies to the window

## Implementation Notes

When first enabled, the terminal MUST send a report of the current size. 

If the mode is already enabled, the terminal MUST immediately report the current size if an attempt is made to enable the feature.

This specification does not dictate any sort of throttling or limiting the
frequency with which reports can be sent.

The terminal MUST NOT send notifications until the internal resize is complete. That is, the terminal must be prepared for the TTY and application to behave at the new size prior to sending the sequence.

> [!IMPORTANT]
> The reported area MUST be the text area size. Font size changes can also affect the text area size

## Example

An application queries the terminal for support:

A: `\x1b[?2048$p`

The terminal responds with:

T: `\x1b[?2048;2y`

The mode is supported but not currently enabled. The application enables the
mode.

A: `\x1b[?2048h`

The terminal turns the mode on, and gives an immediate report of the window
size.

T: `\x1b[48;24;80;240;1600t`

After some time, the user changes the window size. The terminal sends a new
size report.

T: `\x1b[48;48;80;480;1600t`
