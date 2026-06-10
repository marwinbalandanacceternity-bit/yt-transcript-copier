(() => {
  const COPY_ICON = `<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  const QUIZ_ICON = `<svg viewBox="0 0 24 24"><path d="M4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6zm16-4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>`;

  let btnInserted = false;

  /* ── Transcript extraction ── */

  function extractAndClean() {
    const segments = document.querySelectorAll(
      "ytd-transcript-segment-renderer .segment-text"
    );
    if (!segments.length) return null;

    const rawLines = Array.from(segments).map((el) =>
      el.textContent.trim().replace(/\s+/g, " ")
    );

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

    if (candidates.length === 0) return null;

    // prefer longer, less common words
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
  }

  function generateFillInBlank(sentence) {
    const key = getKeyPhrase(sentence);
    if (!key) return null;

    const blank = sentence.replace(
      new RegExp(`\\b${key}\\b`, "i"),
      "_________"
    );
    if (blank === sentence) return null;

    return {
      type: "fill",
      question: blank,
      answer: key,
    };
  }

  function generateTrueFalse(sentence) {
    return {
      type: "tf",
      question: sentence,
      answer: "True",
    };
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
      document.querySelector(
        "yt-formatted-string.style-scope.ytd-watch-metadata"
      )?.textContent?.trim() || "YouTube Video";

    // pick sentences for each question type
    const pool = pickRandom(sentences, Math.min(sentences.length, 30));

    const questions = [];
    let qNum = 1;

    // ── Section 1: Fill in the Blank (5 questions) ──
    const fillPool = pickRandom(pool, 12);
    for (const s of fillPool) {
      if (questions.filter((q) => q.type === "fill").length >= 5) break;
      const q = generateFillInBlank(s);
      if (q) {
        q.num = qNum++;
        questions.push(q);
      }
    }

    // ── Section 2: True or False (5 questions) ──
    const tfPool = pickRandom(
      pool.filter((s) => !fillPool.includes(s)).concat(pickRandom(pool, 5)),
      10
    );
    for (const s of tfPool) {
      if (questions.filter((q) => q.type === "tf").length >= 5) break;
      const q = generateTrueFalse(s);
      q.num = qNum++;
      questions.push(q);
    }

    // ── Section 3: Open-Ended (3 questions) ──
    const openPool = pickRandom(sentences, 8);
    for (const s of openPool) {
      if (questions.filter((q) => q.type === "open").length >= 3) break;
      const q = generateOpenEnded(s);
      q.num = qNum++;
      questions.push(q);
    }

    // ── Build output ──
    let output = "";
    output += `═══════════════════════════════════════════\n`;
    output += `  QUIZ / TEST\n`;
    output += `  "${videoTitle}"\n`;
    output += `═══════════════════════════════════════════\n\n`;

    // Fill in the Blank section
    const fills = questions.filter((q) => q.type === "fill");
    if (fills.length) {
      output += `── SECTION A: FILL IN THE BLANK ──\n`;
      output += `Directions: Fill in the blank with the correct word.\n\n`;
      for (const q of fills) {
        output += `${q.num}. ${q.question}\n\n`;
      }
      output += `\n`;
    }

    // True or False section
    const tfs = questions.filter((q) => q.type === "tf");
    if (tfs.length) {
      output += `── SECTION B: TRUE OR FALSE ──\n`;
      output += `Directions: Write TRUE if the statement is correct based on the video.\n\n`;
      for (const q of tfs) {
        output += `${q.num}. ${q.question}\n    [ TRUE / FALSE ]\n\n`;
      }
      output += `\n`;
    }

    // Open-Ended section
    const opens = questions.filter((q) => q.type === "open");
    if (opens.length) {
      output += `── SECTION C: SHORT ANSWER / ESSAY ──\n`;
      output += `Directions: Answer in 2-3 sentences.\n\n`;
      for (const q of opens) {
        output += `${q.num}. ${q.question}\n\n\n`;
      }
      output += `\n`;
    }

    // Answer Key
    output += `═══════════════════════════════════════════\n`;
    output += `  ANSWER KEY\n`;
    output += `═══════════════════════════════════════════\n\n`;
    for (const q of questions) {
      const prefix =
        q.type === "fill"
          ? `${q.num}. ${q.answer}`
          : q.type === "tf"
          ? `${q.num}. ${q.answer}`
          : `${q.num}. ${q.answer}`;
      output += `${prefix}\n`;
    }

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

  /* ── Button: Copy Transcript ── */

  function createCopyButton() {
    const btn = document.createElement("button");
    btn.id = "yt-transcript-copy-btn";
    btn.className = "yt-transcript-btn";
    btn.innerHTML = `${COPY_ICON}<span>Copy Transcript</span>`;

    btn.addEventListener("click", async () => {
      const text = extractAndClean();
      if (!text) {
        btn.querySelector("span").textContent = "No transcript found";
        setTimeout(() => {
          btn.querySelector("span").textContent = "Copy Transcript";
        }, 2000);
        return;
      }

      await copyToClipboard(text);
      btn.classList.add("copied");
      btn.innerHTML = `${CHECK_ICON}<span>Copied!</span>`;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = `${COPY_ICON}<span>Copy Transcript</span>`;
      }, 2000);
    });

    return btn;
  }

  /* ── Button: Summarize as Test ── */

  function createQuizButton() {
    const btn = document.createElement("button");
    btn.id = "yt-transcript-quiz-btn";
    btn.className = "yt-transcript-btn";
    btn.innerHTML = `${QUIZ_ICON}<span>Summarize as Test</span>`;

    btn.addEventListener("click", async () => {
      const text = extractAndClean();
      if (!text) {
        btn.querySelector("span").textContent = "No transcript found";
        setTimeout(() => {
          btn.querySelector("span").textContent = "Summarize as Test";
        }, 2000);
        return;
      }

      btn.classList.add("loading");
      btn.innerHTML = `${QUIZ_ICON}<span>Generating...</span>`;

      // small delay so the UI updates
      await new Promise((r) => setTimeout(r, 50));

      const quiz = generateQuiz(text);
      if (!quiz) {
        btn.classList.remove("loading");
        btn.querySelector("span").textContent = "Transcript too short";
        setTimeout(() => {
          btn.innerHTML = `${QUIZ_ICON}<span>Summarize as Test</span>`;
        }, 2000);
        return;
      }

      await copyToClipboard(quiz);
      btn.classList.remove("loading");
      btn.classList.add("copied");
      btn.innerHTML = `${CHECK_ICON}<span>Test Copied!</span>`;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = `${QUIZ_ICON}<span>Summarize as Test</span>`;
      }, 2500);
    });

    return btn;
  }

  /* ── Insert buttons ── */

  function tryInsertButtons() {
    if (document.getElementById("yt-transcript-copy-btn")) return;

    const header = document.querySelector(
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript'] #header"
    );
    if (!header) {
      btnInserted = false;
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "yt-transcript-btn-wrapper";
    wrapper.appendChild(createCopyButton());
    wrapper.appendChild(createQuizButton());
    header.appendChild(wrapper);
    btnInserted = true;
  }

  /* ── Observer ── */

  const observer = new MutationObserver(() => {
    const panelVisible = document.querySelector(
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript']"
    );
    if (panelVisible) {
      tryInsertButtons();
    } else {
      btnInserted = false;
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
