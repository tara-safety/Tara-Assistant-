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

function cleanText(value = "") {
  return String(value).trim();
}

function cleanArray(arr) {
  return Array.isArray(arr)
    ? arr.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function deriveParentMetaId(metaId = "") {
  const id = cleanText(metaId);
  const match = id.match(/^(.+?)([A-Z])$/);
  if (!match) return null;

  const base = match[1];
  if (!/^SBA-KB-\d+$/i.test(base)) return null;

  return base;
}

function parseTxtFile(content, filePath) {
  const lines = content.split(/\r?\n/);

  const entry = {
    source_file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    keyword: "",
    meta_id: "",
    parent_meta_id: null,
    source_id: "",
    title: "",
    category: "",
    subcategory: "",
    tags: [],
    question: "",
    answer: "",
    raw_text: content.trim(),
    chunk_type: ""
  };

  let inAnswer = false;
  const answerLines = [];

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
        .map((tag) => tag.trim())
        .filter(Boolean);
      continue;
    }

    if (line.startsWith("QUESTION:")) {
      entry.question = line.replace("QUESTION:", "").trim();
      continue;
    }

    if (line.startsWith("CHUNK_TYPE:")) {
      entry.chunk_type = line.replace("CHUNK_TYPE:", "").trim();
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
  entry.parent_meta_id = deriveParentMetaId(entry.meta_id);

  entry.keyword =
    cleanText(entry.question) ||
    cleanText(entry.title) ||
    cleanArray(entry.tags)[0] ||
    cleanText(entry.meta_id) ||
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

  entry.source_file = cleanText(entry.source_file);
  entry.keyword = cleanText(entry.keyword);
  entry.meta_id = cleanText(entry.meta_id);
  entry.source_id = cleanText(entry.source_id);
  entry.title = cleanText(entry.title);
  entry.category = cleanText(entry.category);
  entry.subcategory = cleanText(entry.subcategory);
  entry.tags = cleanArray(entry.tags);
  entry.question = cleanText(entry.question);
  entry.answer = cleanText(entry.answer);
  entry.raw_text = cleanText(entry.raw_text);
  entry.chunk_type = cleanText(entry.chunk_type);

  return entry;
}

function inheritParentMetadata(entries) {
  const byMetaId = new Map();

  for (const entry of entries) {
    if (entry.meta_id) {
      byMetaId.set(entry.meta_id, entry);
    }
  }

  return entries.map((entry) => {
    if (!entry.parent_meta_id) return entry;

    const parent = byMetaId.get(entry.parent_meta_id);
    if (!parent) return entry;

    return {
      ...entry,
      title: entry.title || parent.title || "",
      category: entry.category || parent.category || "",
      subcategory: entry.subcategory || parent.subcategory || "",
      tags: entry.tags.length > 0 ? entry.tags : cleanArray(parent.tags),
      source_id: entry.source_id || parent.source_id || "",
      keyword: entry.keyword || entry.question || parent.keyword || ""
    };
  });
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

  const parsedEntries = [];

  for (const file of txtFiles) {
    try {
      const content = fs.readFileSync(file, "utf8");
      const parsed = parseTxtFile(content, file);
      parsedEntries.push(parsed);

      console.log(
        `Imported: ${parsed.meta_id || path.basename(file)} -> ${parsed.keyword}`
      );
    } catch (err) {
      console.error(`Failed to import ${file}:`, err.message);
    }
  }

  const knowledge = inheritParentMetadata(parsedEntries);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledge, null, 2), "utf8");

  console.log(`\nDone. Exported ${knowledge.length} entries to knowledge.json`);
}

main();
