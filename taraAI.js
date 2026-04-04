import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   0. SIMPLE SESSION MEMORY
========================================================= */

const sessionStore = new Map();

function getSessionHistory(sessionId = "default", maxTurns = 8) {
  const history = sessionStore.get(sessionId) || [];
  return history.slice(-maxTurns);
}

function saveSessionMessage(sessionId = "default", role, content) {
  if (!sessionId || !role || !content) return;

  const history = sessionStore.get(sessionId) || [];
  history.push({
    role,
    content: String(content).trim()
  });

  sessionStore.set(sessionId, history.slice(-12));
}

function clearSessionHistory(sessionId = "default") {
  sessionStore.delete(sessionId);
}

/* =========================================================
   0.1 LOCAL KNOWLEDGE LOADER
========================================================= */

function shortenKnowledgeText(text = "", max = 280) {
  const clean = String(text || "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "";
  if (clean.length <= max) return clean;

  return clean.slice(0, max).trim() + "...";
}

function safeDisplayAnswer(entry = {}, fallbackMax = 280) {
  const answer = String(entry?.answer || "").trim();
  const rawText = String(entry?.raw_text || "").trim();

  if (answer) return shortenKnowledgeText(answer, fallbackMax);
  if (rawText) return shortenKnowledgeText(rawText, fallbackMax);

  return "";
}

function normalizeAdvancedKnowledge(records = []) {
  if (!Array.isArray(records)) return [];

  return records
    .map((record) => {
      if (!record || typeof record !== "object") return null;

      const tags = [
        ...(Array.isArray(record.tags) ? record.tags : []),
        ...(Array.isArray(record.topics) ? record.topics : []),
        ...(Array.isArray(record.industry_terms) ? record.industry_terms : []),
        ...(Array.isArray(record.search_phrases) ? record.search_phrases : []),
        ...(Array.isArray(record.aliases) ? record.aliases : []),
        ...(Array.isArray(record.job_types) ? record.job_types : []),
        ...(Array.isArray(record.vehicle_scope) ? record.vehicle_scope : []),
        ...(Array.isArray(record.scene_type) ? record.scene_type : []),
        ...(Array.isArray(record.region) ? record.region : [])
      ].filter(Boolean);

      let question = "";
      let answer = "";
      let rawText = "";
      let title = String(record.title || record.id || "").trim();

      switch (record.record_type) {
        case "qa":
          question = String(record.question || "").trim();
          answer = shortenKnowledgeText(record.answer || "", 280);
          rawText = String(record.answer || "").trim();
          break;

        case "concept":
          question = title ? `What is ${title}?` : "";
          answer = shortenKnowledgeText(record.definition || "", 220);
          rawText = [
            `Definition: ${record.definition || ""}`,
            Array.isArray(record.aliases) && record.aliases.length
              ? `Aliases: ${record.aliases.join(", ")}`
              : "",
            Array.isArray(record.related_concepts) && record.related_concepts.length
              ? `Related concepts: ${record.related_concepts.join(", ")}`
              : ""
          ]
            .filter(Boolean)
            .join("\n");
          break;

        case "decision_rule":
          question = title || "What should TARA do in this situation?";
          answer = shortenKnowledgeText(record.then_action || "", 240);
          rawText = [
            Array.isArray(record.if_signals) && record.if_signals.length
              ? `If signals: ${record.if_signals.join("; ")}`
              : "",
            `Then action: ${record.then_action || ""}`,
            Array.isArray(record.exceptions) && record.exceptions.length
              ? `Exceptions: ${record.exceptions.join("; ")}`
              : ""
          ]
            .filter(Boolean)
            .join("\n");
          break;

        case "source":
          answer = shortenKnowledgeText(record.summary || "", 260);
          rawText = String(record.raw_text || "").trim();
          break;

        case "chunk":
          answer = shortenKnowledgeText(
            record.chunk_summary || record.chunk_text || "",
            260
          );
          rawText = String(record.chunk_text || "").trim();
          break;

        case "public_fact":
          question = title || "";
          answer = shortenKnowledgeText(record.fact_text || "", 220);
          rawText = [
            `Fact: ${record.fact_text || ""}`,
            record.source_name ? `Source name: ${record.source_name}` : "",
            record.source_url ? `Source URL: ${record.source_url}` : ""
          ]
            .filter(Boolean)
            .join("\n");
          break;

        default:
          return null;
      }

      return {
        source_file: record.id || "",
        keyword: [
          title,
          question,
          ...(Array.isArray(record.aliases) ? record.aliases : []),
          ...(Array.isArray(record.search_phrases) ? record.search_phrases : [])
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),
        meta_id: record.meta_id || record.id || "",
        source_id: record.source_id || record.id || "",
        title,
        category: record.category || "",
        subcategory: record.subcategory || "",
        tags: [...new Set(tags)],
        question,
        answer,
        raw_text: rawText
      };
    })
    .filter(Boolean)
    .filter((entry) => entry.answer || entry.raw_text || entry.question);
}

function loadLocalKnowledge() {
  try {
    const filePath = path.join(process.cwd(), "knowledge.json");

    if (!fs.existsSync(filePath)) {
      console.warn("knowledge.json not found for local fallback");
      return [];
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map((entry) => ({
        ...entry,
        title: String(entry?.title || "").trim(),
        question: String(entry?.question || "").trim(),
        answer: shortenKnowledgeText(entry?.answer || "", 280),
        raw_text: String(entry?.raw_text || "").trim(),
        tags: Array.isArray(entry?.tags) ? entry.tags.filter(Boolean) : []
      }));
    }

    if (parsed && Array.isArray(parsed.records)) {
      return normalizeAdvancedKnowledge(parsed.records);
    }

    console.warn("knowledge.json format not recognized");
    return [];
  } catch (err) {
    console.error("Failed to load local knowledge:", err.message);
    return [];
  }
}

function formatLocalKnowledgeContext(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "No relevant local knowledge found.";
  }

  return entries
    .slice(0, 2)
    .map((entry, index) => {
      return `Local Source ${index + 1}:
Title: ${entry?.title || "Untitled"}
Category: ${entry?.category || "Unknown"}
Guidance: ${safeDisplayAnswer(entry, 220)}`;
    })
    .join("\n\n");
}

function getDeterministicLocalAnswer(question) {
  const localKnowledge = loadLocalKnowledge();
  if (!Array.isArray(localKnowledge) || localKnowledge.length === 0) {
    return null;
  }

  const qClean = cleanText(question);
  const intent = detectQuestionIntent(question);

  const exactQuestionMatch = localKnowledge.find((entry) => {
    const entryQuestion = cleanText(entry?.question || "");
    return entryQuestion && entryQuestion === qClean;
  });

  if (exactQuestionMatch) {
    if (intent === "rule" || String(exactQuestionMatch.meta_id || "").includes("RULE")) {
      return {
        answer: formatRuleAnswer(exactQuestionMatch),
        matchedEntry: exactQuestionMatch,
        matchType: "exact_question_rule"
      };
    }

    return {
      answer: safeDisplayAnswer(exactQuestionMatch, 240),
      matchedEntry: exactQuestionMatch,
      matchType: "exact_question"
    };
  }

  if (intent === "definition") {
    const exactConcept = localKnowledge.find((entry) => {
      const entryQuestion = cleanText(entry?.question || "");
      const entryTitle = cleanText(entry?.title || "");
      const metaId = String(entry?.meta_id || "");

      return (
        metaId.includes("CONCEPT") &&
        (
          (entryQuestion && entryQuestion === qClean) ||
          (entryTitle && qClean.includes(entryTitle))
        )
      );
    });

    if (exactConcept) {
      return {
        answer: formatConceptAnswer
          ? formatConceptAnswer(exactConcept)
          : safeDisplayAnswer(exactConcept, 220),
        matchedEntry: exactConcept,
        matchType: "exact_concept"
      };
    }
  }

  if (intent === "rule") {
    const exactRule = localKnowledge.find((entry) => {
      const entryQuestion = cleanText(entry?.question || "");
      const metaId = String(entry?.meta_id || "");

      return metaId.includes("RULE") && entryQuestion && entryQuestion === qClean;
    });

    if (exactRule) {
      return {
        answer: formatRuleAnswer(exactRule),
        matchedEntry: exactRule,
        matchType: "exact_rule"
      };
    }
  }

  return null;
}


