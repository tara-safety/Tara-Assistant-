import OpenAI from "openai";

/* =========================================================
   1. TEXT + QUESTION HELPERS
========================================================= */

function cleanText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTowingQuestion(question) {
  const q = cleanText(question);

  const keywords = [
    "tow",
    "towing",
    "recovery",
    "winch",
    "flatbed",
    "wheel lift",
    "wheel-lift",
    "strap",
    "chain",
    "unlock",
    "lockout",
    "hook",
    "roadside",
    "ditch",
    "rollover",
    "highway",
    "traffic",
    "pylons",
    "cones",
    "battery",
    "jump start",
    "jump-start",
    "flat tire",
    "spare tire",
    "ev",
    "electric vehicle",
    "tow truck",
    "carrier",
    "vehicle",
    "stuck",
    "snow",
    "ditch pull",
    "tow points",
    "transport mode",
    "tesla",
    "hybrid",
    "12v",
    "charging",
    "dispatcher",
    "dispatch",
    "disabled vehicle",
    "jack",
    "lug nut",
    "dolly",
    "rollback",
    "j-hook",
    "tie down",
    "move over"
  ];

  return keywords.some((word) => q.includes(word));
}

function isLockoutQuestion(question) {
  const q = cleanText(question);
  return (
    q.includes("unlock") ||
    q.includes("lockout") ||
    q.includes("locked keys") ||
    q.includes("keys locked") ||
    q.includes("locked out")
  );
}

function isEVQuestion(question) {
  const q = cleanText(question);
  return (
    q.includes("ev") ||
    q.includes("electric vehicle") ||
    q.includes("tesla") ||
    q.includes("hybrid") ||
    q.includes("plug in") ||
    q.includes("battery electric")
  );
}

function getImportantQuestionTerms(question) {
  return cleanText(question)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 3 &&
        ![
          "what",
          "how",
          "when",
          "where",
          "with",
          "from",
          "that",
          "this",
          "into",
          "your",
          "does",
          "have",
          "will",
          "ford",
          "vehicle",
          "about",
          "could",
          "would",
          "should",
          "there",
          "their",
          "them"
        ].includes(word)
    );
}

/* =========================================================
   2. RESPONSE PARSING
========================================================= */

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data?.output)) {
    const parts = [];

    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;

      for (const part of item.content) {
        if (part?.type === "output_text" && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    }

    const joined = parts.join("\n").trim();
    if (joined) return joined;
  }

  return "";
}

