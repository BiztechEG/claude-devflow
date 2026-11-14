---
name: set-language
description: Switch the language Claude replies in (Egyptian Arabic or English) for the current project, or the default for new projects. Files, code and commits stay in English. Use when the user asks to change the conversation or reply language.
argument-hint: "ar-eg | en [--global]"
---

# Reply language

Arguments: `$ARGUMENTS`.

- **This project:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/set-language.mjs" <ar-eg|en> --target .` from the project root. It swaps the Communication block in `CLAUDE.md` (between `<!-- lang:… -->` and `<!-- /lang -->`) and sets `replyLanguage` in `.project/config.json`, which the board page and review reports follow. Rebuild the board afterwards: `node tools/board/build-board.mjs`.
- **Default for new projects:** add `--global` (writes `~/.claude/devflow.json`).
- If the user did not say which, ask in one short question.

Switch to the new language from the very next message.
