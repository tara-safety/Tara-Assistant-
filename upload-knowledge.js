import fs from "fs";
import path from "path";

const KNOWLEDGE_FILE = path.join(process.cwd(), "knowledge.json");

const API_BASE_URL =
  process.env.TARA_API_URL || "https://tara-assistant-dwhg.onrender.com";
const BULK_ENDPOINT = `${API_BASE_URL}/knowledge/bulk`;

const BATCH_SIZE = 25;

function readKnowledgeFile() {
  if (!fs.existsSync(KNOWLEDGE_FILE)) {
    throw new Error(`knowledge.json not found at ${KNOWLEDGE_FILE}`);
  }

  const raw = fs.readFileSync(KNOWLEDGE_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("knowledge.json must contain an array");
  }

  return parsed;
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanArray(arr) {
  return Array.isArray(arr)
    ? arr.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function buildContent(entry) {
  const parts = [];

  const title = cleanText(entry.title);
  const category = cleanText(entry.category);
  const subcategory = cleanText(entry.subcategory);
  const keyword = cleanText(entry.keyword);
  const question = cleanText(entry.question);
  const answer = cleanText(entry.answer);
  const rawText = cleanText(entry.raw_text);
  const tags = cleanArray(entry.tags);

  if (title) parts.push(`Title: ${title}`);
  if (category) parts.push(`Category: ${category}`);
  if (subcategory) parts.push(`Subcategory: ${subcategory}`);
  if (keyword) parts.push(`Keyword: ${keyword}`);
  if (tags.length > 0) parts.push(`Tags: ${tags.join(", ")}`);
  if (question) parts.push(`Question: ${question}`);
  if (answer) parts.push(`Answer: ${answer}`);
  if (rawText) parts.push(`Raw Text: ${rawText}`);

  return parts.join("\n\n").trim();
}

function buildMetadata(entry) {
  return {
    source_file: cleanText(entry.source_file) || null,
    keyword: cleanText(entry.keyword) || null,
    meta_id: cleanText(entry.meta_id) || null,
    parent_meta_id: cleanText(entry.parent_meta_id) || null,
    source_id: cleanText(entry.source_id) || null,
    title: cleanText(entry.title) || null,
    category: cleanText(entry.category) || null,
    subcategory: cleanText(entry.subcategory) || null,
    tags: cleanArray(entry.tags),
    question: cleanText(entry.question) || null,
    answer: cleanText(entry.answer) || null,
    raw_text: cleanText(entry.raw_text) || null,
    chunk_type: cleanText(entry.chunk_type) || null,
    imported_at: new Date().toISOString(),
    source_type: "knowledge_json_upload"
  };
}

function chunkArray(items, size) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function prepareEntries(knowledge) {
  const seenMetaIds = new Set();

  return knowledge
    .map((entry, index) => {
      const content = buildContent(entry);
      const metadata = buildMetadata(entry);
      const metaId = metadata.meta_id || `ROW-${index + 1}`;

      if (!content) {
        console.log(`Skipping empty entry at row ${index + 1}`);
        return null;
      }

      if (seenMetaIds.has(metaId)) {
        console.log(`Skipping duplicate meta_id: ${metaId}`);
        return null;
      }

      seenMetaIds.add(metaId);

      return {
        content,
        metadata
      };
    })
    .filter(Boolean);
}

async function uploadBatch(entries, batchNumber, totalBatches) {
  console.log(
    `Uploading batch ${batchNumber}/${totalBatches} (${entries.length} entries)`
  );

  const response = await fetch(BULK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ entries })
  });

  const text = await response.text();

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Batch ${batchNumber} failed: ${response.status} ${response.statusText} - ${JSON.stringify(payload)}`
    );
  }

  console.log(`Batch ${batchNumber} uploaded`, payload);
  return payload;
}

async function main() {
  try {
    console.log("Reading knowledge file...");
    const knowledge = readKnowledgeFile();
    console.log(`Found ${knowledge.length} knowledge entries`);

    const entries = prepareEntries(knowledge);

    if (entries.length === 0) {
      throw new Error("No valid entries found to upload");
    }

    console.log(`Prepared ${entries.length} entries for upload`);

    const batches = chunkArray(entries, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      await uploadBatch(batches[i], i + 1, batches.length);
    }

    console.log("\nUpload complete");
    console.log(`Uploaded ${entries.length} entries to ${API_BASE_URL}`);
  } catch (err) {
    console.error("Upload failed:", err.message);
    process.exit(1);
  }
}

main();