function extractWebSources(data) {
  const sources = [];

  try {
    for (const item of data?.output || []) {
      if (
        item?.type === "web_search_call" &&
        Array.isArray(item?.action?.sources)
      ) {
        for (const src of item.action.sources) {
          if (src?.url) {
            sources.push({
              title: src.title || "Source",
              url: src.url
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Web source extraction error:", err.message);
  }

  return sources.slice(0, 5);
}

/* =========================================================
   3. PRO MODE HELPERS
========================================================= */

function toBullets(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatProAnswerFromSections(titleMap) {
  const sections = [];

  for (const [title, items] of Object.entries(titleMap)) {
    if (Array.isArray(items) && items.length > 0) {
      sections.push(`${title}:\n${toBullets(items)}`);
    }
  }

  return sections.join("\n\n").trim();
}

/* =========================================================
   4. BUILT-IN SMART ANSWERS
========================================================= */

function getSmartBuiltInProAnswer(question) {
  const q = cleanText(question);

  if (isEVQuestion(question) && (q.includes("tow") || q.includes("towing"))) {
    return formatProAnswerFromSections({
      "Best Practice": [
        "Use a flatbed whenever possible"
      ],
      "Check First": [
        "Confirm make, model, and drive type",
        "Check whether transport mode or tow mode is required",
        "Confirm whether the vehicle will roll freely"
      ],
      "Do Not Do": [
        "Do not drag drive wheels unless approved",
        "Do not attach to unknown underbody components"
      ],
      "Final Check": [
        "If the OEM procedure is unclear, stop and verify before towing"
      ]
    });
  }

  if (isLockoutQuestion(question)) {
    return formatProAnswerFromSections({
      "Scene Check": [
        "Make sure the vehicle is secure before starting",
        "Protect glass, trim, seals, and paint"
      ],
      "Entry Plan": [
        "Use the least-damaging method first",
        "Control the tool and protect contact points"
      ],
      "Do Not Do": [
        "Do not force entry if the method is uncertain",
        "Do not rush and damage trim or weather stripping"
      ],
      "Final Check": [
        "Verify the method before continuing if the vehicle is unfamiliar"
      ]
    });
  }

  if (
    q.includes("ditch") ||
    q.includes("nose first") ||
    q.includes("rear first") ||
    q.includes("stuck in ditch")
  ) {
    return formatProAnswerFromSections({
      "Scene Check": [
        "Check traffic exposure",
        "Check shoulder stability and ditch depth",
        "Check vehicle angle and ground condition"
      ],
      "Stabilize": [
        "Stabilize the vehicle if there is any chance of shifting or rolling",
        "Confirm where the customer should safely stand or wait"
      ],
      "Recovery Plan": [
        "Use the straightest and least-shocking pull possible",
        "Avoid side-loading and sudden jerks",
        "Plan where the vehicle will travel once it reaches the shoulder"
      ],
      "Safer Finish": [
        "Decide whether winch-out, wheel-lift assist, dollies, or flatbed load is the safest finish"
      ],
      "Stop If": [
        "Stop and reassess if the angle, anchor point, or vehicle condition is uncertain"
      ]
    });
  }

  if (
    q.includes("snow") ||
    q.includes("ice") ||
    q.includes("slippery") ||
    q.includes("stuck in snow")
  ) {
    return formatProAnswerFromSections({
      "Scene Check": [
        "Check depth of sink and available traction",
        "Confirm the path the vehicle will take once it breaks free"
      ],
      "Setup": [
        "Keep the pull as straight as possible",
        "Use controlled movement instead of shock loading"
      ],
      "Watch For": [
        "Watch for sideways slide on ice",
        "Be ready for quick release once traction returns"
      ],
      "Do Not Do": [
        "Do not spin tires deeper into snow",
        "Do not use sudden jerks if control is poor"
      ]
    });
  }

  if (
    q.includes("soft shoulder") ||
    q.includes("off road") ||
    q.includes("edge of road") ||
    q.includes("soft ground")
  ) {
    return formatProAnswerFromSections({
      "Truck Position": [
        "Make sure your truck is not at risk of sinking or sliding",
        "Avoid loading the edge of the shoulder"
      ],
      "Setup": [
        "Position for the safest and most stable pull",
        "Use a controlled straight pull"
      ],
      "Watch For": [
        "Watch for ground collapse under load",
        "Watch the casualty path onto firm ground"
      ],
      "Stop If": [
        "Stop and reassess if ground stability is questionable"
      ]
    });
  }

  if (
    q.includes("won't roll") ||
    q.includes("wont roll") ||
    q.includes("locked wheel") ||
    q.includes("parking brake stuck")
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Confirm why the vehicle is not rolling",
        "Check parking brake, seized brakes, transmission lock, or wheel damage"
      ],
      "Best Practice": [
        "Use dollies, skates, or lift methods if wheels cannot rotate safely"
      ],
      "Do Not Do": [
        "Do not drag the vehicle without understanding the cause"
      ],
      "Stop If": [
        "Stop and verify if the reason for lock-up is unclear"
      ]
    });
  }

  if (
    q.includes("flatbed") ||
    q.includes("rollback") ||
    q.includes("loading angle") ||
    q.includes("low car") ||
    q.includes("scrape")
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Check ground clearance and approach angle"
      ],
      "Setup": [
        "Reduce loading angle with ramps, blocks, or tilt adjustment",
        "Keep the pull straight and controlled"
      ],
      "Watch For": [
        "Watch bumper, underbody, exhaust, and transition points"
      ],
      "Stop If": [
        "Stop and adjust if the vehicle starts to bottom out or hang up"
      ]
    });
  }

  if (
    q.includes("accident") ||
    q.includes("collision") ||
    q.includes("crash") ||
    q.includes("damaged vehicle")
  ) {
    return formatProAnswerFromSections({
      "Scene Check": [
        "Check for fluid leaks, broken suspension, and shifting weight",
        "Treat the vehicle as unstable until proven otherwise"
      ],
      "Best Practice": [
        "Use the safest loading method, often a flatbed"
      ],
      "Watch For": [
        "Do not assume wheels will roll or steer correctly"
      ],
      "Stop If": [
        "Stop and reassess if anything looks compromised or unpredictable"
      ]
    });
  }

  if (
    q.includes("ev") &&
    (q.includes("neutral") || q.includes("won't move") || q.includes("wont move"))
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Confirm the vehicle state",
        "Check whether transport mode or tow mode is required"
      ],
      "Best Practice": [
        "Use dollies or a flatbed if the wheels cannot rotate freely"
      ],
      "Do Not Do": [
        "Do not force movement with a locked drivetrain",
        "Do not drag the vehicle"
      ],
      "Stop If": [
        "Stop and verify if the model-specific procedure is unknown"
      ]
    });
  }

  if (
    q.includes("underground") ||
    q.includes("parking garage") ||
    q.includes("low clearance")
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Check height clearance, ramp angle, and turning space"
      ],
      "Setup": [
        "Use low-clearance equipment",
        "Plan your exit path before loading"
      ],
      "Watch For": [
        "Watch ceiling height, body clearance, and ramp transitions"
      ],
      "Stop If": [
        "Stop and reassess if space or angle is too tight for safe operation"
      ]
    });
  }

  if (
    q.includes("tight space") ||
    q.includes("tight area") ||
    q.includes("narrow") ||
    q.includes("confined")
  ) {
    return formatProAnswerFromSections({
      "Plan": [
        "Slow the operation down and plan every movement first"
      ],
      "Watch For": [
        "Watch mirrors, doors, nearby vehicles, and body clearance"
      ],
      "Best Practice": [
        "Use the smallest movement possible to gain position",
        "Keep the vehicle controlled at all times"
      ],
      "Stop If": [
        "Stop and reassess if positioning becomes unsafe or too tight to control"
      ]
    });
  }

  if (
    q.includes("broken suspension") ||
    q.includes("wheel collapsed") ||
    q.includes("wheel bent") ||
    q.includes("control arm")
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Assess whether the damaged corner can support movement"
      ],
      "Best Practice": [
        "Use dollies or a flatbed to support the damaged corner",
        "Move slowly and watch for shifting or binding"
      ],
      "Do Not Do": [
        "Do not force-roll or drag a collapsed suspension without support"
      ],
      "Stop If": [
        "Stop and reassess if the vehicle cannot be safely supported"
      ]
    });
  }

  if (
    q.includes("high centered") ||
    q.includes("on curb") ||
    q.includes("stuck on curb") ||
    q.includes("bottomed out")
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Find the contact point and what is carrying the vehicle weight"
      ],
      "Best Practice": [
        "Use controlled movement to reduce load on the hang-up point"
      ],
      "Do Not Do": [
        "Do not drag the underbody across the contact point"
      ],
      "Stop If": [
        "Stop and reassess if the vehicle may shift suddenly when freed"
      ]
    });
  }

  if (
    q.includes("wheel lift") ||
    q.includes("flatbed or wheel lift") ||
    q.includes("which tow method")
  ) {
    return formatProAnswerFromSections({
      "Choose Flatbed When": [
        "Vehicle is damaged",
        "Vehicle will not roll",
        "EV or AWD procedure is uncertain"
      ],
      "Choose Wheel Lift When": [
        "Vehicle is stable",
        "Vehicle rolls freely",
        "Drivetrain and condition allow it"
      ],
      "Final Check": [
        "Default to the safest method if unsure"
      ]
    });
  }

  if (
    q.includes("steep driveway") ||
    q.includes("steep angle") ||
    q.includes("incline") ||
    q.includes("hill recovery")
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Check slope and how weight will shift during movement"
      ],
      "Setup": [
        "Use the straightest path possible",
        "Control rollback and sudden movement"
      ],
      "Watch For": [
        "Watch side load and traction loss"
      ],
      "Stop If": [
        "Stop and reassess if traction or control is uncertain"
      ]
    });
  }

  if (
    q.includes("frozen brakes") ||
    q.includes("seized") ||
    q.includes("wheel stuck")
  ) {
    return formatProAnswerFromSections({
      "Check First": [
        "Confirm the cause of wheel lock before forcing movement"
      ],
      "Best Practice": [
        "Use dollies or lift methods if wheels cannot rotate"
      ],
      "Do Not Do": [
        "Do not drag the vehicle with locked wheels"
      ],
      "Stop If": [
        "Stop and reassess if the condition cannot be safely managed"
      ]
    });
  }

  if (
    q.includes("highway") ||
    q.includes("live traffic") ||
    q.includes("shoulder recovery")
  ) {
    return formatProAnswerFromSections({
      "First Priority": [
        "Traffic control and visibility"
      ],
      "Setup": [
        "Position the truck to protect the scene",
        "Create the safest work area possible"
      ],
      "Best Practice": [
        "Minimize time exposed to live lanes",
        "Stay aware of traffic flow at all times"
      ],
      "Stop If": [
        "Stop immediately if traffic conditions make the scene unsafe"
      ]
    });
  }

  return "";
}