/* =========================================================
   1. TEXT + INTENT HELPERS
========================================================= */

function cleanText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/ğ/g, "g")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
}

function cleanDriverFacingAnswer(text = "") {
  let clean = String(text || "")
    .replace(/\r/g, "")

    // Remove structured metadata
    .replace(/\bDirect:\s*/gim, "")
    .replace(/\bTitle:\s.*$/gim, "")
    .replace(/\bSource:\s.*$/gim, "")
    .replace(/\bMETA_ID:\s.*$/gim, "")
    .replace(/\bSOURCE_ID:\s.*$/gim, "")
    .replace(/\bCHUNK_TYPE:\s.*$/gim, "")
    .replace(/\bCATEGORY:\s.*$/gim, "")
    .replace(/\bSUBCATEGORY:\s.*$/gim, "")
    .replace(/\bTOPICS:\s.*$/gim, "")
    .replace(/\bSEARCH_TAGS:\s.*$/gim, "")
    .replace(/\bREGION:\s.*$/gim, "")
    .replace(/\bINDUSTRY:\s.*$/gim, "")
    .replace(/\bSOURCE_TYPE:\s.*$/gim, "")
    .replace(/\bLANGUAGE:\s.*$/gim, "")
    .replace(/\bRELIABILITY:\s.*$/gim, "")
    .replace(/\bLAST_REVIEWED:\s.*$/gim, "")

    // Remove section headers
    .replace(/\bSUMMARY:\s*/gim, "")
    .replace(/\bCORE_MESSAGE:\s*/gim, "")
    .replace(/\bTHE_FORGOTTEN_STEP:\s*/gim, "")
    .replace(/\bHOW_THE_RISK_DEVELOPS:\s*/gim, "")
    .replace(/\bCRITICAL_HAZARD:\s*/gim, "")
    .replace(/\bREAL_WORLD_CONSEQUENCE:\s*/gim, "")
    .replace(/\bLOSS_OF_PROTECTION_CONCEPT:\s*/gim, "")
    .replace(/\bHIGH_RISK_SCENARIOS:\s*/gim, "")
    .replace(/\bBEST_PRACTICES:\s*/gim, "")
    .replace(/\bSAFE_POSITIONING_RULE:\s*/gim, "")
    .replace(/\bTARA_RESPONSE_GUIDANCE:\s*/gim, "")
    .replace(/\bCOMMON_USER_QUESTION:\s*/gim, "")
    .replace(/\bSAFETY_MESSAGE:\s*/gim, "")

    // Remove knowledge wrappers
    .replace(/\bRaw Text:\s*/gim, "")
    .replace(/\bLocal Source\s+\d+:\s*/gim, "")
    .replace(/\bVector Source\s+\d+:\s*/gim, "")
    .replace(/\bQuestion:\s*/gim, "")
    .replace(/\bQUESTION:\s*/gim, "")
    .replace(/\bAnswer:\s*/gim, "")
    .replace(/\bANSWER:\s*/gim, "")
    .replace(/\bKeywords:\s*/gim, "")
    .replace(/\bKEYWORDS:\s*/gim, "")
    .replace(/\bTags:\s*/gim, "")

    // 🔥 Remove leading question-style lines
    .replace(/^why .*?\?\s*/i, "")
    .replace(/^what .*?\?\s*/i, "")
    .replace(/^how .*?\?\s*/i, "")

    // 🔥 Remove trailing keyword/tag lines (comma-separated junk)
    .replace(/\n?[a-z0-9\s]+,\s*[a-z0-9\s,]+$/i, "")

    // Cleanup spacing
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return clean;
}

function isTowingQuestion(question) {
  const q = cleanText(question);
  if (!q) return false;

  const negativePatterns = [
    /\btoward\b/,
    /\btowing the line\b/
  ];

  if (negativePatterns.some((rx) => rx.test(q))) {
    return false;
  }

  const strongPatterns = [
    /\btow\b/,
    /\btow truck\b/,
    /\btowing\b/,
    /\bwrecker\b/,
    /\brecovery\b/,
    /\broadside\b/,
    /\bwheel[\s-]?lift\b/,
    /\bflatbed\b/,
    /\brollback\b/,
    /\bdeck truck\b/,
    /\bunder[\s-]?lift\b/,
    /\bunder[\s-]?reach\b/,
    /\bstinger\b/,
    /\brotator\b/,
    /\bwinch\b/,
    /\bwinch line\b/,
    /\bnon[\s-]?roller\b/,
    /\bmanual[\s-]?park release\b/,
    /\bemergency[\s-]?park release\b/,
    /\bshift[\s-]?lock(?: release)?\b/,
    /\belectronic parking brake\b/,
    /\bditch pull\b/,
    /\brollover\b/,
    /\bshoulder recovery\b/,
    /\btraffic incident management\b/,
    /\blockout\b/,
    /\bimpound\b/,
    /\bnon[\s-]?consent tow\b/,
    /\bjump[\s-]?start\b/,
    /\btow mode\b/,
    /\btransport mode\b/,
    /\btow points?\b/,
    /\btire service\b/,
    /\bwork zone\b/,
    /\bspare tire\b/,
    /\bflat tire\b/,
    /\btire change\b/,
    /\broadside tire\b/
  ];

  const mediumPatterns = [
    /\bcarrier\b/,
    /\boperator\b/,
    /\bdispatch(?:er)?\b/,
    /\bdisabled vehicle\b/,
    /\bcasualty vehicle\b/,
    /\bwheel straps?\b/,
    /\bj[\s-]?hook\b/,
    /\bt[\s-]?hook\b/,
    /\br[\s-]?hook\b/,
    /\bl[\s-]?arms?\b/,
    /\bbridle\b/,
    /\bsnatch block\b/,
    /\bsoft strap\b/,
    /\bsoft shackle\b/,
    /\bdolly\b/,
    /\bwheel skates?\b/,
    /\btire skates?\b/,
    /\bfree[\s-]?roll\b/,
    /\bneutral hold\b/,
    /\bstay[\s-]?in[\s-]?neutral\b/,
    /\bpark lock\b/,
    /\bpark pawl\b/,
    /\bdriveline\b/,
    /\bdriveshaft\b/,
    /\bblocker vehicle\b/,
    /\bshadow vehicle\b/,
    /\bquick clearance\b/,
    /\bprivate property impound\b/,
    /\btraffic control\b/,
    /\bmove over\b/,
    /\bhigh vis\b/,
    /\bhi vis\b/,
    /\btesla\b/,
    /\bev\b/,
    /\belectric vehicle\b/,
    /\bhybrid\b/,
    /\bservice truck\b/
  ];

  const weakPatterns = [
    /\bvehicle\b/,
    /\btransport\b/,
    /\bload(?:ing)?\b/,
    /\bpull\b/,
    /\bdrag\b/,
    /\bstrap\b/,
    /\bchain\b/,
    /\bbattery\b/,
    /\b12v\b/,
    /\belectric\b/,
    /\bjack\b/,
    /\blug nut\b/,
    /\btraffic\b/,
    /\bhighway\b/,
    /\bcones?\b/,
    /\bpylons?\b/,
    /\bvisibility\b/
  ];

  if (strongPatterns.some((rx) => rx.test(q))) {
    return true;
  }

  let score = 0;

  for (const rx of mediumPatterns) {
    if (rx.test(q)) score += 2;
  }

  for (const rx of weakPatterns) {
    if (rx.test(q)) score += 1;
  }

  return score >= 3;
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

function isSpareTireWorkZoneQuestion(question) {
  const q = cleanText(question);

  return (
    (q.includes("spare tire") || q.includes("flat tire")) &&
    (
      q.includes("after install") ||
      q.includes("after installation") ||
      q.includes("what do i do") ||
      q.includes("work zone") ||
      q.includes("inflate")
    )
  );
}

function isEVQuestion(question) {
  const q = cleanText(question);
  return (
    q.includes("ev") ||
    q.includes("electric") ||
    q.includes("electric vehicle") ||
    q.includes("tesla") ||
    q.includes("hybrid") ||
    q.includes("plug in") ||
    q.includes("battery electric")
  );
}

function isLoadingQuestion(question) {
  const q = cleanText(question);
  return hasAny(q, [
    "load",
    "loading",
    "flatbed",
    "rollback",
    "deck",
    "wheel straps",
    "securement",
    "tie down",
    "tie-down"
  ]);
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
          "them",
          "they",
          "just",
          "then",
          "than"
        ].includes(word)
    );
}

