import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const folder = "./knowledge_files";

async function processFiles() {

  const files = fs.readdirSync(folder);

  for (const file of files) {

    const content = fs.readFileSync(
      path.join(folder, file),
      "utf8"
    );

    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content
    });

    await supabase.from("knowledge_base").insert({
      content: content,
      metadata: { source: file },
      embedding: embedding.data[0].embedding
    });

    console.log("Embedded:", file);

  }

}

processFiles();