function getSmartBuiltInAnswer(question, proMode = false) {
  if (proMode) {
    return getSmartBuiltInProAnswer(question);
  }

  const q = cleanText(question);

  if (isEVQuestion(question) && (q.includes("tow") || q.includes("towing"))) {
    return "Most EVs should be transported on a flatbed because dragging the drive wheels can damage the drivetrain or create system issues. First confirm the exact make, model, drive type, and whether transport mode or tow mode is required before moving it. Do not assume the vehicle will roll freely just because it is powered off, and do not attach to unknown underbody components. If the exact manufacturer procedure is unclear, stop and verify before towing. Follow company policy and local regulations.";
  }

  if (isLockoutQuestion(question)) {
    return "Start with the least-damaging entry method and make sure the vehicle is secure before touching glass, trim, or seals. Protect the glass, weather stripping, trim, and paint during entry. If the exact method for that vehicle is uncertain, stop and verify before proceeding. Protect the vehicle first and follow company policy and local regulations.";
  }

  if (
    q.includes("ditch") ||
    q.includes("nose first") ||
    q.includes("rear first") ||
    q.includes("stuck in ditch")
  ) {
    return "Start by slowing the whole scene down and checking traffic exposure, shoulder stability, ditch depth, vehicle angle, ground condition, and whether the customer can stay safely inside or must move to a protected area. Stabilize the vehicle first if there is any chance of shifting, sliding, or rolling during hookup. Use the straightest and least-shocking pull possible, and avoid side-loading, sudden jerks, or attachment to weak or unknown components. Before pulling, confirm where the vehicle will travel, what will happen when it reaches the shoulder, and whether a winch-out, wheel-lift assist, dollies, or flatbed load is the safer finish. If the recovery angle, anchor point, or vehicle condition is uncertain, stop and reassess before continuing. Follow company policy and local regulations.";
  }

  return "";
}

