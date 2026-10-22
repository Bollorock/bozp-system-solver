# BOZP System Solver

Tampermonkey/Violentmonkey userscript for `bozp-system.cz` training tests. It scrapes the
multiple-choice questions from the page, asks Claude (via the Anthropic API) to pick the correct answers,
fills them in, and can optionally click **Vyhodnotit** for you.

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey) browser extension.
2. Open the raw script URL — Tampermonkey will offer to install it:
   <https://raw.githubusercontent.com/Bollorock/bozp-system-solver/HEAD/bozp-system-solver.user.js>
   (or create a new userscript manually and paste in
   [`bozp-system-solver.user.js`](bozp-system-solver.user.js)).
3. Open any `bozp-system.cz` page and configure the script (see below).

### Auto-updates

The script declares `@updateURL`/`@downloadURL` pointing at this repository's default
branch (`HEAD`), so Tampermonkey checks GitHub for new versions on its regular update
schedule (or via *Utilities → Check for userscript updates*). Bump `@version` in every
commit that should roll out to users — Tampermonkey only updates when the version number
increases. Auto-update requires the repository to stay public.

## Configuration

The settings panel is available on **any** `bozp-system.cz` page, three ways:

- Tampermonkey toolbar icon → **⚙️ Settings (API key, model…)**
- Hotkey **Alt+Shift+C**
- On a test page, click the status box in the bottom-right corner

| Setting | Default | Description |
| --- | --- | --- |
| Anthropic API key | — | Your `sk-ant-…` key from <https://platform.claude.com/>, stored in the userscript manager's storage |
| Model | `claude-opus-5-5` | Preset list, or pick *Custom* and type any Claude model ID |
| Effort | `low` | How much Claude thinks (`low` … `max`, or `default` to omit). `low` is plenty for these questions |
| Max tokens | `16000` | Thinking counts toward this limit, so keep it ≥ 4000. Only tokens actually used are billed |
| Auto-fill on load | on | Run automatically when a test page opens |
| Auto-submit | off | Click „Vyhodnotit" after filling |

Other controls: **Alt+Shift+O** re-runs the fill on a test page, **Test API** in the panel
verifies your key + model with a tiny request, **Esc** closes the panel.

## Which model should I use?

These tests are short, simple Czech multiple-choice questions with one clearly correct
answer, so every preset answers them reliably:

- **Claude Opus 5.5 (`claude-opus-5-5`, the default)** — the current Opus model; with
  effort `low` it answers a whole test quickly.
- **Claude Sonnet 5.5 (`claude-sonnet-5-5`)** — about half the price of Opus 5.5.
- **Claude Haiku 5.5 (`claude-haiku-5-5`)** — the cheapest option, if you want the
  minimum spend.
- **Claude Fable 5.1 (`claude-fable-5-1`)** — the most capable model; overkill here.

On Opus 5.5, Sonnet 5.5 and Fable 5.1 the script enables server-side refusal fallbacks
(`fallbacks: "default"`), so if a safety classifier declines a request the API retries it on
a fallback model automatically.

## Troubleshooting

- **`Anthropic API error 401`** — the API key is wrong or revoked. Check it in ⚙️ settings.
- **`Anthropic API error 400 … credit balance is too low`** — your Anthropic account is out of
  API credits; add credits in the Claude Console billing settings.
- **"Hit the max-tokens limit before answering"** — raise *Max tokens* or lower *Effort*.
- **"Claude declined to answer (refusal)"** — re-run with Alt+Shift+O, or switch model.
- **`400` error mentioning `effort`** — the custom model you entered doesn't support that
  effort level. Set effort to `default`.

### Upgrading from 1.x (OpenAI)

Version 2.0 switched from OpenAI to the Anthropic API. Settings are stored under new keys,
so after updating open ⚙️ settings and enter an Anthropic API key — the old OpenAI key and
model are ignored.

## Notes

- Use this only on your own tests/accounts.
- The API key is stored via `GM_setValue` in your userscript manager profile and is sent
  only to `api.anthropic.com`.
