export function addChat(chatBox, html) {
  if (!chatBox) return;
  chatBox.innerHTML += `<div style="margin-bottom:12px;">${html}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
}

export function addUserMessage(chatBox, text) {
  addChat(chatBox, `<b>You:</b> ${escapeHtml(text)}`);
}

export function addTaraMessage(chatBox, text) {
  addChat(chatBox, `<b>TARA:</b> ${escapeHtml(text).replace(/\n/g, "<br>")}`);
}

export function addStatus(chatBox, text) {
  addChat(chatBox, text);
}

export function createThinking(chatBox) {
  const thinking = document.createElement("div");
  thinking.innerHTML = "<i>TARA is analyzing...</i>";
  thinking.style.marginBottom = "12px";
  chatBox.appendChild(thinking);
  chatBox.scrollTop = chatBox.scrollHeight;
  return thinking;
}

export function addFooter() {
  const footer = document.createElement("div");
  footer.style.textAlign = "center";
  footer.style.fontSize = "11px";
  footer.style.opacity = "0.6";
  footer.style.marginTop = "10px";
  footer.innerHTML =
    "Powered by AI Intelligence • Safety Buzz Alerts • © TARA Safety";
  document.body.appendChild(footer);
}

export function setupMenu(menuBtn, menu) {
  if (!menuBtn || !menu) return;

  menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    menu.classList.toggle("open");
  });

  document.addEventListener("click", function (e) {
    if (
      menu.classList.contains("open") &&
      !menu.contains(e.target) &&
      e.target !== menuBtn
    ) {
      menu.classList.remove("open");
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
