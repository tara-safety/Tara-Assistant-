import fs from "fs/promises";
import path from "path";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INPUT_FILE = path.join(process.cwd(), "chunks.json");
const BATCH_SIZE = 20;

function normalizeText(text = "") {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function makeContentHash(text = "") {
  return createHash("sha256")
    .update(normalizeText(text), "utf8")
    .digest("hex");
}

function dedupeInMemory(entries = []) {
  const seen = new Set();
  const clean = [];

  for (const entry of entries) {
    const content = normalizeText(entry?.content || "");
    if (!content) continue;

    const content_hash = makeContentHash(content);
    if (seen.has(content_hash)) continue;

    seen.add(content_hash);

    clean.push({
      content,
      content_hash,
      metadata: entry?.metadata || {}
    });
  }

  return clean;
}

async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return res.data[0].embedding;
}

async function buildRows(entries = []) {
  const rows = [];

  for (const entry of entries) {
    const embedding = await getEmbedding(entry.content);

    rows.push({
      content: entry.content,
      content_hash: entry.content_hash,
      metadata: entry.metadata,
      embedding
    });
  }

  return rows;
}

async function uploadBatch(rows = []) {
  if (!rows.length) return { inserted: 0 };

  const { data, error } = await supabase
    .from("knowledge_base")
    .upsert(rows, {
      onConflict: "content_hash",
      ignoreDuplicates: true
    })
    .select("id, content_hash");

  if (error) {
    throw error;
  }

  return {
    inserted: data?.length || 0
  };
}

async function main() {
  console.log("Reading input file:", INPUT_FILE);

  const raw = await fs.readFile(INPUT_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("chunks.json must be an array of entries");
  }

  console.log("Original entries:", parsed.length);

  const deduped = dedupeInMemory(parsed);

  console.log("After local dedupe:", deduped.length);

  let uploadedTotal = 0;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const slice = deduped.slice(i, i + BATCH_SIZE);
    console.log(`Embedding batch ${i + 1} to ${i + slice.length}...`);

    const rows = await buildRows(slice);
    const result = await uploadBatch(rows);

    uploadedTotal += result.inserted;
    console.log(`Inserted this batch: ${result.inserted}`);
  }

  console.log("Done.");
  console.log("Total inserted:", uploadedTotal);
  console.log("Total skipped as duplicates:", deduped.length - uploadedTotal);
}

main().catch((err) => {
  console.error("Uploader failed:", err.message);
  process.exit(1);
});
