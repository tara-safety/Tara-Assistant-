import { addStatus } from "./ui.js";
import { speak } from "./voice.js";

function resizeImage(file, maxWidth = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function () {
      const img = new Image();

      img.onload = function () {
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };

      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function openCamera(dom) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.onchange = async function () {
    const file = input.files && input.files[0];
    if (!file) return;

    addStatus(dom.chatBox, "📷 TARA Vision is analyzing the recovery scene...");

    try {
      const imageDataUrl = await resizeImage(file);

      const res = await fetch("/tow-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ imageDataUrl })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.answer || "Tow AI server error");
      }

      const answer = data.answer || "TARA Vision could not analyze that image.";

      addStatus(
        dom.chatBox,
        `<b>TARA Vision:</b><br>${answer.replace(/\n/g, "<br>")}`
      );

      speak(answer);
    } catch (err) {
      console.log("Camera analysis failed:", err);
      addStatus(dom.chatBox, `TARA Vision failed: ${err.message}`);
    }
  };

  input.click();
}
