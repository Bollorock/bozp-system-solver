# BOZP Test Auto-Filler

Tampermonkey/Violentmonkey userscript for `bozp-system.cz` training tests. It scrapes the
multiple-choice questions from the page, asks an OpenAI model to pick the correct answers,
fills them in, and can optionally click **Vyhodnotit** for you.

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey) browser extension.
2. Open the raw script URL — Tampermonkey will offer to install it:
   <https://raw.githubusercontent.com/Bollorock/bozp-system-solver/HEAD/bozp-test-autofiller.user.js>
   (or create a new userscript manually and paste in
   [`bozp-test-autofiller.user.js`](bozp-test-autofiller.user.js)).
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
| OpenAI API key | — | Your `sk-…` key, stored in the userscript manager's storage |
| Model | `gpt-5-mini` | Preset list, or pick *Custom* and type any model ID |
| Reasoning effort | `minimal` | Sent only for `gpt-5*` models. `minimal` is fastest/cheapest for gpt-5 / -mini / -nano; `gpt-5.1` uses `none` instead |
| Max output tokens | `2000` | gpt-5 models spend part of this budget on internal reasoning, so keep it ≥ 1000 |
| Auto-fill on load | on | Run automatically when a test page opens |
| Auto-submit | off | Click „Vyhodnotit" after filling |

Other controls: **Alt+Shift+O** re-runs the fill on a test page, **Test API** in the panel
verifies your key + model with a tiny request, **Esc** closes the panel.

## Which model should I use?

These tests are short, simple Czech multiple-choice questions with one clearly correct
answer — any current model answers them essentially perfectly, so optimize for **cost and
speed**, not capability:

- **`gpt-5-mini` (recommended, the default)** — effectively 100 % on questions like these,
  and with reasoning effort `minimal` it responds in a couple of seconds. A whole test costs
  a fraction of a cent.
- **`gpt-5-nano`** — even cheaper; fine if you want the absolute minimum spend.
- **`gpt-4.1-mini`** — the old default; still works fine (no reasoning parameter needed).
- **`gpt-5.1` / `gpt-5`** — overkill for this task; slower and more expensive with no
  practical accuracy gain.

## Troubleshooting

- **`OpenAI error 429 … insufficient_quota / credit_balance_exhausted`** — your OpenAI
  account is out of API credits. No model or script change fixes this; add credits at
  <https://platform.openai.com/settings/organization/billing/>.
- **"Hit the output-token limit before answering"** — raise *Max output tokens* or lower
  *Reasoning effort* in settings.
- **`400` error mentioning `reasoning`** — the selected model doesn't accept the chosen
  reasoning effort (e.g. `minimal` on `gpt-5.1`, or any effort on a non-gpt-5 model where
  it is omitted automatically). Set effort to `default`.

## Notes

- Use this only on your own tests/accounts.
- The API key is stored via `GM_setValue` in your userscript manager profile and is sent
  only to `api.openai.com`.
