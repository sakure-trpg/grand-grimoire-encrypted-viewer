(() => {
  "use strict";

  const storageKey = "grand-grimoire-viewing-key";
  let unlock;
  window.SPELL_READY = new Promise(resolve => { unlock = resolve; });

  const screen = document.createElement("div");
  screen.className = "unlock-screen";
  const card = document.createElement("div");
  card.className = "unlock-card";
  const symbol = document.createElement("div");
  symbol.className = "unlock-symbol";
  symbol.textContent = "✧";
  const title = document.createElement("h1");
  title.textContent = "グランドグリモア 呪文検索";
  const description = document.createElement("p");
  description.textContent = "個人用の閲覧キーを入力してください。正しいキーを入力すると、呪文名と本文を表示します。";
  const form = document.createElement("form");
  const label = document.createElement("label");
  label.htmlFor = "unlockKey";
  label.textContent = "閲覧キー";
  const input = document.createElement("input");
  input.id = "unlockKey";
  input.type = "password";
  input.required = true;
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "開く";
  const status = document.createElement("p");
  status.className = "unlock-status";
  status.setAttribute("role", "status");
  form.append(label, input, button, status);
  card.append(symbol, title, description, form);
  screen.append(card);
  document.body.append(screen);

  function bytes(base64) {
    return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  }

  async function decrypt(passphrase) {
    const payload = window.SPELL_PAYLOAD;
    if (!payload || payload.v !== 1 || !crypto.subtle) {
      throw new Error("このブラウザでは閲覧データを開けません。");
    }
    const material = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: bytes(payload.salt), iterations: payload.iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(payload.iv) }, key, bytes(payload.data)
    );
    const records = JSON.parse(new TextDecoder().decode(plain));
    if (!Array.isArray(records) || records.length !== payload.count) {
      throw new Error("閲覧データが壊れています。");
    }
    return records;
  }

  async function attempt(passphrase, fromStorage = false) {
    button.disabled = true;
    status.classList.remove("error");
    status.textContent = "データを開いています…";
    try {
      const records = await decrypt(passphrase);
      window.SPELL_DATA = records;
      window.SPELL_ONLINE = true;
      try { sessionStorage.setItem(storageKey, passphrase); } catch (_) { /* 保存できない環境では毎回入力 */ }
      const lockButton = document.createElement("button");
      lockButton.className = "lock-button";
      lockButton.type = "button";
      lockButton.textContent = "施錠";
      lockButton.addEventListener("click", () => {
        try { sessionStorage.removeItem(storageKey); } catch (_) { /* 保存が無効 */ }
        location.reload();
      });
      document.querySelector(".topbar-actions").append(lockButton);
      document.documentElement.classList.remove("locked");
      screen.remove();
      unlock();
    } catch (_) {
      if (fromStorage) {
        try { sessionStorage.removeItem(storageKey); } catch (_) { /* 保存が無効 */ }
        status.textContent = "";
      } else {
        status.classList.add("error");
        status.textContent = "閲覧キーが違うか、データを開けませんでした。";
      }
      button.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    attempt(input.value);
  });

  let saved = null;
  try { saved = sessionStorage.getItem(storageKey); } catch (_) { /* 保存が無効 */ }
  if (saved) attempt(saved, true);
  else input.focus();
  window.addEventListener("pageshow", event => {
    if (!event.persisted || document.documentElement.classList.contains("locked")) return;
    let key = null;
    try { key = sessionStorage.getItem(storageKey); } catch (_) { /* 保存が無効 */ }
    if (!key) location.reload();
  });
})();
