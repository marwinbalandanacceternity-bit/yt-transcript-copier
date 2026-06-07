(() => {
  const COPY_ICON = `<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

  let btnInserted = false;

  function extractAndClean() {
    const segments = document.querySelectorAll(
      "ytd-transcript-segment-renderer .segment-text"
    );
    if (!segments.length) return null;

    const rawLines = Array.from(segments).map((el) =>
      el.textContent.trim().replace(/\s+/g, " ")
    );

    let text = rawLines.join(" ");
    // collapse multiple spaces
    text = text.replace(/ {2,}/g, " ");
    // fix spaces before punctuation
    text = text.replace(/ ([.,;:!?])/g, "$1");
    return text.trim();
  }

  function createButton() {
    const btn = document.createElement("button");
    btn.id = "yt-transcript-copy-btn";
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

      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("copied");
        btn.innerHTML = `${CHECK_ICON}<span>Copied!</span>`;
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = `${COPY_ICON}<span>Copy Transcript</span>`;
        }, 2000);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        btn.classList.add("copied");
        btn.innerHTML = `${CHECK_ICON}<span>Copied!</span>`;
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = `${COPY_ICON}<span>Copy Transcript</span>`;
        }, 2000);
      }
    });

    return btn;
  }

  function tryInsertButton() {
    if (document.getElementById("yt-transcript-copy-btn")) return;

    const header = document.querySelector(
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript'] #header"
    );
    if (!header) {
      btnInserted = false;
      return;
    }

    header.appendChild(createButton());
    btnInserted = true;
  }

  const observer = new MutationObserver(() => {
    const panelVisible = document.querySelector(
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript']"
    );
    if (panelVisible) {
      tryInsertButton();
    } else {
      btnInserted = false;
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