function buildFallbackAnswer(question, proMode = false) {
  const builtIn = getSmartBuiltInAnswer(question, proMode);

  if (builtIn) {
    return builtIn;
  }

  if (proMode) {
    return formatProAnswerFromSections({
      "Check First": [
        "Slow the scene down",
        "Verify vehicle details",
        "Confirm the safest procedure before continuing"
      ],
      "Stop If": [
        "Stop and reassess if the vehicle, setup, or scene is uncertain"
      ]
    });
  }

  return "I don’t have a strong answer on that yet. The safest move is to slow down, verify the vehicle details, and confirm the right procedure before continuing. Follow company policy and local regulations.";
}

function shouldUseWebFallback(answer) {
  if (!answer) return true;

  const a = answer.toLowerCase().trim();

  if (a.length < 80) return true;

  const weakPhrases = [
    "i don't have a strong answer",
    "i dont have a strong answer",
    "i'm not sure",
    "i am not sure",
    "not certain",
    "may vary",
    "depends on the model",
    "depends on trim",
    "check the owner",
    "check the manual",
    "not enough information",
    "unclear from the information"
  ];

  return weakPhrases.some((phrase) => a.includes(phrase));
}

/* =========================================================
   5. PROMPTS
========================================================= */

function buildChatPrompt(question, knowledgeContext) {
  return `You are TARA (Tow Awareness and Response Assistant).

You are speaking to a tow operator, dispatcher, roadside tech, or fleet user.

Style:
- sound natural, practical, and human
- do not sound robotic
- answer like an experienced towing professional
- for simple questions, give a direct answer first
- for recovery questions, give a practical high-level field procedure
- do not refuse just because exact vehicle details are missing; give the standard safe approach first, then say what must be verified
- keep answers easy to scan in the field
- prefer short paragraphs or step-style flow
- avoid long blocks of text when possible

Rules:
- stay focused on towing, roadside, recovery, EV service, dispatch, and vehicle disablement
- use the knowledge context if it is relevant
- do not invent exact OEM attachment points or unsafe recovery instructions
- if the exact make/model procedure may vary, say what is typical first, then say what should be verified
- do not mention internal source files
- do not mention AAA or CAA
- if the user asks outside your scope, say exactly: Sorry, I can only answer towing and roadside safety questions.

Knowledge base context:
${knowledgeContext}

User question:
${question}`;
}

