import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

/* ------------------------
   CONFIG
------------------------- */

const TRAINING_ROOT = path.join(process.cwd(), "tara_training");
const CHUNK_SIZE = 1200;      // characters per chunk
const CHUNK_OVERLAP = 200;    // overlap so context is preserved
const BATCH_SIZE = 10;        // upload rows in small batches

/* ------------------------
   CLIENTS
------------------------- */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ------------------------
   HELPERS
------------------------- */

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 100) {
      chunks.push(chunk);
    }

    if (end >= text.length) break;
    start = end - overlap;
  }

  return chunks;
}

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return response.data[0].embedding;
}

async function uploadBatch(rows) {
  if (!rows.length) return;

  const { error } = await supabase.from("knowledge_base").insert(rows);

  if (error) {
    console.error("Supabase insert error:", error);
    throw error;
  }
}

function getAllTxtFiles(dirPath) {
  const results = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      results.push(...getAllTxtFiles(fullPath));
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".txt")) {
      results.push(fullPath);
    }
  }

  return results;
}

function getCategoryFromPath(filePath) {
  const relativePath = path.relative(TRAINING_ROOT, filePath);
  const parts = relativePath.split(path.sep);
  return parts.length > 1 ? parts[0] : "uncategorized";
}

/* ------------------------
   MAIN IMPORT
------------------------- */

async function importTrainingData() {
  console.log("Starting TARA training import...");
  console.log("Training root:", TRAINING_ROOT);

  if (!fs.existsSync(TRAINING_ROOT)) {
    throw new Error(`Training folder not found: ${TRAINING_ROOT}`);
  }

  const files = getAllTxtFiles(TRAINING_ROOT);

  if (!files.length) {
    throw new Error("No .txt files found in tara_training folder.");
  }

  console.log(`Found ${files.length} text files.`);

  let totalFiles = 0;
  let totalChunks = 0;
  let batch = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const category = getCategoryFromPath(filePath);

    console.log(`Processing: [${category}] ${fileName}`);

    const raw = fs.readFileSync(filePath, "utf8");
    const cleaned = cleanText(raw);

    if (cleaned.length < 100) {
      console.log(`Skipped small/empty file: ${fileName}`);
      continue;
    }

    const chunks = chunkText(cleaned);

    console.log(`  -> ${chunks.length} chunks`);

    let chunkIndex = 0;

    for (const chunk of chunks) {
      chunkIndex += 1;

      const embedding = await getEmbedding(chunk);

      batch.push({
        content: chunk,
        metadata: {
          category,
          source_file: fileName,
          source_type: "txt",
          chunk_index: chunkIndex,
          total_chunks: chunks.length
        },
        embedding
      });

      totalChunks += 1;

      if (batch.length >= BATCH_SIZE) {
        console.log(`Uploading batch of ${batch.length} rows...`);
        await uploadBatch(batch);
        batch = [];
      }
    }

    totalFiles += 1;
  }

  if (batch.length > 0) {
    console.log(`Uploading final batch of ${batch.length} rows...`);
    await uploadBatch(batch);
  }

  console.log("Import complete.");
  console.log(`Files processed: ${totalFiles}`);
  console.log(`Chunks uploaded: ${totalChunks}`);
}

importTrainingData()
  .then(() => {
    console.log("TARA training import finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Import failed:", err.message);
    process.exit(1);
  });
