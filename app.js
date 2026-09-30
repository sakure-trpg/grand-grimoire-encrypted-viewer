(async () => {
  "use strict";

  await (window.SPELL_READY || Promise.resolve());

  const records = window.SPELL_DATA;
  const list = document.getElementById("resultList");
  const detail = document.getElementById("detailContent");
  const searchInput = document.getElementById("searchInput");
  const resultCount = document.getElementById("resultCount");
  const sortSelect = document.getElementById("sortSelect");
  const backToNames = document.getElementById("backToNames");
  const filters = Array.from(document.querySelectorAll(".filter"));
  const collator = new Intl.Collator("ja");

  if (!Array.isArray(records) || !records.length) {
    list.textContent = "呪文データを読み込めませんでした。data.js が同じフォルダにあるか確認してください。";
    return;
  }

  document.getElementById("totalBadge").textContent = `${records.length}呪文`;
  const byId = new Map(records.map(item => [item.id, item]));
  const normalized = new Map(records.map(item => [item.id, {
    name: norm(item.name),
    metadata: norm(`${item.cost} ${item.duration} ${item.book} ${item.photos.map(p => p.file).join(" ")}`),
    body: norm(item.body),
  }]));
  const state = { book: "all", selectedId: null, shown: [] };

  function norm(text) {
    return String(text).normalize("NFKC").toLocaleLowerCase("ja");
  }

  function terms() {
    return norm(searchInput.value).trim().split(/\s+/).filter(Boolean);
  }

  function score(item, queryTerms) {
    const text = normalized.get(item.id);
    let total = 0;
    for (const term of queryTerms) {
      if (!text.name.includes(term) && !text.metadata.includes(term) && !text.body.includes(term)) {
        return -1;
      }
      if (text.name.includes(term)) total += 12;
      if (text.metadata.includes(term)) total += 4;
      total += Math.min(text.body.split(term).length - 1, 8);
    }
    return total;
  }

  function excerpt(item, queryTerms) {
    const plain = item.body.replace(/\*\*/g, "").replace(/^#{2,6}\s*/gm, "").replace(/\s+/g, " ").trim();
    let position = -1;
    for (const term of queryTerms) {
      position = norm(plain).indexOf(term);
      if (position >= 0) break;
    }
    const start = position < 0 ? 0 : Math.max(0, position - 22);
    const slice = plain.slice(start, start + 105);
    return (start ? "…" : "") + slice + (start + 105 < plain.length ? "…" : "");
  }

  function renderResults() {
    const queryTerms = terms();
    const matches = [];
    for (const item of records) {
      if (state.book !== "all" && item.book !== state.book) continue;
      const value = score(item, queryTerms);
      if (value >= 0) matches.push({ item, score: value });
    }
    if (sortSelect.value === "name") {
      matches.sort((a, b) => collator.compare(a.item.name, b.item.name) || a.item.id.localeCompare(b.item.id));
    } else if (sortSelect.value === "id" || !queryTerms.length) {
      matches.sort((a, b) => a.item.id.localeCompare(b.item.id));
    } else {
      matches.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
    }
    state.shown = matches.map(row => row.item);
    resultCount.textContent = `${matches.length}件`;
    list.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "no-results";
      empty.textContent = "該当する呪文がありません。語句を短くするか、出典の絞り込みを変えてください。";
      list.append(empty);
      state.selectedId = null;
      renderDetail(null);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const { item } of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result-item";
      button.dataset.id = item.id;
      const top = document.createElement("div");
      top.className = "result-top";
      const id = document.createElement("span");
      id.className = "result-id";
      id.textContent = item.id;
      const name = document.createElement("span");
      name.className = "result-name";
      name.textContent = item.name;
      top.append(id, name);
      const meta = document.createElement("div");
      meta.className = "result-meta";
      meta.textContent = `${item.book} · ${item.duration}`;
      const summary = document.createElement("div");
      summary.className = "result-excerpt";
      summary.textContent = excerpt(item, queryTerms);
      button.append(top, meta, summary);
      button.addEventListener("click", () => selectSpell(item.id, true));
      fragment.append(button);
    }
    list.append(fragment);
    const selected = matches.some(row => row.item.id === state.selectedId)
      ? state.selectedId : matches[0].item.id;
    selectSpell(selected, false);
    list.scrollTop = 0;
  }

  function selectSpell(id, updateHash) {
    const item = byId.get(id);
    if (!item) return;
    state.selectedId = id;
    backToNames.href = `index.html#${id}`;
    for (const button of list.querySelectorAll(".result-item.selected")) {
      button.classList.remove("selected");
      button.removeAttribute("aria-current");
    }
    const button = list.querySelector(`[data-id="${id}"]`);
    if (button) {
      button.classList.add("selected");
      button.setAttribute("aria-current", "true");
    }
    renderDetail(item);
    if (updateHash && location.hash !== `#${id}`) location.hash = id;
    if (updateHash) showMobileDetail("smooth");
  }

  function showMobileDetail(behavior) {
    if (window.matchMedia("(max-width: 850px)").matches) {
      document.getElementById("detailPanel").scrollIntoView({ behavior, block: "start" });
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function inlineMarkdown(parent, text) {
    for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
      if (part.startsWith("**") && part.endsWith("**")) {
        parent.append(element("strong", "", part.slice(2, -2)));
      } else if (part) {
        parent.append(document.createTextNode(part));
      }
    }
  }

  function renderBody(container, body) {
    for (const block of body.split(/\n\s*\n/)) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const heading = trimmed.match(/^(#{2,6})\s+(.+)$/);
      if (heading && !trimmed.includes("\n")) {
        container.append(element("h3", "", heading[2]));
        continue;
      }
      const lines = trimmed.split("\n");
      if (lines.every(line => /^[-*]\s/.test(line))) {
        const ul = document.createElement("ul");
        for (const line of lines) {
          const li = document.createElement("li");
          inlineMarkdown(li, line.replace(/^[-*]\s/, ""));
          ul.append(li);
        }
        container.append(ul);
        continue;
      }
      const p = document.createElement("p");
      inlineMarkdown(p, trimmed);
      container.append(p);
    }
  }

  async function copyText(text, button) {
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (_) { /* file:// では利用できないブラウザがある */ }
    if (!copied) {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      copied = document.execCommand("copy");
      field.remove();
    }
    const original = button.textContent;
    button.textContent = copied ? "コピーしました" : "コピーできませんでした";
    setTimeout(() => { button.textContent = original; }, 1800);
  }

  function renderDetail(item) {
    detail.replaceChildren();
    if (!item) {
      const empty = element("div", "empty-detail");
      empty.append(element("div", "glyph", "✧"), element("p", "検索語を変えて呪文を探してください。"));
      detail.append(empty);
      return;
    }
    const inner = element("div", "detail-inner");
    const kicker = element("div", "detail-kicker");
    kicker.append(element("span", "id", item.id), element("span", "", "／"), element("span", "", item.book));
    inner.append(kicker, element("h2", "detail-title", item.name));

    const facts = element("div", "facts");
    for (const [label, value] of [["コスト", item.cost], ["必要時間", item.duration]]) {
      const fact = element("div", "fact");
      fact.append(element("span", "fact-label", label), element("span", "fact-value", value));
      facts.append(fact);
    }
    inner.append(facts);

    const actions = element("div", "actions");
    const copyName = element("button", "action-button", "ID・呪文名をコピー");
    copyName.type = "button";
    copyName.addEventListener("click", () => copyText(`${item.id} ${item.name}`, copyName));
    const copyBody = element("button", "action-button", "本文をコピー");
    copyBody.type = "button";
    copyBody.addEventListener("click", () => copyText(item.body, copyBody));
    actions.append(copyName, copyBody);
    if (!window.SPELL_ONLINE) {
      const source = element("a", "action-link", "Markdownを開く ↗");
      source.href = `../${item.file}`;
      source.target = "_blank";
      source.rel = "noopener";
      actions.append(source);
    }
    inner.append(actions, element("h3", "section-title", "呪文の本文"));
    const body = element("div", "body-text");
    renderBody(body, item.body);
    inner.append(body);

    const photo = element("div", "source-box");
    photo.append(element("strong", "", "元画像の対応"));
    photo.append(document.createTextNode(item.photos.map(p => `${p.book} ${p.file}`).join(" ／ ")));
    inner.append(photo);
    detail.append(inner);
    document.getElementById("detailPanel").scrollTop = 0;
  }

  searchInput.addEventListener("input", renderResults);
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && state.shown.length) selectSpell(state.shown[0].id, true);
  });
  sortSelect.addEventListener("change", renderResults);
  for (const button of filters) {
    button.addEventListener("click", () => {
      state.book = button.dataset.book;
      for (const other of filters) {
        const active = other === button;
        other.classList.toggle("active", active);
        other.setAttribute("aria-pressed", String(active));
      }
      renderResults();
    });
  }
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (event.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = "";
      renderResults();
    }
  });
  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (byId.has(id)) selectSpell(id, false);
  });

  const initialId = location.hash.slice(1);
  if (byId.has(initialId)) state.selectedId = initialId;
  renderResults();
  if (byId.has(initialId)) requestAnimationFrame(() => showMobileDetail("instant"));
})();