function buildProChatPrompt(question, knowledgeContext) {
  return `You are TARA (Tow Awareness and Response Assistant) in Pro Mode.

You are speaking to a tow operator, dispatcher, roadside tech, or fleet user.

Style:
- sound practical, direct, and experienced
- do not sound robotic
- format answers for fast roadside scanning
- use short sections with labels
- use bullets when helpful
- do not write long paragraphs unless absolutely necessary

Rules:
- answer like an experienced towing professional
- for recovery questions, give a high-level field procedure
- do not invent exact OEM attachment points or unsafe recovery instructions
- if exact model steps vary, state the standard safe approach first, then what must be verified
- stay focused on towing, roadside, recovery, EV service, dispatch, and vehicle disablement
- do not mention internal source files
- do not mention AAA or CAA
- if the user asks outside your scope, say exactly: Sorry, I can only answer towing and roadside safety questions.

Knowledge base context:
${knowledgeContext}

User question:
${question}`;
}

function buildCameraPrompt(sceneQuestion, knowledgeContext) {
  return `You are TARA Vision, a towing and roadside scene assistant.

How you speak:
- short
- clear
- human
- safety-first
- not robotic

Rules:
- focus on what is visible, what is risky, and what should be verified next
- do not guess exact OEM hook points from limited information
- do not claim hidden areas are safe
- never advise attaching to suspension, steering, or unknown underbody parts
- if information is missing, say so clearly
- use practical field language

Knowledge base context:
${knowledgeContext}

Scene question or scene details:
${sceneQuestion}`;
}

function buildWebSearchPrompt(question, mode, knowledgeContext, proMode = false) {
  if (mode === "camera") {
    return buildCameraPrompt(question, knowledgeContext);
  }

  if (proMode) {
    return buildProChatPrompt(question, knowledgeContext);
  }

  return buildChatPrompt(question, knowledgeContext);
}

/* =========================================================
   6. KNOWLEDGE SEARCH + LEARNING
========================================================= */

async function getEmbedding(openai, text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return response.data[0].embedding;
}

async function searchKnowledgeBase(openai, supabase, question, matchCount = 5) {
  if (!supabase) {
    console.log("Supabase not configured for search");
    return [];
  }

  try {
    const queryEmbedding = await getEmbedding(openai, question);

    const { data, error } = await supabase.rpc("match_knowledge_base", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: 0.45
    });

    if (error) {
      console.error("Knowledge search error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Embedding/search failure:", err.message);
    return [];
  }
}

