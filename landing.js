(async () => {
  "use strict";

  await (window.SPELL_READY || Promise.resolve());

  const records = window.SPELL_DATA;
  const list = document.getElementById("spellNames");
  const input = document.getElementById("nameFilter");
  const visibleCount = document.getElementById("visibleCount");

  if (!Array.isArray(records) || !records.length) {
    list.textContent = "呪文データを読み込めませんでした。data.js が同じフォルダにあるか確認してください。";
    return;
  }

  document.getElementById("totalBadge").textContent = `${records.length}呪文`;
  const collator = new Intl.Collator("ja");
  const sorted = [...records].sort((a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id));
  const normalized = new Map(records.map(item => [item.id, norm(item.name)]));

  function norm(value) {
    return String(value).normalize("NFKC").toLocaleLowerCase("ja");
  }

  function render() {
    const query = norm(input.value).trim();
    const matches = sorted.filter(item => normalized.get(item.id).includes(query));
    const fragment = document.createDocumentFragment();
    for (const item of matches) {
      const link = document.createElement("a");
      link.className = "spell-name";
      link.id = item.id;
      link.href = `search.html#${item.id}`;
      link.textContent = item.name;
      fragment.append(link);
    }
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "no-results";
      empty.textContent = "一致する呪文名がありません。";
      fragment.append(empty);
    }
    list.replaceChildren(fragment);
    visibleCount.textContent = query ? `${matches.length}件を表示` : "";
  }

  input.addEventListener("input", render);
  render();
  const lastSelected = document.getElementById(location.hash.slice(1));
  if (lastSelected) requestAnimationFrame(() => lastSelected.scrollIntoView({ block: "center" }));
})();
