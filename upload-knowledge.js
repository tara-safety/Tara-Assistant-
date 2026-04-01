import fs from "fs";
import path from "path";

const KNOWLEDGE_FILE = path.join(process.cwd(), "knowledge.json");

// Change this to your live server if needed
const API_BASE_URL =
  process.env.TARA_API_URL || "https://tara-assistant-dwhg.onrender.com";
const BULK_ENDPOINT = `${API_BASE_URL}/knowledge/bulk`;

// Keep batches moderate so Render/OpenAI/Supabase don't get slammed
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

function buildContent(entry) {
  const parts = [];

  if (entry.title) parts.push(`Title: ${entry.title}`);
  if (entry.question) parts.push(`Question: ${entry.question}`);
  if (entry.answer) parts.push(`Answer: ${entry.answer}`);
  if (entry.raw_text) parts.push(`Raw Text: ${entry.raw_text}`);

  return parts.join("\n\n").trim();
}

function buildMetadata(entry) {
  return {
    source_file: entry.source_file || null,
    keyword: entry.keyword || null,
    meta_id: entry.meta_id || null,
    source_id: entry.source_id || null,
    title: entry.title || null,
    category: entry.category || null,
    subcategory: entry.subcategory || null,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    question: entry.question || null,
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

    const entries = knowledge
      .map((entry) => {
        const content = buildContent(entry);

        if (!content) return null;

        return {
          content,
          metadata: buildMetadata(entry)
        };
      })
      .filter(Boolean);

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
