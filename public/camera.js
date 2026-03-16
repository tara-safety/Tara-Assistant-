import { addStatus } from "./ui.js";
import { speak } from "./voice.js";

export function openCamera(dom) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.onchange = async function () {
    const file = input.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("image", file);

    addStatus(dom.chatBox, "📷 Analyzing tow situation...");

    try {
      const res = await fetch("/tow-ai", {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        throw new Error("Tow AI server error");
      }

      const data = await res.json();
      addStatus(dom.chatBox, `<b>Tow AI:</b> ${data.advice}`);
      speak(data.advice);
    } catch (err) {
      console.log("Camera analysis failed:", err);
      addStatus(dom.chatBox, "Image analysis failed");
    }
  };

  input.click();
}
