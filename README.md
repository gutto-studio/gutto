# gutto

English · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

![license](https://img.shields.io/badge/license-PolyForm%20NC%201.0.0-blue)
![platform](https://img.shields.io/badge/platform-macOS-lightgrey)

**A tiny chibi maid who lives on your desktop — and watches your AI agents work.**

<p align="center">
  <img src="assets/gutto.png" alt="gutto, a chibi maid desktop pet" width="420">
  <br><sub><i>gutto, on shift. (art is AI-generated)</i></sub>
</p>

Your coding agent grinds away inside a terminal window you can't see: it runs for
minutes at a time, stops mid-task to ask for permission, and you only find out
something finished — or died waiting — when you happen to alt-tab back.

`gutto` puts that state where you can feel it. She's a little maid on your desktop
who mirrors what your agent is doing in real time: working, waiting, blocked on an
approval, done. When your agent needs a yes/no, she brings the approval card to
you. And when *you* need a break, she's a pet — pat her, poke her, chat with her.

## The problem

Agents in 2026 are competent but invisible:

- **Constant alt-tabbing** — you babysit the terminal because there's no way to
  tell "still working" from "stuck" without looking.
- **Approvals arrive in a window you're not looking at** — a task that needed one
  click sits blocked for ten minutes.
- **No life on the desktop** — the machine does astonishing work and shows you
  nothing while it does it.

gutto fixes the visibility part, the approval part, and the loneliness part.

## How she watches

Your agent runtime reports its lifecycle through hooks; gutto plays them back
as performance on the desktop.

1. An agent starts a task → gutto clocks in and gets to "working" — typing at
   her desk, tail going.
2. The agent waits on a tool approval → gutto pops up a **blocking approval
   card**: read the command, press `⇧⌘Y` to allow or `⇧⌘N` to deny. The agent
   is gated on your answer, same as the terminal would be.
3. Task done → she reports back. Long idle → she wanders, then naps (she sleeps
   more at night).
4. You talk to her anytime — chat with memory, slash commands, custom commands,
   and character-card import. Bring your own API key.

Supported runtimes today: **Claude Code, ZCode, Codex** (real blocking approval
via hooks) and **opencode** (notify-only plugin).

## A day with gutto

Install once (macOS):

```bash
$ git clone https://github.com/gutto-studio/gutto
$ cd gutto && bin/gutto up        # she clocks in — login autostart is on by default
```

Then the whole day is three gestures:

- **Pat or poke her** — she reacts with animation and a line of dialogue. Poke
  four times in a row and she puffs up.
- **Right-click her** — chat, settings, records, and a "what did you see" menu.
- **Let her be** — she wanders the screen, watches the clock, and tucks herself
  in when it's late.

Everything she notices accumulates: an affinity system tracks pats, pokes,
chats and daily visits (capped daily, never decays), levels up through four
stages, and occasionally unlocks a rare little scene. She also remembers how
many days you've been together.

## What's in the box

| Piece            | What it does                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `shell-electron/`| The pet herself: animation, interactions, chat UI, settings, notifications (Electron, single codebase) |
| `integrations/`  | Bridges from agent runtimes (hooks + opencode plugin) into gutto's event bus                        |
| `bin/gutto`      | One command for on/off shift, status, autostart, chat window, settings                             |
| `skills/`        | SKILL.md files so your agent can talk *about* gutto too                                            |
| `assets/`        | The sprite atlas and art (AI-generated — disclosed, see License)                                   |

## Privacy

**Zero telemetry, zero cloud sync.** Every byte gutto knows — chat history,
affinity, agent events — stays in `~/.gutto/` on your machine. Chat uses your
own API key against your chosen provider; gutto ships no backend of its own.
See [docs/PRIVACY.md](docs/PRIVACY.md).

## When you don't need her

- You don't run coding agents locally — she'll still be a cute pet, but the
  watching part is the point.
- You need a cross-platform pet *today* — she's built and tested on macOS; the
  codebase targets Windows/Linux too, but they're early.

## Status

Early and actively developed. The core loop — agent hooks → desktop performance
→ blocking approvals → chat → affinity — is daily-driver stable on macOS.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and non-commercial
use; commercial use requires a license from guttolab. The art assets are
AI-generated and disclosed as such. The pet engine is forked from
[OpenPets](https://github.com/alterhq/OpenPets) (MIT).