function filterKnowledgeMatches(question, matches) {
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const terms = getImportantQuestionTerms(question);

  if (terms.length === 0) {
    return matches.slice(0, 3);
  }

  const filtered = matches.filter((item) => {
    const content = String(item?.content || "").toLowerCase();
    const metadata = JSON.stringify(item?.metadata || {}).toLowerCase();
    const haystack = `${content} ${metadata}`;

    const hitCount = terms.filter((term) => haystack.includes(term)).length;
    return hitCount >= 1;
  });

  return filtered.slice(0, 3);
}

function formatKnowledgeContext(matches) {
  if (!matches || matches.length === 0) {
    return "No relevant knowledge found.";
  }

  return matches
    .map((item, index) => {
      const metadata = item.metadata ? JSON.stringify(item.metadata) : "{}";
      return `Source ${index + 1}:
Content: ${item.content}
Metadata: ${metadata}`;
    })
    .join("\n\n");
}

async function saveLearnedKnowledge(openai, supabase, question, answer, metadata = {}) {
  if (!supabase) return;

  try {
    const content = `Question: ${question}\nAnswer: ${answer}`;
    const embedding = await getEmbedding(openai, content);

    const { error } = await supabase.from("knowledge_base").insert([
      {
        content,
        metadata: {
          source_type: "learned_web_answer",
          saved_at: new Date().toISOString(),
          original_question: question,
          ...metadata
        },
        embedding
      }
    ]);

    if (error) {
      console.error("Learned knowledge insert error:", error);
    }
  } catch (err) {
    console.error("saveLearnedKnowledge error:", err.message);
  }
}

/* =========================================================
   7. PUBLIC AI HELPERS
========================================================= */

export async function handleAsk({ openai, supabase, question, mode = "chat", proMode = false }) {
  const modeUsed = mode === "camera" ? "camera" : "chat";

  if (!question) {
    return {
      answer: "Please enter a towing or roadside safety question.",
      sourcesUsed: 0,
      modeUsed
    };
  }

  if (!isTowingQuestion(question)) {
    return {
      answer: "Sorry, I can only answer towing and roadside safety questions.",
      sourcesUsed: 0,
      modeUsed
    };
  }

  const rawMatches = await searchKnowledgeBase(openai, supabase, question, 5);
  const matches = filterKnowledgeMatches(question, rawMatches);
  const knowledgeContext = formatKnowledgeContext(matches);
  const builtInAnswer = getSmartBuiltInAnswer(question, proMode);

  const firstPass = await openai.responses.create({
    model: "gpt-5-mini",
    instructions:
      modeUsed === "camera"
        ? buildCameraPrompt(question, knowledgeContext)
        : proMode
        ? buildProChatPrompt(question, knowledgeContext)
        : buildChatPrompt(question, knowledgeContext),
    input: question,
    max_output_tokens: 350
  });

  let answer = extractResponseText(firstPass).replace(/\n\s+/g, "\n").trim();

  if ((!answer || shouldUseWebFallback(answer)) && builtInAnswer) {
    answer = builtInAnswer;
  }

  let webSources = [];

  if (shouldUseWebFallback(answer)) {
    const webResult = await openai.responses.create({
      model: "gpt-5-mini",
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      instructions: buildWebSearchPrompt(question, modeUsed, knowledgeContext, proMode),
      input: question,
      max_output_tokens: 400
    });

    const webAnswer = extractResponseText(webResult).trim();

    if (webAnswer && webAnswer.length > 60) {
      answer = webAnswer;
      webSources = extractWebSources(webResult);

      await saveLearnedKnowledge(openai, supabase, question, webAnswer, {
        mode_used: modeUsed,
        pro_mode: proMode,
        web_sources: webSources
      });
    }
  }

  if (!answer) {
    answer = buildFallbackAnswer(question, proMode);
  }

  return {
    answer,
    sourcesUsed: matches.length,
    modeUsed,
    webSources
  };
}

