---
title: "OSC 9;4 - Progress Bar Sequence"
date: 2025-10-27T00:00:00Z
description: "Documentation for the OSC 9;4 terminal escape sequence used to display progress bars in terminal emulators."
---

<aside style="font-style: italic; color: var(--text-muted); margin-bottom: 2rem;">
This document is provided for ease of visibility. The canonical specification is maintained by ConEmu at <a href="https://conemu.github.io/en/AnsiEscapeCodes.html#ConEmu_specific_OSC">https://conemu.github.io/en/AnsiEscapeCodes.html</a>
</aside>

The OSC 9;4 sequence is a terminal escape sequence originally created by ConEmu for displaying progress bars. It has since been adopted by other terminal emulators including Ghostty and Windows Terminal.

In supporting terminals, this sequence can display a native GUI progress bar that shows operation progress, completion state, and errors.

## Sequence Format

`OSC 9 ; 4 ; state ; progress ST`

Where:
- `OSC` is `\x1b]` (ESC followed by `]`)
- `ST` is the string terminator: `\x07` (BEL) or `\x1b\` (ESC followed by `\`)
- `state` is a single digit 0-4 indicating the progress bar state
- `progress` is an optional value 0-100 representing the percentage complete

## State Values

| State | Name | Description |
|-------|------|-------------|
| 0 | Remove | Removes/hides the progress bar |
| 1 | Set | Sets progress bar to normal state with given progress value |
| 2 | Error | Sets progress bar to error state (typically red) |
| 3 | Indeterminate | Sets progress bar to indeterminate/pulsing state |
| 4 | Pause | Sets progress bar to paused state |

## Examples

Remove progress bar:
```
\x1b]9;4;0\x07
```

Set progress to 50%:
```
\x1b]9;4;1;50\x07
```

Show error state:
```
\x1b]9;4;2\x07
```

Show indeterminate progress:
```
\x1b]9;4;3\x07
```

Show paused state at 75%:
```
\x1b]9;4;4;75\x07
```

## Terminal Implementations

### ConEmu
ConEmu, the originator of this sequence, displays progress in the taskbar and optionally in the tab title.

### Ghostty
Ghostty (version 1.2.0+) renders OSC 9;4 sequences as a native GUI progress bar at the top of the terminal window. The progress value is clamped to the range 0-100.

### Konsole
Konsole (KDE's terminal emulator) supports OSC 9;4 sequences.

### mintty
mintty (Cygwin/MSYS2/WSL terminal) added support in November 2020 (version 3.4.2). In addition to the standard numeric states, mintty also supports mnemonic parameters like `OSC 9;progress;green`, `OSC 9;progress;red`, `OSC 9;progress;busy`, etc.

### WezTerm
WezTerm added support in February 2025. Implements all standard states: none, set percentage, error, indeterminate, and paused.

### Windows Terminal
Windows Terminal displays the progress in the Windows taskbar, updating the taskbar icon to show progress state and percentage.

### xterm.js
xterm.js provides support via the `@xterm/addon-progress` addon. Supports all states: remove, normal, error, indeterminate, and pause/warning.

## Notes

The sequence `OSC 9;4` followed by anything other than a semicolon and valid state is interpreted as a desktop notification by ConEmu-compatible terminals, not a progress bar.

Progress values outside the range 0-100 are clamped to that range by the terminal.

## References

- [ConEmu ANSI Escape Codes Documentation](https://conemu.github.io/en/AnsiEscapeCodes.html#ConEmu_specific_OSC)
- [Ghostty 1.2.0 Release Notes](https://github.com/ghostty-org/website/blob/main/docs/install/release-notes/1-2-0.mdx)
- [Ghostty Source Implementation](https://github.com/ghostty-org/ghostty/blob/main/src/terminal/osc.zig)