function detectQuestionIntent(question) {
  const q = cleanText(question);

  if (
    q.startsWith("what is ") ||
    q.startsWith("what's ") ||
    q.startsWith("define ") ||
    q.includes("meaning of") ||
    q.includes("what does") ||
    q.includes("what is a ") ||
    q.includes("what is an ")
  ) {
    return "definition";
  }

  if (
    q.startsWith("when should") ||
    q.startsWith("when do i") ||
    q.startsWith("when do we") ||
    q.includes("should a vehicle be treated as") ||
    q.includes("when should a vehicle be") ||
    q.includes("when do you treat") ||
    q.includes("when must") ||
    q.includes("when is it a")
  ) {
    return "rule";
  }

  if (
    q.startsWith("how do i") ||
    q.startsWith("how should i") ||
    q.startsWith("how to ") ||
    q.includes("what should i do") ||
    q.includes("procedure") ||
    q.includes("steps")
  ) {
    return "procedure";
  }

  if (
    q.includes("risk") ||
    q.includes("danger") ||
    q.includes("hazard") ||
    q.includes("safe") ||
    q.includes("safest") ||
    q.includes("warning")
  ) {
    return "safety_warning";
  }

  return "general";
}

function classifyTowingQuestion(question) {
  const q = cleanText(question);

  const categoryMap = {
    vehicleCondition: [
      "non-roller",
      "won't roll",
      "wont roll",
      "shift lock release",
      "manual park release",
      "emergency park release",
      "electronic parking brake",
      "park lock",
      "park pawl",
      "neutral",
      "free roll",
      "tow mode",
      "transport mode",
      "driveline",
      "driveshaft",
      "battery",
      "12v",
      "ev",
      "hybrid",
      "tesla",
      "dead battery",
      "low voltage",
      "stuck in park",
      "locked in park"
    ],
    securementAndRigging: [
      "j-hook",
      "t-hook",
      "r-hook",
      "soft strap",
      "soft shackle",
      "bridle",
      "snatch block",
      "wheel straps",
      "securement",
      "chain",
      "strap",
      "winch",
      "winch line",
      "anchor point",
      "recovery strap",
      "rigging"
    ],
    loadingAndAttachment: [
      "flatbed",
      "rollback",
      "wheel lift",
      "underlift",
      "underreach",
      "tow points",
      "hookup",
      "hook up",
      "load",
      "loading",
      "pull",
      "drag",
      "fork",
      "frame fork",
      "axle fork",
      "crossbar",
      "l-arm",
      "l-arms"
    ],
    roadsideScene: [
      "highway",
      "traffic",
      "move over",
      "ditch",
      "rollover",
      "pylons",
      "cones",
      "blocker vehicle",
      "shadow vehicle",
      "quick clearance",
      "buffer zone",
      "traffic control",
      "lane closure",
      "lane block",
      "upstream",
      "downstream",
      "shoulder",
      "roadside",
      "scene safety",
      "live lane"
    ],
    equipmentAndTerms: [
      "underlift",
      "underreach",
      "stinger",
      "wheel lift",
      "rotator",
      "wrecker",
      "blocker vehicle",
      "tim",
      "non-consent tow",
      "ppi"
    ],
    plainLanguageRoadside: [
      "tow truck",
      "tow",
      "towing",
      "recovery",
      "recover",
      "disabled car",
      "disable car",
      "disabled vehicle",
      "broken down car",
      "broken down vehicle",
      "broke down",
      "stranded car",
      "stranded vehicle",
      "service truck",
      "service call",
      "road call",
      "pick up a car",
      "picking up a car",
      "picking up a vehicle",
      "pick up a vehicle",
      "pick up disabled car",
      "pickup disabled car",
      "flat tire",
      "spare tire",
      "tire change",
      "dead car",
      "car on the highway",
      "vehicle on the highway",
      "motorist"
    ]
  };

  const matchedCategories = [];
  const matchedTerms = [];

  for (const [category, terms] of Object.entries(categoryMap)) {
    const found = terms.filter((term) => q.includes(cleanText(term)));
    if (found.length > 0) {
      matchedCategories.push(category);
      matchedTerms.push(...found);
    }
  }

  const isTowing =
    matchedCategories.length > 0 ||
    (
      (q.includes("highway") || q.includes("roadside") || q.includes("shoulder")) &&
      (
        q.includes("car") ||
        q.includes("vehicle") ||
        q.includes("truck") ||
        q.includes("motorist")
      )
    ) ||
    (
      (q.includes("flat") || q.includes("spare") || q.includes("tire")) &&
      (
        q.includes("install") ||
        q.includes("change") ||
        q.includes("roadside")
      )
    );

  let intent = "general";

  if (
    q.startsWith("what is ") ||
    q.startsWith("what does ") ||
    q.includes("definition") ||
    q.includes("what does this mean") ||
    q.includes("meaning of")
  ) {
    intent = "definition";
  } else if (
    q.includes("what should i do") ||
    q.includes("what do i do") ||
    q.includes("should i") ||
    q.includes("can i") ||
    q.includes("is it safe") ||
    q.includes("is this safe") ||
    q.includes("watch for") ||
    q.includes("when should i") ||
    q.includes("how should i") ||
    q.includes("best way") ||
    q.includes("safe way")
  ) {
    intent = "rule";
  }

  return {
    isTowing,
    matchedCategories,
    matchedTerms: [...new Set(matchedTerms)],
    intent
  };
}