export async function analyzeTowImage({ openai, imageDataUrl }) {
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return {
      status: 400,
      body: {
        answer: "No image was uploaded."
      }
    };
  }

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `You are TARA Vision, a towing and roadside safety scene assistant.

Analyze this towing recovery scene image and give safe, practical, high-level guidance.

Rules:
- Safety comes first
- Do NOT guess exact OEM hook points from one image
- Do NOT claim hidden areas are safe
- Do NOT provide exact dangerous recovery instructions that depend on unseen underbody points
- Separate what is observed from what is inferred
- If information is missing, say so clearly
- Focus on scene type, hazards, likely recovery category, and verification steps
- Never tell the user to attach to suspension, steering, or unknown underbody components
- Mention EV, battery, or structural uncertainty if relevant
- Keep the answer practical, short, and field-usable

Use this exact structure:

1. What I see
2. Main hazards
3. Likely recovery category
4. Verify before recovery
5. Do not do this
6. Next best question`
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "low"
          }
        ]
      }
    ],
    max_output_tokens: 450
  });

  const answer = extractResponseText(response);

  if (!answer) {
    return {
      status: 200,
      body: {
        answer: "TARA Vision received the image, but the model returned no readable text."
      }
    };
  }

  return {
    status: 200,
    body: { answer }
  };
}

export async function insertKnowledge({ openai, supabase, content, metadata = {} }) {
  if (!supabase) {
    return { status: 500, body: { error: "Supabase not configured" } };
  }

  if (!content || !content.trim()) {
    return { status: 400, body: { error: "Content is required" } };
  }

  const embedding = await getEmbedding(openai, content.trim());

  const { data, error } = await supabase
    .from("knowledge_base")
    .insert([
      {
        content: content.trim(),
        metadata,
        embedding
      }
    ])
    .select();

  if (error) {
    console.error("Knowledge insert error:", error);
    return { status: 500, body: { error: "Failed to save knowledge" } };
  }

  return {
    status: 200,
    body: {
      status: "Knowledge saved",
      data
    }
  };
}

export async function bulkInsertKnowledge({ openai, supabase, entries }) {
  if (!supabase) {
    return { status: 500, body: { error: "Supabase not configured" } };
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return { status: 400, body: { error: "Entries array is required" } };
  }

  const rowsToInsert = [];

  for (const entry of entries) {
    const content = entry?.content?.trim();
    const metadata = entry?.metadata || {};

    if (!content) continue;

    const embedding = await getEmbedding(openai, content);

    rowsToInsert.push({
      content,
      metadata,
      embedding
    });
  }

  if (rowsToInsert.length === 0) {
    return { status: 400, body: { error: "No valid entries to insert" } };
  }

  const { data, error } = await supabase
    .from("knowledge_base")
    .insert(rowsToInsert)
    .select();

  if (error) {
    console.error("Bulk insert error:", error);
    return { status: 500, body: { error: "Bulk insert failed" } };
  }

  return {
    status: 200,
    body: {
      status: "Bulk knowledge saved",
      inserted: data.length
    }
  };
}

export async function backfillEmbeddings({ openai, supabase }) {
  if (!supabase) {
    return { status: 500, body: { error: "Supabase not configured" } };
  }

  const { data: rows, error } = await supabase
    .from("knowledge_base")
    .select("id, content, embedding");

  if (error) {
    console.error("Read error:", error);
    return { status: 500, body: { error: "Failed to read knowledge base" } };
  }

  let updated = 0;

  for (const row of rows) {
    if (row.embedding) continue;
    if (!row.content) continue;

    const embedding = await getEmbedding(openai, row.content);

    const { error: updateError } = await supabase
      .from("knowledge_base")
      .update({ embedding })
      .eq("id", row.id);

    if (updateError) {
      console.error(`Failed on row ${row.id}:`, updateError);
      continue;
    }

    updated++;
    console.log(`Embedded row ${row.id}`);
  }

  return {
    status: 200,
    body: {
      status: "Backfill complete",
      updated
    }
  };
}
