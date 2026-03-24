import { addStatus } from "./ui.js";
import { speak } from "./voice.js";

export function openCamera(dom) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.onchange = function () {
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async function () {
      const imageDataUrl = reader.result;

      addStatus(dom.chatBox, "📷 TARA Vision is analyzing the recovery scene...");

      try {
        const res = await fetch("/tow-ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ imageDataUrl })
        });

        if (!res.ok) {
          throw new Error("Tow AI server error");
        }

        const data = await res.json();
        const answer = data.answer || "TARA Vision could not analyze that image.";

        addStatus(
          dom.chatBox,
          `<b>TARA Vision:</b><br>${answer.replace(/\n/g, "<br>")}`
        );

        speak(answer);
      } catch (err) {
        console.log("Camera analysis failed:", err);
        addStatus(dom.chatBox, "TARA Vision image analysis failed.");
      }
    };

    reader.readAsDataURL(file);
  };

  input.click();
}