function formatRuleAnswer(entry) {
  const answer = String(entry?.answer || "").trim();
  const raw = String(entry?.raw_text || "").trim();

  const ifSignalsMatch = raw.match(/If signals:\s*([\s\S]*?)(?:Then action:|$)/i);
  const thenActionMatch = raw.match(/Then action:\s*([\s\S]*?)(?:Exception:|Exceptions:|$)/i);
  const exceptionsMatch = raw.match(/Exceptions?:\s*([\s\S]*)$/i);

  const bullets = ifSignalsMatch
    ? ifSignalsMatch[1]
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const thenAction = thenActionMatch ? thenActionMatch[1].trim() : answer;

  const exceptions = exceptionsMatch
    ? exceptionsMatch[1]
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const parts = [];

  if (bullets.length > 0) {
    parts.push("Treat it as a non-roller when:");
    parts.push(bullets.map((b) => `- ${b}`).join("\n"));
  } else if (answer) {
    parts.push(answer);
  }

  if (thenAction && thenAction !== answer) {
    parts.push(thenAction);
  }

  if (exceptions.length > 0) {
    parts.push("Exception:");
    parts.push(exceptions.map((e) => `- ${e}`).join("\n"));
  }

  return parts.join("\n\n").trim() || answer;
}

function formatConceptAnswer(entry) {
  const title = String(entry?.title || "").trim();
  const raw = String(entry?.answer || entry?.raw_text || "").trim();

  if (!raw) {
    return title
      ? `${title} is a towing safety concept.`
      : "This is a towing safety concept.";
  }

  const clean = raw
    .replace(/\r/g, "")
    .replace(/^question:\s*/gim, "")
    .replace(/^answer:\s*/gim, "")
    .replace(/^definition:\s*/gim, "")
    .replace(/^summary:\s*/gim, "")
    .replace(/^guidance:\s*/gim, "")
    .replace(/^what is .*?\?\s*/i, "")
    .replace(/^why .*?\?\s*/i, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  let first = clean.split(/(?<=[.!?])\s+/)[0]?.trim() || clean;

  if (first.length > 180) {
    const cut = first.slice(0, 180);
    const lastSpace = cut.lastIndexOf(" ");
    first = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim() + "...";
  }

  if (title && !first.toLowerCase().startsWith(title.toLowerCase())) {
    return `${title}: ${first}`;
  }

  return first;
}

function formatShortLocalAnswer(entry) {
  const cleanBlock = (text = "") =>
    String(text || "")
      .replace(/\r/g, "")
      .replace(/^question:\s*/gim, "")
      .replace(/^answer:\s*/gim, "")
      .replace(/^summary:\s*/gim, "")
      .replace(/^guidance:\s*/gim, "")
      .replace(/^title:\s*/gim, "")
      .replace(/^tags:\s*/gim, "")
      .replace(/^keywords?:\s*/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const shorten = (text = "", max = 220) => {
    const clean = cleanBlock(text).replace(/\s+/g, " ").trim();
    if (!clean) return "";
    if (clean.length <= max) return clean;

    const clipped = clean.slice(0, max);
    const lastSentence = clipped.lastIndexOf(". ");
    if (lastSentence > 80) {
      return clipped.slice(0, lastSentence + 1).trim();
    }

    const lastSpace = clipped.lastIndexOf(" ");
    return (lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim() + "...";
  };

  const answer = shorten(entry?.answer || "", 220);
  if (answer) return answer;

  const raw = String(entry?.raw_text || "").trim();
  if (!raw) {
    return "Use normal roadside safety steps: protect the scene, watch traffic, and avoid unsafe positioning.";
  }

  const answerMatch = raw.match(/ANSWER:\s*([\s\S]*?)(?:\n[A-Z_]+:|$)/i);
  if (answerMatch?.[1]) {
    return shorten(answerMatch[1], 220);
  }

  const summaryMatch = raw.match(/SUMMARY:\s*([\s\S]*?)(?:\n[A-Z_]+:|$)/i);
  if (summaryMatch?.[1]) {
    return shorten(summaryMatch[1], 220);
  }

  const definitionMatch = raw.match(/DEFINITION:\s*([\s\S]*?)(?:\n[A-Z_]+:|$)/i);
  if (definitionMatch?.[1]) {
    return shorten(definitionMatch[1], 200);
  }

  const firstParagraph = raw.split(/\n\s*\n/)[0]?.trim() || "";
  return shorten(firstParagraph, 200);
}

function scoreLocalKnowledgeEntry(question, entry) {
  const q = cleanText(question);

  const title = cleanText(entry?.title || "");
  const keyword = cleanText(entry?.keyword || "");
  const answer = cleanText(entry?.answer || "");
  const questionText = cleanText(entry?.question || "");
  const rawText = cleanText(entry?.raw_text || "");
  const category = cleanText(entry?.category || "");
  const subcategory = cleanText(entry?.subcategory || "");
  const metaId = String(entry?.meta_id || "").trim();
  const tags = Array.isArray(entry?.tags)
    ? entry.tags.map((tag) => cleanText(tag)).join(" ")
    : "";

  const haystack = `${title} ${keyword} ${tags} ${questionText} ${answer} ${rawText}`.trim();
  if (!haystack) return 0;

  let score = 0;
  const importantTerms = getImportantQuestionTerms(question);
  const classification = classifyTowingQuestion(question);

  // HARD WIN: exact question match
  if (entry?.question) {
    const qClean = cleanText(question);
    const entryQ = cleanText(entry.question);

    if (qClean === entryQ) return 1000;
  }

  // Strong boost for question containment
  if (entry?.question && q.includes(cleanText(entry.question))) {
    score += 50;
  }

  for (const term of importantTerms) {
    if (title.includes(term)) score += 5;
    if (keyword.includes(term)) score += 6;
    if (tags.includes(term)) score += 4;
    if (questionText.includes(term)) score += 8;
    if (answer.includes(term)) score += 3;
    if (rawText.includes(term)) score += 2;
  }

  for (const matchedTerm of classification.matchedTerms) {
    const term = cleanText(matchedTerm);
    if (title.includes(term)) score += 5;
    if (keyword.includes(term)) score += 6;
    if (tags.includes(term)) score += 5;
    if (questionText.includes(term)) score += 7;
    if (answer.includes(term)) score += 4;
    if (rawText.includes(term)) score += 2;
  }

  if (keyword && q.includes(keyword)) score += 10;
  if (title && q.includes(title)) score += 8;
  if (questionText && q.includes(questionText)) score += 8;

  // Intent boosts
  if (classification.intent === "rule") {
    if (metaId.includes("RULE")) score += 40;
    if (category.includes("vehicle handling")) score += 15;
    if (subcategory.includes("neutral")) score += 15;
  }

  if (classification.intent === "definition") {
    if (metaId.includes("CONCEPT")) score += 35;
    if (questionText.startsWith("what is")) score += 20;
  }

  if (classification.intent === "safety_warning") {
    if (category.includes("roadside safety")) score += 15;
    if (category.includes("ppe")) score += 10;
    if (category.includes("roadside operations")) score += 10;
  }

  if (q.includes("parking brake") && haystack.includes("parking brake")) {
    score += 8;
  }

  if (q.includes("spare tire") && haystack.includes("spare tire")) {
    score += 8;
  }

  if (q.includes("lane keeping") && haystack.includes("lane keeping")) {
    score += 8;
  }

  if (q.includes("class 3") && haystack.includes("class 3")) {
    score += 8;
  }

  if (
    (q.includes("non-roller") || q.includes("non roller")) &&
    (haystack.includes("non-roller") || haystack.includes("non roller"))
  ) {
    score += 20;
  }

  if (
    (q.includes("underlift") || q.includes("underreach") || q.includes("stinger")) &&
    (haystack.includes("underlift") || haystack.includes("underreach") || haystack.includes("stinger"))
  ) {
    score += 15;
  }

  if (
    (q.includes("blocker vehicle") || q.includes("shadow vehicle")) &&
    (haystack.includes("blocker vehicle") || haystack.includes("shadow vehicle"))
  ) {
    score += 15;
  }

  return score;
}

function searchLocalKnowledge(question, maxResults = 4) {
  const localKnowledge = loadLocalKnowledge();

  if (!Array.isArray(localKnowledge) || localKnowledge.length === 0) {
    return [];
  }

  return localKnowledge
    .map((entry) => ({
      ...entry,
      local_score: scoreLocalKnowledgeEntry(question, entry)
    }))
    .filter((entry) => entry.local_score > 0)
    .sort((a, b) => b.local_score - a.local_score)
    .slice(0, maxResults);
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

  return sources.slice(0, 3);
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

function shouldUseWebFallback(answer) {
  if (!answer) return true;

  const a = cleanText(answer);

  if (a.length < 80) return true;

  const weakPhrases = [
    "i don t have a strong answer",
    "i dont have a strong answer",
    "i m not sure",
    "i am not sure",
    "not certain",
    "may vary",
    "depends on the model",
    "depends on trim",
    "check the owner",
    "check the manual",
    "not enough information",
    "unclear from the information",
    "tara can t answer this",
    "tara cant answer this"
  ];

  return weakPhrases.some((phrase) => a.includes(phrase));
}

/* =========================================================
   6. PROMPTS
========================================================= */

function buildHistoryContext(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return "No recent conversation history.";
  }

  return history
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");
}

function buildChatPrompt(
  question,
  knowledgeContext,
  historyContext = "",
  builtInContext = "",
  intent = "general"
) {
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
- keep answers short and practical for roadside use
- give the direct answer first
- keep most regular-mode answers to 2 short paragraphs maximum
- only add extra context if it clearly improves safety

Rules:
- stay focused on towing, roadside, recovery, EV service, dispatch, loading, securement, and vehicle disablement
- use the knowledge context if it is relevant
- use recent conversation context if relevant
- use the built-in towing guidance if useful
- when stored knowledge includes Safety Buzz style material, prioritize it for roadside safety answers
- combine the best relevant points instead of copying one chunk
- do not invent exact OEM attachment points or unsafe recovery instructions
- if the exact make/model procedure may vary, say what is typical first, then say what should be verified
- do not mention internal source files
- do not mention AAA or CAA
- never show internal labels like source id, meta id, chunk type, file names, or database references
- never repeat labels such as Question, Answer, Keywords, Tags, Guidance, or Raw Text
- respond as a direct assistant answer, not as a document extract
- if the user asks outside your scope, say exactly: Sorry, I can only answer towing and roadside safety questions.
- if the best knowledge is a rule, present it as a decision rule with short bullets
- if the user is asking for a definition, answer in one direct definition first
- if the user is asking for a rule, answer with when/if conditions first
- detected intent: ${intent}

Recent conversation:
${historyContext}

Built-in towing guidance:
${builtInContext || "No built-in guidance provided."}

Knowledge base context:
${knowledgeContext}

User question:
${question}`;
}

function buildProChatPrompt(
  question,
  knowledgeContext,
  historyContext = "",
  builtInContext = "",
  intent = "general"
) {
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
- for recovery and loading questions, give a high-level field procedure
- include equipment names when useful
- use the knowledge context and built-in guidance if relevant
- combine the strongest matching safety points when multiple sources agree
- do not invent exact OEM attachment points or unsafe recovery instructions
- if exact model steps vary, state the standard safe approach first, then what must be verified
- stay focused on towing, roadside, recovery, EV service, dispatch, loading, securement, and vehicle disablement
- use recent conversation context if relevant
- do not mention internal source files
- do not mention AAA or CAA
- never show internal labels like source id, meta id, chunk type, file names, or database references
- never repeat labels such as Question, Answer, Keywords, Tags, Guidance, or Raw Text
- respond as a direct assistant answer, not as a document extract
- if the user asks outside your scope, say exactly: Sorry, I can only answer towing and roadside safety questions.
- if the best knowledge is a rule, present it as a decision rule with bullets
- if the user is asking for a definition, start with the direct definition
- detected intent: ${intent}

Recent conversation:
${historyContext}

Built-in towing guidance:
${builtInContext || "No built-in guidance provided."}

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
- do not advise attaching to suspension, steering, or unknown underbody parts
- if information is missing, say so clearly
- use practical field language

Knowledge base context:
${knowledgeContext}

Scene question or scene details:
${sceneQuestion}`;
}

function buildWebSearchPrompt(
  question,
  mode,
  knowledgeContext,
  proMode = false,
  historyContext = "",
  builtInContext = "",
  intent = "general"
) {
  if (mode === "camera") {
    return buildCameraPrompt(question, knowledgeContext);
  }

  if (proMode) {
    return buildProChatPrompt(
      question,
      knowledgeContext,
      historyContext,
      builtInContext,
      intent
    );
  }

  return buildChatPrompt(
    question,
    knowledgeContext,
    historyContext,
    builtInContext,
    intent
  );
}

/* =========================================================
   7. KNOWLEDGE SEARCH + LEARNING
========================================================= */

async function getEmbedding(openai, text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return response.data[0].embedding;
}

async function searchKnowledgeBase(openai, supabase, question, matchCount = 8) {
  if (!supabase) {
    console.log("Supabase not configured for search");
    return [];
  }

  try {
    const queryEmbedding = await getEmbedding(openai, question);

    const { data, error } = await supabase.rpc("match_knowledge_base", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: 0.22
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
  const classification = classifyTowingQuestion(question);

  return matches
    .map((item) => {
      const content = cleanText(item?.content || "");
      const metadataObj = item?.metadata || {};
      const metadataText = cleanText(JSON.stringify(metadataObj));
      const haystack = `${content} ${metadataText}`;

      const hitCount = terms.filter((term) => haystack.includes(term)).length;
      const classificationHits = classification.matchedTerms.filter((term) =>
        haystack.includes(cleanText(term))
      ).length;

      const similarity =
        Number(item?.similarity ?? item?.score ?? item?.match_score ?? 0) || 0;

      let rankScore = similarity * 10 + hitCount + classificationHits * 1.5;

      if (classification.intent === "rule" && metadataObj?.meta_id?.includes("RULE")) {
        rankScore += 25;
      }

      if (
        classification.intent === "definition" &&
        metadataObj?.meta_id?.includes("CONCEPT")
      ) {
        rankScore += 20;
      }

      return {
        ...item,
        hitCount,
        classificationHits,
        similarity,
        rankScore
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 5);
}

function formatKnowledgeContext(vectorMatches = [], localMatches = []) {
  const parts = [];

  if (vectorMatches.length > 0) {
    const cleaned = vectorMatches
      .map((item, i) => {
        const metadata = item?.metadata || {};
        const tags = Array.isArray(metadata?.tags) ? metadata.tags.join(", ") : "";
        const guidance = String(metadata?.answer || item?.content || "").trim();

        return `Vector Source ${i + 1}:
Title: ${metadata?.title || "Untitled"}
Category: ${metadata?.category || "Unknown"}
Tags: ${tags}
Guidance: ${guidance}`;
      })
      .join("\n\n");

    parts.push(cleaned);
  }

  if (localMatches.length > 0) {
    parts.push(formatLocalKnowledgeContext(localMatches));
  }

  return parts.length > 0
    ? parts.join("\n\n")
    : "No relevant knowledge found.";
}

function formatVectorKnowledgeFallback(match, intent = "general") {
  if (!match) return "";

  const metadata = match?.metadata || {};
  const answer = String(metadata?.answer || "").trim();
  const content = String(match?.content || "").trim();

  if (intent === "rule" && metadata?.meta_id?.includes("RULE")) {
    return formatRuleAnswer({
      answer,
      raw_text: String(metadata?.raw_text || content || "").trim()
    });
  }

  return answer || content || "";
}

async function saveLearnedKnowledge(
  openai,
  supabase,
  question,
  answer,
  metadata = {}
) {
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

function enforceMobileReply(answer = "") {
  let text = String(answer || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\*\*/g, "")
    .trim();

  const lines = text.split("\n").filter(Boolean);

  if (lines.length > 12) {
    text = lines.slice(0, 12).join("\n").trim();
  }

  if (text.length > 650) {
    text = text.slice(0, 650).trim();
  }

  return text;
}

function formatCompactKnowledgeContext(vectorMatches = [], localMatches = []) {
  const combined = [];

  for (const item of localMatches.slice(0, 2)) {
    combined.push({
      title: item?.title || "Local knowledge",
      category: item?.category || "General",
      answer: String(item?.answer || item?.raw_text || "").slice(0, 220)
    });
  }

  for (const item of vectorMatches.slice(0, 2)) {
    combined.push({
      title: item?.metadata?.title || "Stored knowledge",
      category: item?.metadata?.category || "General",
      answer: String(item?.metadata?.answer || item?.content || "").slice(0, 220)
    });
  }

  if (combined.length === 0) {
    return "No relevant knowledge found.";
  }

  return combined
    .map((item, index) => {
      return `Source ${index + 1}
Title: ${item.title}
Category: ${item.category}
Key point: ${item.answer}`;
    })
    .join("\n\n");
}

function buildResponseStyleRules(intent = "general") {
  return `
You are TARA Safety, a towing and roadside safety assistant.

Answer like an experienced roadside operator giving field guidance.

STRICT RULES:
- Keep the total answer under 120 words.
- Start with the direct answer immediately.
- Then give "What to do:" with 3 to 5 short steps.
- End with one short "Why:" line.
- Use plain mobile-friendly wording.
- Do not lecture.
- Do not repeat.
- Do not paste source text.
- Do not quote long bulletins.
- Do not use more than 1 short warning line.
- If the situation is high risk, say "High risk:" clearly.
- Stay only on towing, recovery, roadside, vehicle, and operator safety.

If intent is "${intent}", tailor the answer to that intent but still keep it short.
`;
}

/* =========================================================
   3. SHARED ANSWER FORMATTERS
========================================================= */

function formatProAnswerFromSections(titleMap = {}) {
  const sections = [];

  for (const [title, items] of Object.entries(titleMap)) {
    if (Array.isArray(items) && items.length > 0) {
      sections.push(`${title}:\n${toBullets(items)}`);
    }
  }

  return sections.join("\n\n").trim();
}

function formatNormalAnswerFromSections(titleMap = {}) {
  const ordered = Object.entries(titleMap).filter(
    ([, items]) => Array.isArray(items) && items.length > 0
  );

  if (ordered.length === 0) return "";

  const firstSectionItems = ordered[0][1] || [];
  const secondSectionItems = ordered[1]?.[1] || [];
  const thirdSectionItems = ordered[2]?.[1] || [];

  const direct = firstSectionItems[0] || secondSectionItems[0] || "";
  const steps = [...firstSectionItems.slice(1), ...secondSectionItems].slice(0, 3);
  const why = thirdSectionItems[0] || "";

  const parts = [];

  if (direct) {
    parts.push(direct);
  }

  if (steps.length > 0) {
    parts.push(`What to do:\n${toBullets(steps)}`);
  }

  if (why) {
    parts.push(`Why:\n- ${why}`);
  }

  return parts.join("\n\n").trim();
}

/* =========================================================
   4. SHARED BUILT-IN SMART ANSWER SECTIONS
========================================================= */

function getSmartBuiltInSections(question) {
  const q = cleanText(question);

  if (isLoadingQuestion(question)) {
    return {
      "Scene Setup": [
        "Position the truck as straight as possible to the casualty vehicle",
        "Check traffic exposure, ground stability, and loading angle",
        "Lower the bed fully and reduce the angle before starting the pull"
      ],
      "Common Equipment": [
        "Winch line",
        "J-hooks or T-hooks when appropriate for the vehicle",
        "Soft straps when approved for the setup",
        "Wheel straps for final securement",
        "Dollies or skates only if the vehicle does not roll"
      ],
      Hookup: [
        "Use approved tow or loading points only",
        "Never attach to suspension, steering, brake lines, or unknown underbody components",
        "Take slack out slowly and confirm the hookup is tracking straight"
      ],
      Loading: [
        "Keep the pull straight and controlled",
        "Watch bumper, underbody, exhaust, air dams, and transition points",
        "Stop immediately if the vehicle starts to scrape, shift, bind, or climb poorly"
      ],
      Securement: [
        "Use a proper 4-point securement minimum for transport",
        "Secure each wheel correctly and evenly",
        "Recheck strap tension after the vehicle settles on the deck"
      ],
      "Final Check": [
        "Confirm the casualty is stable before transport",
        "Check for loose parts, hanging damage, and clearance issues"
      ]
    };
  }

  if (
    isEVQuestion(question) &&
    hasAny(q, ["tow", "towing", "transport", "load", "loading"])
  ) {
    return {
      "Best Practice": [
        "Use a flatbed whenever possible for EV towing and transport"
      ],
      "Check First": [
        "Confirm make, model, and drive type",
        "Check whether transport mode or tow mode is required",
        "Confirm whether the vehicle will free-roll before moving it"
      ],
      Equipment: [
        "Flatbed",
        "Wheel straps",
        "Dollies only if the wheels cannot rotate safely"
      ],
      "Do Not Do": [
        "Do not drag drive wheels unless the OEM procedure allows it",
        "Do not hook unknown underbody or battery protection areas"
      ],
      "Critical Risk": [
        "Dragging or incorrect hookup can damage the drivetrain or create system faults"
      ]
    };
  }

  if (isLockoutQuestion(question)) {
    return {
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
    };
  }

  if (
    q.includes("flat tire") ||
    q.includes("spare tire") ||
    q.includes("flat after install") ||
    q.includes("spare is flat") ||
    q.includes("install a flat tire")
  ) {
    return {
      "Immediate Priority": [
        "Treat it as a traffic-exposure issue first",
        "Stay in the protected work zone if possible",
        "Do not reposition the truck unless absolutely necessary"
      ],
      "What To Do": [
        "Check whether the tire can be inflated from the safer side",
        "Work from behind the truck when possible",
        "Keep visual awareness of traffic and escape space"
      ],
      Why: [
        "Repositioning the truck can remove your buffer zone and increase exposure to traffic"
      ]
    };
  }

  if (
    q.includes("ditch") ||
    q.includes("nose first") ||
    q.includes("rear first") ||
    q.includes("stuck in ditch")
  ) {
    return {
      "Scene Check": [
        "Check traffic exposure",
        "Check shoulder stability, ditch depth, slope, and ground condition",
        "Check vehicle angle and risk of rollover"
      ],
      Stabilize: [
        "Stabilize the vehicle if there is any chance of shifting or rolling",
        "Confirm where the customer should safely stand or wait"
      ],
      "Recovery Plan": [
        "Use the straightest and least-shocking pull possible",
        "Avoid side-loading and sudden jerks",
        "Plan where the vehicle will travel once it reaches the shoulder"
      ],
      Equipment: [
        "Winch line",
        "Recovery straps",
        "Snatch block if the angle requires a cleaner pull",
        "Wheel-lift assist, dollies, or flatbed as needed for the finish"
      ],
      "Stop If": [
        "Stop and reassess if the angle, anchor point, or vehicle condition is uncertain"
      ]
    };
  }

  if (q.includes("winch") || q.includes("winching") || q.includes("pull out")) {
    return {
      Setup: [
        "Align for the straightest pull possible",
        "Inspect the line, hook point, and path of travel before tension"
      ],
      Equipment: [
        "Winch line",
        "Appropriate hook point or approved strap",
        "Snatch block if needed for angle correction"
      ],
      Operation: [
        "Take slack slowly",
        "Use controlled tension instead of shock loading",
        "Watch for bind, climb, or sudden shift"
      ],
      Safety: [
        "Keep people out of the line of pull and danger zone",
        "Stop if the casualty starts moving unpredictably"
      ]
    };
  }

  if (
    q.includes("rollover") ||
    q.includes("on side") ||
    q.includes("upside down")
  ) {
    return {
      "Scene Check": [
        "Treat rollover work as high risk from the start",
        "Check for occupant, fuel, battery, cargo, and stability hazards"
      ],
      Setup: [
        "Build the recovery plan before applying force",
        "Control the roll path and vehicle movement"
      ],
      "Do Not Do": [
        "Do not rush the lift or rotation",
        "Do not apply force before stabilization is understood"
      ],
      "Stop If": [
        "Stop and reassess if stabilization, exposure, or attachment strategy is uncertain"
      ]
    };
  }

  if (
    q.includes("snow") ||
    q.includes("ice") ||
    q.includes("slippery") ||
    q.includes("stuck in snow") ||
    q.includes("mud")
  ) {
    return {
      "Scene Check": [
        "Check depth of sink and available traction",
        "Confirm the path the vehicle will take once it breaks free"
      ],
      Setup: [
        "Keep the pull as straight as possible",
        "Use controlled movement instead of shock loading"
      ],
      "Watch For": [
        "Watch for sideways slide on ice",
        "Be ready for quick release once traction returns"
      ],
      "Do Not Do": [
        "Do not spin tires deeper into snow or mud",
        "Do not use sudden jerks if control is poor"
      ]
    };
  }

  if (
    q.includes("soft shoulder") ||
    q.includes("off road") ||
    q.includes("edge of road") ||
    q.includes("soft ground")
  ) {
    return {
      "Truck Position": [
        "Make sure your truck is not at risk of sinking or sliding",
        "Avoid loading the edge of the shoulder"
      ],
      Setup: [
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
    };
  }

  if (
    q.includes("won't roll") ||
    q.includes("wont roll") ||
    q.includes("locked wheel") ||
    q.includes("parking brake stuck") ||
    q.includes("doesn't roll") ||
    q.includes("doesnt roll") ||
    q.includes("non-roller") ||
    q.includes("stuck in park")
  ) {
    return {
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
    };
  }

  if (
    q.includes("accident") ||
    q.includes("collision") ||
    q.includes("crash") ||
    q.includes("damaged vehicle")
  ) {
    return {
      "Scene Check": [
        "Check for fluid leaks, broken suspension, loose panels, and shifting weight",
        "Treat the vehicle as unstable until proven otherwise"
      ],
      "Best Practice": ["Use the safest loading method, often a flatbed"],
      "Watch For": ["Do not assume wheels will roll or steer correctly"],
      "Stop If": [
        "Stop and reassess if anything looks compromised or unpredictable"
      ]
    };
  }

  if (
    isEVQuestion(question) &&
    (q.includes("neutral") || q.includes("won't move") || q.includes("wont move"))
  ) {
    return {
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
    };
  }

  if (
    q.includes("underground") ||
    q.includes("parking garage") ||
    q.includes("low clearance")
  ) {
    return {
      "Check First": [
        "Check height clearance, ramp angle, and turning space"
      ],
      Setup: ["Use low-clearance equipment", "Plan your exit path before loading"],
      "Watch For": [
        "Watch ceiling height, body clearance, and ramp transitions"
      ],
      "Stop If": [
        "Stop and reassess if space or angle is too tight for safe operation"
      ]
    };
  }

  if (
    q.includes("tight space") ||
    q.includes("tight area") ||
    q.includes("narrow") ||
    q.includes("confined")
  ) {
    return {
      Plan: ["Slow the operation down and plan every movement first"],
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
    };
  }

  if (
    q.includes("broken suspension") ||
    q.includes("wheel collapsed") ||
    q.includes("wheel bent") ||
    q.includes("control arm")
  ) {
    return {
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
    };
  }

  if (
    q.includes("high centered") ||
    q.includes("on curb") ||
    q.includes("stuck on curb") ||
    q.includes("bottomed out")
  ) {
    return {
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
    };
  }

  if (
    q.includes("wheel lift") ||
    q.includes("flatbed or wheel lift") ||
    q.includes("which tow method") ||
    q.includes("which method")
  ) {
    return {
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
      "Final Check": ["Default to the safest method if unsure"]
    };
  }

  if (
    q.includes("steep driveway") ||
    q.includes("steep angle") ||
    q.includes("incline") ||
    q.includes("hill recovery")
  ) {
    return {
      "Check First": ["Check slope and how weight will shift during movement"],
      Setup: [
        "Use the straightest path possible",
        "Control rollback and sudden movement"
      ],
      "Watch For": ["Watch side load and traction loss"],
      "Stop If": ["Stop and reassess if traction or control is uncertain"]
    };
  }

  if (
    q.includes("frozen brakes") ||
    q.includes("seized") ||
    q.includes("wheel stuck")
  ) {
    return {
      "Check First": [
        "Confirm the cause of wheel lock before forcing movement"
      ],
      "Best Practice": [
        "Use dollies or lift methods if wheels cannot rotate"
      ],
      "Do Not Do": ["Do not drag the vehicle with locked wheels"],
      "Stop If": ["Stop and reassess if the condition cannot be safely managed"]
    };
  }

  if (
    q.includes("highway") ||
    q.includes("live traffic") ||
    q.includes("shoulder recovery")
  ) {
    return {
      "First Priority": ["Traffic control and visibility"],
      Setup: [
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
    };
  }

  if (
    q.includes("equipment") ||
    q.includes("what is the equipment called") ||
    q.includes("equipment names") ||
    q.includes("underlift") ||
    q.includes("underreach") ||
    q.includes("stinger") ||
    q.includes("blocker vehicle") ||
    q.includes("shadow vehicle")
  ) {
    return {
      "Common Equipment": [
        "Winch line: pulls the casualty onto the deck",
        "J-hook or T-hook: attachment hardware for approved connection points",
        "Soft strap: non-metal attachment option when approved",
        "Wheel straps: transport securement around the tires",
        "Dollies or skates: move vehicles that do not roll freely",
        "Underlift or underreach: rear lift system used to raise and tow a casualty vehicle",
        "Blocker vehicle: a protective vehicle positioned to create a buffer from traffic"
      ],
      "Support Equipment": [
        "Snatch block: changes winch angle or doubles line advantage",
        "Chain: heavy-duty securement or recovery use when appropriate",
        "Control strap: helps manage movement during recovery"
      ],
      "Important Reminder": [
        "The right tool depends on vehicle condition, approved hookup points, and the recovery plan"
      ]
    };
  }

  return null;
}

/* =========================================================
   5. BUILT-IN SMART ANSWERS
========================================================= */

function getSmartBuiltInAnswer(question, proMode = false) {
  const sections = getSmartBuiltInSections(question);

  if (!sections) return "";

  return proMode
    ? formatProAnswerFromSections(sections)
    : formatNormalAnswerFromSections(sections);
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

  return formatNormalAnswerFromSections({
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

/* =========================================================
   8. PUBLIC AI HELPERS
========================================================= */

export async function handleAsk({
  openai,
  supabase,
  question,
  mode = "chat",
  proMode = false,
  sessionId = "default",
  featureFlags = {}
}) {
  const normalizedQuestion = String(question || "").trim();
  const modeUsed = mode === "camera" ? "camera" : "chat";

  const useStoredKnowledge = featureFlags.useStoredKnowledge === true;
  const useChatMemory = featureFlags.useChatMemory !== false;
  const useLearningLog = featureFlags.useLearningLog === true;

  if (!normalizedQuestion) {
    return {
      answer: "Please enter a towing or roadside safety question.",
      sourcesUsed: 0,
      modeUsed,
      webSources: []
    };
  }

  const history = useChatMemory ? getSessionHistory(sessionId, 8) : [];
  const hasHistory = history.length > 0;
  const classification = classifyTowingQuestion(normalizedQuestion);
  const intent = classification.intent || "general";

  if (!classification.isTowing && !hasHistory) {
    return {
      answer: "Sorry, I can only answer towing and roadside safety questions.",
      sourcesUsed: 0,
      modeUsed,
      webSources: []
    };
  }

  const deterministicLocal = getDeterministicLocalAnswer(normalizedQuestion);
  if (deterministicLocal?.answer) {
    const answer = enforceMobileReply(
      cleanDriverFacingAnswer(deterministicLocal.answer)
    );

    if (useChatMemory) {
      saveSessionMessage(sessionId, "user", normalizedQuestion);
      saveSessionMessage(sessionId, "assistant", answer);
    }

    console.log("DETERMINISTIC LOCAL MATCH:", {
      matchType: deterministicLocal.matchType,
      meta_id: deterministicLocal?.matchedEntry?.meta_id || null,
      title: deterministicLocal?.matchedEntry?.title || null
    });

    return {
      answer,
      sourcesUsed: 1,
      modeUsed,
      webSources: [],
      intent
    };
  }

  let vectorMatches = [];
  let localMatches = [];
  let knowledgeContext = "No relevant knowledge found.";

  if (intent === "definition" || intent === "rule") {
    localMatches = searchLocalKnowledge(normalizedQuestion, 4);
  } else if (useStoredKnowledge) {
    const rawMatches = await searchKnowledgeBase(
      openai,
      supabase,
      normalizedQuestion,
      8
    );

    console.log(
      "RAW SUPABASE MATCHES:",
      (rawMatches || []).map((item) => ({
        similarity: item?.similarity ?? item?.score ?? item?.match_score ?? null,
        title: item?.metadata?.title || null,
        source_id: item?.metadata?.source_id || null,
        preview: String(
          item?.metadata?.answer || item?.content || ""
        ).slice(0, 120)
      }))
    );

    vectorMatches = filterKnowledgeMatches(normalizedQuestion, rawMatches);

    console.log(
      "FILTERED MATCHES:",
      (vectorMatches || []).map((item) => ({
        similarity: item?.similarity ?? item?.score ?? item?.match_score ?? null,
        hitCount: item?.hitCount ?? null,
        classificationHits: item?.classificationHits ?? null,
        title: item?.metadata?.title || null
      }))
    );

    if (vectorMatches.length === 0) {
      localMatches = searchLocalKnowledge(normalizedQuestion, 4);
    }
  } else {
    localMatches = searchLocalKnowledge(normalizedQuestion, 4);
  }

  knowledgeContext = formatCompactKnowledgeContext(vectorMatches, localMatches);

  if (!knowledgeContext || !knowledgeContext.trim()) {
    knowledgeContext = "No relevant knowledge found.";
  }

  const historyContext = useChatMemory
    ? buildHistoryContext(history.slice(-4))
    : "Conversation memory is currently disabled.";

  const builtInAnswer = getSmartBuiltInAnswer(normalizedQuestion, proMode);
  const builtInContext = builtInAnswer
    ? String(builtInAnswer).slice(0, 220)
    : "No built-in guidance available.";

  let answer = "";
  let webSources = [];

  try {
    const firstPass = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        buildResponseStyleRules(intent) +
        "\n\n" +
        (
          modeUsed === "camera"
            ? buildCameraPrompt(normalizedQuestion, knowledgeContext)
            : proMode
              ? buildProChatPrompt(
                  normalizedQuestion,
                  knowledgeContext,
                  historyContext,
                  builtInContext,
                  intent
                )
              : buildChatPrompt(
                  normalizedQuestion,
                  knowledgeContext,
                  historyContext,
                  builtInContext,
                  intent
                )
        ),
      input: `
Previous conversation:
${historyContext}

Current question:
${normalizedQuestion}

Detected intent:
${intent}

Built-in towing guidance:
${builtInContext}

Knowledge context:
${knowledgeContext}
`,
      max_output_tokens: 220
    });

    answer = extractResponseText(firstPass).replace(/\n\s+/g, "\n").trim();

    if (intent === "definition" || intent === "rule") {
      answer = "";
    }

    console.log("FIRST PASS ANSWER:", answer.slice(0, 300));

    if (shouldUseWebFallback(answer)) {
      const webResult = await openai.responses.create({
        model: "gpt-5-mini",
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        instructions: buildResponseStyleRules(intent) + "\n\n" + buildWebSearchPrompt(
          normalizedQuestion,
          modeUsed,
          knowledgeContext,
          proMode,
          historyContext,
          builtInContext,
          intent
        ),
        input: `
Previous conversation:
${historyContext}

Question:
${normalizedQuestion}

Detected intent:
${intent}

Built-in towing guidance:
${builtInContext}

Relevant knowledge:
${knowledgeContext}
`,
        max_output_tokens: 260
      });

      const webAnswer = extractResponseText(webResult).trim();

      if (webAnswer && webAnswer.length > 60) {
        answer = webAnswer;
        webSources = extractWebSources(webResult);

        if (useStoredKnowledge && useLearningLog) {
          await saveLearnedKnowledge(
            openai,
            supabase,
            normalizedQuestion,
            webAnswer,
            {
              mode_used: modeUsed,
              pro_mode: proMode,
              web_sources: webSources,
              intent
            }
          );
        }
      }
    }
  } catch (err) {
    console.error("handleAsk AI error:", err.message);
  }

  if (!answer || shouldUseWebFallback(answer)) {
    if (localMatches.length > 0) {
      const bestLocal = localMatches[0];

      if (intent === "rule" && String(bestLocal?.meta_id || "").includes("RULE")) {
        answer = formatRuleAnswer(bestLocal);
      } else if (
        intent === "definition" &&
        String(bestLocal?.meta_id || "").includes("CONCEPT")
      ) {
        answer = formatConceptAnswer(bestLocal);
      } else {
        answer = formatShortLocalAnswer(bestLocal);
      }
    } else if (vectorMatches.length > 0) {
      answer = formatVectorKnowledgeFallback(vectorMatches[0], intent);
    } else if (builtInAnswer) {
      answer = builtInAnswer;
    } else {
      answer = buildFallbackAnswer(normalizedQuestion, proMode);
    }
  }

  answer = enforceMobileReply(cleanDriverFacingAnswer(answer));

  if (useChatMemory) {
    saveSessionMessage(sessionId, "user", normalizedQuestion);
    saveSessionMessage(sessionId, "assistant", answer);
  }

  return {
    answer,
    sourcesUsed: vectorMatches.length + localMatches.length,
    modeUsed,
    webSources,
    intent
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
        answer:
          "TARA Vision received the image, but the model returned no readable text."
      }
    };
  }

  return {
    status: 200,
    body: { answer }
  };
}

export async function insertKnowledge({
  openai,
  supabase,
  content,
  metadata = {}
}) {
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

export { clearSessionHistory };
