// ==UserScript==
// @name         BOZP System Solver
// @namespace    bollorock.cz
// @version      1.4.0
// @description  Scrapes BOZP test questions, asks OpenAI to pick the correct answers, fills them in, and optionally submits. Settings panel (API key, model, …) available on any bozp-system.cz page.
// @author       Bollorock
// @homepageURL  https://github.com/Bollorock/bozp-system-solver
// @updateURL    https://raw.githubusercontent.com/Bollorock/bozp-system-solver/HEAD/bozp-system-solver.user.js
// @downloadURL  https://raw.githubusercontent.com/Bollorock/bozp-system-solver/HEAD/bozp-system-solver.user.js
// @supportURL   https://github.com/Bollorock/bozp-system-solver/issues
// @match        *://www.bozp-system.cz/*
// @match        *://bozp-system.cz/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.openai.com
// ==/UserScript==

(function () {
  "use strict";

  /** ───────────── Settings ───────────── **/
  const DEFAULTS = {
    OPENAI_API_KEY: "",
    MODEL: "gpt-5-mini",         // recommended: accurate on these questions, cheap and fast
    CUSTOM_MODEL: "",
    REASONING_EFFORT: "minimal", // only sent for gpt-5* models
    MAX_OUTPUT_TOKENS: 2000,     // gpt-5 models spend part of this on reasoning
    AUTO_RUN: true,              // fill automatically when a test page loads
    AUTO_SUBMIT: false,          // click "Vyhodnotit" after filling
  };

  const MODEL_PRESETS = [
    ["gpt-5-mini", "gpt-5-mini — recommended (accurate + cheap)"],
    ["gpt-5-nano", "gpt-5-nano — cheapest, usually enough"],
    ["gpt-5.1", "gpt-5.1 — strongest, overkill here"],
    ["gpt-4.1-mini", "gpt-4.1-mini — old default, still fine"],
    ["gpt-4o-mini", "gpt-4o-mini — legacy"],
    ["custom", "Custom model ID…"],
  ];

  const EFFORT_OPTIONS = [
    ["default", "default (omit parameter)"],
    ["minimal", "minimal — fastest (gpt-5 family)"],
    ["none", "none (gpt-5.1 only)"],
    ["low", "low"],
    ["medium", "medium"],
    ["high", "high"],
  ];

  const MAX_WAIT_MS = 10000;
  const RETRY_INTERVAL_MS = 250;
  const IS_TEST_PAGE = location.pathname.includes("/test/");

  const cfg = (key) => GM_getValue(key, DEFAULTS[key]);
  const setCfg = (key, value) => GM_setValue(key, value);

  function activeModel() {
    const m = cfg("MODEL");
    return m === "custom" ? ((cfg("CUSTOM_MODEL") || "").trim() || DEFAULTS.MODEL) : m;
  }

  /** ───────────── Status Indicator (test pages only) ───────────── **/
  let statusBox = null;
  if (IS_TEST_PAGE) {
    statusBox = document.createElement("div");
    Object.assign(statusBox.style, {
      position: "fixed",
      bottom: "10px",
      right: "10px",
      zIndex: "99999",
      padding: "8px 12px",
      background: "rgba(0,0,0,0.8)",
      color: "#0f0",
      fontSize: "13px",
      fontFamily: "monospace",
      borderRadius: "6px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
      cursor: "pointer",
    });
    statusBox.title = "BOZP System Solver — click for settings (Alt+Shift+C)";
    statusBox.textContent = "⏳ Waiting for questions…";
    statusBox.addEventListener("click", () => openConfig());
    (document.body || document.documentElement).appendChild(statusBox);
  }

  function setStatus(msg, color = "#0f0") {
    if (!statusBox) return;
    statusBox.textContent = msg;
    statusBox.style.color = color;
  }

  /** ───────────── Config panel ───────────── **/
  let panel = null;

  function closeConfig() {
    if (panel) {
      panel.remove();
      panel = null;
    }
  }

  function openConfig() {
    closeConfig();
    panel = document.createElement("div");
    panel.id = "bozp-af-config";
    panel.innerHTML = `
      <style>
        #bozp-af-config { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
          z-index: 2147483646; width: 410px; max-width: calc(100vw - 32px); box-sizing: border-box;
          background: rgba(15,15,15,0.97); color: #eee; font: 13px/1.5 monospace; text-align: left;
          border: 1px solid #0f0; border-radius: 8px; padding: 16px 18px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.7); max-height: calc(100vh - 32px); overflow-y: auto; }
        #bozp-af-config * { box-sizing: border-box; font-family: inherit; }
        #bozp-af-config h3 { margin: 0 0 12px; color: #0f0; font-size: 15px; }
        #bozp-af-config label.row { display: block; margin: 8px 0 2px; color: #9f9; }
        #bozp-af-config input[type=text], #bozp-af-config input[type=password],
        #bozp-af-config input[type=number], #bozp-af-config select {
          width: 100%; padding: 5px 7px; background: #111; color: #eee;
          border: 1px solid #444; border-radius: 4px; font-size: 13px; }
        #bozp-af-config .chk { display: flex; gap: 7px; align-items: center; margin: 8px 0; }
        #bozp-af-config .chk input { margin: 0; }
        #bozp-af-config .btns { display: flex; gap: 8px; margin-top: 14px; }
        #bozp-af-config button { padding: 6px 12px; border-radius: 4px; border: 1px solid #444;
          background: #222; color: #eee; cursor: pointer; font-size: 13px; }
        #bozp-af-config button.primary { background: #0a5c0a; border-color: #0f0; }
        #bozp-af-config .hint { color: #888; font-size: 11px; margin-top: 2px; }
        #bozp-af-config #bozp-af-msg { margin-top: 10px; font-size: 12px; min-height: 16px;
          word-break: break-word; }
      </style>
      <h3>⚙️ BOZP System Solver settings</h3>

      <label class="row" for="bozp-af-key">OpenAI API key</label>
      <input type="password" id="bozp-af-key" placeholder="sk-…" autocomplete="off">
      <div class="chk"><input type="checkbox" id="bozp-af-showkey"><label for="bozp-af-showkey">Show key</label></div>

      <label class="row" for="bozp-af-model">Model</label>
      <select id="bozp-af-model"></select>
      <input type="text" id="bozp-af-custom" placeholder="custom model ID, e.g. gpt-5.2-mini" style="display:none; margin-top:4px;">

      <label class="row" for="bozp-af-effort">Reasoning effort (gpt-5 models only)</label>
      <select id="bozp-af-effort"></select>
      <div class="hint">"minimal" = fastest/cheapest for gpt-5 / gpt-5-mini / gpt-5-nano; gpt-5.1 uses "none" instead.</div>

      <label class="row" for="bozp-af-tokens">Max output tokens</label>
      <input type="number" id="bozp-af-tokens" min="100" step="100">
      <div class="hint">gpt-5 models spend part of this budget on internal reasoning — keep ≥ 1000.</div>

      <div class="chk"><input type="checkbox" id="bozp-af-autorun"><label for="bozp-af-autorun">Auto-fill when a test page loads</label></div>
      <div class="chk"><input type="checkbox" id="bozp-af-autosubmit"><label for="bozp-af-autosubmit">Auto-submit (click „Vyhodnotit“) after filling</label></div>

      <div class="btns">
        <button class="primary" id="bozp-af-save">Save</button>
        <button id="bozp-af-testbtn">Test API</button>
        <button id="bozp-af-cancel">Cancel</button>
      </div>
      <div id="bozp-af-msg"></div>
      <div class="hint">Hotkeys: Alt+Shift+C settings · Alt+Shift+O fill test · Esc close</div>
    `;
    (document.body || document.documentElement).appendChild(panel);

    const $ = (id) => panel.querySelector("#" + id);

    const modelSel = $("bozp-af-model");
    for (const [val, label] of MODEL_PRESETS) modelSel.add(new Option(label, val));
    const effortSel = $("bozp-af-effort");
    for (const [val, label] of EFFORT_OPTIONS) effortSel.add(new Option(label, val));

    $("bozp-af-key").value = cfg("OPENAI_API_KEY");
    modelSel.value = cfg("MODEL");
    $("bozp-af-custom").value = cfg("CUSTOM_MODEL");
    effortSel.value = cfg("REASONING_EFFORT");
    $("bozp-af-tokens").value = cfg("MAX_OUTPUT_TOKENS");
    $("bozp-af-autorun").checked = !!cfg("AUTO_RUN");
    $("bozp-af-autosubmit").checked = !!cfg("AUTO_SUBMIT");

    const syncCustom = () => {
      $("bozp-af-custom").style.display = modelSel.value === "custom" ? "" : "none";
    };
    syncCustom();
    modelSel.addEventListener("change", syncCustom);
    $("bozp-af-showkey").addEventListener("change", (e) => {
      $("bozp-af-key").type = e.target.checked ? "text" : "password";
    });

    const msg = (text, color = "#9f9") => {
      const el = $("bozp-af-msg");
      el.textContent = text;
      el.style.color = color;
    };

    $("bozp-af-save").addEventListener("click", () => {
      setCfg("OPENAI_API_KEY", $("bozp-af-key").value.trim());
      setCfg("MODEL", modelSel.value);
      setCfg("CUSTOM_MODEL", $("bozp-af-custom").value.trim());
      setCfg("REASONING_EFFORT", effortSel.value);
      setCfg("MAX_OUTPUT_TOKENS", Math.max(100, Number($("bozp-af-tokens").value) || DEFAULTS.MAX_OUTPUT_TOKENS));
      setCfg("AUTO_RUN", $("bozp-af-autorun").checked);
      setCfg("AUTO_SUBMIT", $("bozp-af-autosubmit").checked);
      closeConfig();
      setStatus("✅ Settings saved.");
    });

    $("bozp-af-cancel").addEventListener("click", closeConfig);

    $("bozp-af-testbtn").addEventListener("click", async () => {
      const key = $("bozp-af-key").value.trim();
      if (!key) {
        msg("Enter an API key first.", "#f66");
        return;
      }
      const model = modelSel.value === "custom"
        ? ($("bozp-af-custom").value.trim() || DEFAULTS.MODEL)
        : modelSel.value;
      msg(`Testing ${model}…`, "#ff0");
      try {
        await callOpenAI(key, model, effortSel.value, 500, "Reply with the single word OK.");
        msg(`✅ ${model} responded — key and model work.`);
      } catch (e) {
        msg("❌ " + (e.message || e), "#f66");
      }
    });
  }

  GM_registerMenuCommand("⚙️ Settings (API key, model…)", openConfig);
  if (IS_TEST_PAGE) GM_registerMenuCommand("▶ Fill test now", () => run());

  /** ───────────── Scraping questions ───────────── **/
  function scrapeQuestions() {
    const uls = Array.from(document.querySelectorAll("ul.answers"));
    const items = [];

    for (const ul of uls) {
      const qId = ul.id || "";
      if (!qId.startsWith("question_")) continue;

      let qText = "";
      let node = ul.previousElementSibling;
      while (node && !qText) {
        if (node.matches("p") || node.matches("strong")) {
          qText = (node.textContent || "").trim();
        }
        node = node.previousElementSibling;
      }
      if (!qText) {
        const prevP = ul.parentElement?.querySelector("p strong, p");
        if (prevP) qText = prevP.textContent.trim();
      }

      const liAnswers = Array.from(ul.querySelectorAll("li[id^='answer_']"));
      const answers = liAnswers.map(li => {
        const answerId = li.id.replace("answer_", "");
        const label = li.querySelector("label");
        const text = (label?.textContent || "").trim();
        return { answerId, text };
      });

      if (answers.length > 0) {
        items.push({ questionId: qId, questionText: qText, answers });
      }
    }
    return items;
  }

  /** ───────────── OpenAI Responses API ───────────── **/
  async function callOpenAI(apiKey, model, effort, maxOutputTokens, input) {
    const body = { model, input, max_output_tokens: maxOutputTokens };
    if (/^gpt-5/.test(model) && effort && effort !== "default") {
      body.reasoning = { effort };
    }

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = extractOutputText(data);
    if (!text) {
      if (data?.status === "incomplete" && data?.incomplete_details?.reason === "max_output_tokens") {
        throw new Error("Hit the output-token limit before answering — raise “Max output tokens” or lower reasoning effort in ⚙️ settings.");
      }
      throw new Error("Model returned an empty response.");
    }
    return text;
  }

  function extractOutputText(data) {
    if (typeof data?.output_text === "string" && data.output_text.trim()) {
      return data.output_text.trim();
    }
    const parts = [];
    for (const item of data?.output || []) {
      if (item?.type && item.type !== "message") continue; // skip reasoning items
      for (const c of item?.content || []) {
        if (typeof c?.text === "string") parts.push(c.text);
      }
    }
    return parts.join("").trim();
  }

  async function askOpenAI(questions) {
    const apiKey = (cfg("OPENAI_API_KEY") || "").trim();
    if (!apiKey) {
      openConfig();
      throw new Error("No OpenAI API key set — enter it in the ⚙️ settings panel.");
    }

    const model = activeModel();
    setStatus(`📡 Asking ${model}…`, "#ff0");

    const prompt = [
      "You are given Czech workplace safety (BOZP) multiple-choice questions.",
      "For each question, pick EXACTLY ONE best answer.",
      "Return a STRICT JSON array of objects [{questionId, answerId}] with NO extra text.",
      "",
      "Questions:",
      JSON.stringify(questions, null, 2)
    ].join("\n");

    const text = await callOpenAI(
      apiKey,
      model,
      cfg("REASONING_EFFORT"),
      Number(cfg("MAX_OUTPUT_TOKENS")) || DEFAULTS.MAX_OUTPUT_TOKENS,
      prompt
    );

    const json = extractJson(text);
    if (!Array.isArray(json)) throw new Error("Model did not return a JSON array.");

    setStatus(`✅ Got answers from ${model}.`, "#0f0");
    return json;
  }

  function extractJson(s) {
    const fenced = s.replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ""));
    const str = fenced.trim();
    const start = Math.min(...[str.indexOf("["), str.indexOf("{")].filter(i => i >= 0));
    const end = Math.max(str.lastIndexOf("]"), str.lastIndexOf("}"));
    if (start >= 0 && end > start) {
      const candidate = str.slice(start, end + 1);
      try { return JSON.parse(candidate); } catch {}
    }
    try { return JSON.parse(str); } catch { return null; }
  }

  /** ───────────── Filling answers ───────────── **/
  function selectAnswer(questionId, answerId) {
    const ul = document.getElementById(questionId);
    const li = document.getElementById(`answer_${answerId}`);
    if (!ul || !li) return false;
    const input = ul.querySelector(`input[type="radio"][value="${answerId}"]`);
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    li.querySelector("img.radiobutton")?.click();
    li.querySelector("label")?.click();
    return !!ul.querySelector(`input[type="radio"][value="${answerId}"]`)?.checked;
  }

  function clickEvaluate() {
    const evaluateBtn = document.querySelector('.evaluate a.button, a.button[href="#"]');
    if (evaluateBtn) evaluateBtn.click();
  }

  /** ───────────── Runner ───────────── **/
  async function run() {
    const questions = scrapeQuestions();
    if (!questions.length) {
      setStatus("⚠️ No questions found.", "orange");
      return;
    }
    try {
      const picks = await askOpenAI(questions);
      let ok = 0;
      for (const { questionId, answerId } of picks) {
        if (selectAnswer(questionId, String(answerId))) ok++;
      }
      setStatus(`📝 Filled ${ok}/${questions.length} answers.`, "#0f0");
      if (ok > 0 && cfg("AUTO_SUBMIT")) setTimeout(() => clickEvaluate(), 400);
    } catch (e) {
      console.error(e);
      setStatus("❌ Error: " + (e.message || e), "red");
    }
  }

  function waitForTest(start = Date.now()) {
    const container = document.querySelector("#all_questions");
    if (!container) {
      if (Date.now() - start < MAX_WAIT_MS) {
        setTimeout(() => waitForTest(start), RETRY_INTERVAL_MS);
      }
      return;
    }
    run();
  }

  if (IS_TEST_PAGE && cfg("AUTO_RUN")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => waitForTest());
    } else {
      waitForTest();
    }
  }

  /** ───────────── Hotkeys ───────────── **/
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeConfig();
      return;
    }
    if (!e.altKey || !e.shiftKey) return;
    if (e.code === "KeyO" && IS_TEST_PAGE) run();
    if (e.code === "KeyC") openConfig();
  });
})();
