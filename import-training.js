import fs from "fs";
import path from "path";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "tara-knowledge");
const OUTPUT_FILE = path.join(process.cwd(), "knowledge.json");

function walkDir(dirPath) {
  let results = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".txt")) {
      if (item.name.toLowerCase() !== "tara-index.txt") {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function parseTxtFile(content, filePath) {
  const lines = content.split(/\r?\n/);

  const entry = {
    source_file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    keyword: "",
    meta_id: "",
    source_id: "",
    title: "",
    category: "",
    subcategory: "",
    tags: [],
    question: "",
    answer: "",
    raw_text: content.trim()
  };

  let inAnswer = false;
  let answerLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("META_ID:")) {
      entry.meta_id = line.replace("META_ID:", "").trim();
      continue;
    }

    if (line.startsWith("SOURCE_ID:")) {
      entry.source_id = line.replace("SOURCE_ID:", "").trim();
      continue;
    }

    if (line.startsWith("TITLE:")) {
      entry.title = line.replace("TITLE:", "").trim();
      continue;
    }

    if (line.startsWith("CATEGORY:")) {
      entry.category = line.replace("CATEGORY:", "").trim();
      continue;
    }

    if (line.startsWith("SUBCATEGORY:")) {
      entry.subcategory = line.replace("SUBCATEGORY:", "").trim();
      continue;
    }

    if (line.startsWith("SEARCH_TAGS:")) {
      entry.tags = line
        .replace("SEARCH_TAGS:", "")
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);
      continue;
    }

    if (line.startsWith("QUESTION:")) {
      entry.question = line.replace("QUESTION:", "").trim();
      continue;
    }

    if (line.startsWith("ANSWER:")) {
      inAnswer = true;
      answerLines.push(line.replace("ANSWER:", "").trim());
      continue;
    }

    if (inAnswer) {
      if (/^[A-Z_ ]+:/.test(line)) {
        inAnswer = false;
      } else {
        answerLines.push(line);
      }
    }
  }

  entry.answer = answerLines.join(" ").trim();

  entry.keyword =
    entry.question ||
    entry.title ||
    entry.tags[0] ||
    entry.meta_id ||
    path.basename(filePath, ".txt");

  if (!entry.answer) {
    const summaryMatch = content.match(/SUMMARY:\s*([\s\S]*?)(?:\n[A-Z_ ]+:|$)/);
    if (summaryMatch) {
      entry.answer = summaryMatch[1].trim().replace(/\n+/g, " ");
    }
  }

  if (!entry.answer) {
    entry.answer = content.trim().slice(0, 1200);
  }

  return entry;
}

function main() {
  if (!fs.existsSync(KNOWLEDGE_ROOT)) {
    console.error(`Knowledge folder not found: ${KNOWLEDGE_ROOT}`);
    process.exit(1);
  }

  const txtFiles = walkDir(KNOWLEDGE_ROOT);

  if (txtFiles.length === 0) {
    console.error("No .txt knowledge files found.");
    process.exit(1);
  }

  const knowledge = [];

  for (const file of txtFiles) {
    try {
      const content = fs.readFileSync(file, "utf8");
      const parsed = parseTxtFile(content, file);

      knowledge.push(parsed);
      console.log(`Imported: ${parsed.meta_id || path.basename(file)} -> ${parsed.keyword}`);
    } catch (err) {
      console.error(`Failed to import ${file}:`, err.message);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledge, null, 2), "utf8");

  console.log(`\nDone. Exported ${knowledge.length} entries to knowledge.json`);
}

main();
