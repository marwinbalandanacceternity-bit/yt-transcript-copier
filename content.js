(() => {
  const COPY_ICON = `<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  const QUIZ_ICON = `<svg viewBox="0 0 24 24"><path d="M4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6zm16-4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>`;

  /* ── Transcript extraction ── */

  function getTranscriptSegments() {
    const selectors = [
      "ytd-transcript-segment-renderer",
      "[target-id='engagement-panel-searchable-transcript'] .segment",
      ".ytd-transcript-body-renderer .segment",
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length) return els;
    }
    return [];
  }

  function extractAndClean() {
    const segments = getTranscriptSegments();
    if (!segments.length) return null;

    const rawLines = Array.from(segments).map((el) => {
      const textEl = el.querySelector(".segment-text") ||
                     el.querySelector("yt-formatted-string.segment-text") ||
                     el;
      let text = textEl.textContent.trim().replace(/\s+/g, " ");
      text = text.replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/g, "");
      return text;
    }).filter((t) => t.length > 0);

    let text = rawLines.join(" ");
    text = text.replace(/ {2,}/g, " ");
    text = text.replace(/ ([.,;:!?])/g, "$1");
    return text.trim();
  }

  /* ── Quiz generator ── */

  function splitSentences(text) {
    return text
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
  }

  function pickRandom(arr, n) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
  }

  function getKeyPhrase(sentence) {
    const stopWords = new Set([
      "the","a","an","is","are","was","were","be","been","being","have","has",
      "had","do","does","did","will","would","could","should","may","might",
      "shall","can","to","of","in","for","on","with","at","by","from","as",
      "into","through","during","before","after","above","below","between",
      "out","off","over","under","again","further","then","once","that",
      "this","these","those","it","its","i","you","he","she","we","they",
      "me","him","her","us","them","my","your","his","our","their","what",
      "which","who","whom","when","where","why","how","all","each","every",
      "both","few","more","most","other","some","such","no","not","only",
      "own","same","so","than","too","very","just","also","about","up",
      "if","or","and","but","because","while","although","however","there",
      "here","really","actually","basically","essentially","simply","going",
      "like","know","think","thing","things","people","something","right",
      "gonna","want","need","get","got","say","said","make","way","even",
      "well","back","much","now","still","let","come","go","see","look",
      "okay","yeah","yes","no","don","doesn","didn","won","wasn","aren",
      "couldn","shouldn","wouldn","isn","re","ve","ll","um","uh"
    ]);
    const words = sentence.replace(/[.,!?;:'"()\[\]{}]/g, "").split(/\s+/);
    const candidates = words.filter(
      (w) => w.length > 3 && !stopWords.has(w.toLowerCase())
    );
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
  }

  function generateFillInBlank(sentence) {
    const key = getKeyPhrase(sentence);
    if (!key) return null;
    const blank = sentence.replace(
      new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      "_________"
    );
    if (blank === sentence) return null;
    return { type: "fill", question: blank, answer: key };
  }

  function generateTrueFalse(sentence) {
    return { type: "tf", question: sentence, answer: "True" };
  }

  function generateOpenEnded(sentence) {
    const starters = [
      "According to the video, what is the significance of",
      "Explain in your own words:",
      "What does the speaker mean by",
      "Describe the concept discussed:",
      "What can you infer from the following statement:",
    ];
    const key = getKeyPhrase(sentence);
    const starter = starters[Math.floor(Math.random() * starters.length)];
    return {
      type: "open",
      question: key
        ? `${starter} "${key}" in the context: "${sentence}"?`
        : `${starter} "${sentence}"`,
      answer: "(Open-ended — refer to transcript)",
    };
  }

  function generateQuiz(text) {
    const sentences = splitSentences(text);
    if (sentences.length < 3) return null;

    const videoTitle =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() ||
      document.querySelector("yt-formatted-string.ytd-watch-metadata")?.textContent?.trim() ||
      document.querySelector("#title h1")?.textContent?.trim() ||
      document.title.replace(" - YouTube", "") ||
      "YouTube Video";

    const pool = pickRandom(sentences, Math.min(sentences.length, 30));
    const questions = [];
    let qNum = 1;

    const fillPool = pickRandom(pool, 12);
    for (const s of fillPool) {
      if (questions.filter((q) => q.type === "fill").length >= 5) break;
      const q = generateFillInBlank(s);
      if (q) { q.num = qNum++; questions.push(q); }
    }

    const tfPool = pickRandom(
      pool.filter((s) => !fillPool.includes(s)).concat(pickRandom(pool, 5)), 10
    );
    for (const s of tfPool) {
      if (questions.filter((q) => q.type === "tf").length >= 5) break;
      const q = generateTrueFalse(s);
      q.num = qNum++;
      questions.push(q);
    }

    const openPool = pickRandom(sentences, 8);
    for (const s of openPool) {
      if (questions.filter((q) => q.type === "open").length >= 3) break;
      const q = generateOpenEnded(s);
      q.num = qNum++;
      questions.push(q);
    }

    let output = `═══════════════════════════════════════════\n`;
    output += `  QUIZ / TEST\n`;
    output += `  "${videoTitle}"\n`;
    output += `═══════════════════════════════════════════\n\n`;

    const fills = questions.filter((q) => q.type === "fill");
    if (fills.length) {
      output += `── SECTION A: FILL IN THE BLANK ──\nDirections: Fill in the blank with the correct word.\n\n`;
      for (const q of fills) output += `${q.num}. ${q.question}\n\n`;
      output += `\n`;
    }

    const tfs = questions.filter((q) => q.type === "tf");
    if (tfs.length) {
      output += `── SECTION B: TRUE OR FALSE ──\nDirections: Write TRUE if the statement is correct based on the video.\n\n`;
      for (const q of tfs) output += `${q.num}. ${q.question}\n    [ TRUE / FALSE ]\n\n`;
      output += `\n`;
    }

    const opens = questions.filter((q) => q.type === "open");
    if (opens.length) {
      output += `── SECTION C: SHORT ANSWER / ESSAY ──\nDirections: Answer in 2-3 sentences.\n\n`;
      for (const q of opens) output += `${q.num}. ${q.question}\n\n\n`;
      output += `\n`;
    }

    output += `═══════════════════════════════════════════\n  ANSWER KEY\n═══════════════════════════════════════════\n\n`;
    for (const q of questions) output += `${q.num}. ${q.answer}\n`;

    return output;
  }

  /* ── Clipboard helper ── */

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  /* ── Button factory ── */

  function flashButton(btn, icon, label, cls, resetIcon, resetLabel, delay) {
    btn.classList.add(cls);
    btn.innerHTML = `${icon}<span>${label}</span>`;
    setTimeout(() => {
      btn.classList.remove(cls);
      btn.innerHTML = `${resetIcon}<span>${resetLabel}</span>`;
    }, delay);
  }

  function createCopyButton() {
    const btn = document.createElement("button");
    btn.id = "yt-transcript-copy-btn";
    btn.className = "yt-transcript-btn";
    btn.innerHTML = `${COPY_ICON}<span>Copy Transcript</span>`;
    btn.addEventListener("click", async () => {
      const text = extractAndClean();
      if (!text) {
        flashButton(btn, COPY_ICON, "No transcript found", "", COPY_ICON, "Copy Transcript", 2000);
        return;
      }
      await copyToClipboard(text);
      flashButton(btn, CHECK_ICON, "Copied!", "copied", COPY_ICON, "Copy Transcript", 2000);
    });
    return btn;
  }

  function createQuizButton() {
    const btn = document.createElement("button");
    btn.id = "yt-transcript-quiz-btn";
    btn.className = "yt-transcript-btn";
    btn.innerHTML = `${QUIZ_ICON}<span>Summarize as Test</span>`;
    btn.addEventListener("click", async () => {
      const text = extractAndClean();
      if (!text) {
        flashButton(btn, QUIZ_ICON, "No transcript found", "", QUIZ_ICON, "Summarize as Test", 2000);
        return;
      }
      btn.classList.add("loading");
      btn.innerHTML = `${QUIZ_ICON}<span>Generating...</span>`;
      await new Promise((r) => setTimeout(r, 50));

      const quiz = generateQuiz(text);
      btn.classList.remove("loading");
      if (!quiz) {
        flashButton(btn, QUIZ_ICON, "Transcript too short", "", QUIZ_ICON, "Summarize as Test", 2000);
        return;
      }
      await copyToClipboard(quiz);
      flashButton(btn, CHECK_ICON, "Test Copied!", "copied", QUIZ_ICON, "Summarize as Test", 2500);
    });
    return btn;
  }

  /* ── Insertion logic ── */

  function createWrapper() {
    const wrapper = document.createElement("div");
    wrapper.id = "yt-transcript-btn-wrapper";
    wrapper.appendChild(createCopyButton());
    wrapper.appendChild(createQuizButton());
    return wrapper;
  }

  function tryInsert() {
    if (document.getElementById("yt-transcript-btn-wrapper")) return true;

    // Strategy 1: find the engagement panel for transcript
    const panelSelectors = [
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript']",
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-structured-description']",
    ];
    for (const sel of panelSelectors) {
      const panel = document.querySelector(sel);
      if (!panel) continue;
      // only target transcript panels that actually have transcript content
      if (!panel.querySelector("ytd-transcript-segment-renderer")) continue;
      const header =
        panel.querySelector("ytd-engagement-panel-title-header-renderer") ||
        panel.querySelector("#header") ||
        panel;
      header.appendChild(createWrapper());
      console.log("[YT Transcript Copier] Inserted via panel header:", sel);
      return true;
    }

    // Strategy 2: find transcript renderer directly
    const transcriptRenderer = document.querySelector("ytd-transcript-renderer");
    if (transcriptRenderer) {
      const header = transcriptRenderer.querySelector("#header") || transcriptRenderer;
      header.appendChild(createWrapper());
      console.log("[YT Transcript Copier] Inserted via ytd-transcript-renderer");
      return true;
    }

    // Strategy 3: find transcript segments and insert before the first one's scroll container
    const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (segments.length) {
      let container = segments[0].parentElement;
      if (container) {
        container.parentElement.insertBefore(createWrapper(), container);
        console.log("[YT Transcript Copier] Inserted above segment list");
        return true;
      }
    }

    return false;
  }

  /* ── Continuous polling — never stops ── */

  setInterval(() => {
    const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (segments.length) {
      tryInsert();
    } else {
      const wrapper = document.getElementById("yt-transcript-btn-wrapper");
      if (wrapper) wrapper.remove();
    }
  }, 1500);

  /* ── Observer for instant response ── */

  const observer = new MutationObserver(() => {
    const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (segments.length) {
      tryInsert();
    } else {
      const wrapper = document.getElementById("yt-transcript-btn-wrapper");
      if (wrapper) wrapper.remove();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  /* ── YouTube SPA navigation detection ── */

  document.addEventListener("yt-navigate-finish", () => {
    const wrapper = document.getElementById("yt-transcript-btn-wrapper");
    if (wrapper) wrapper.remove();
  });
})();
