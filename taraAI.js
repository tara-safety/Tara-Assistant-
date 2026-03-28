import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Load local knowledge.json
let localKnowledge = [];

try {
  const filePath = path.join(__dirname, "knowledge.json");
  const raw = fs.readFileSync(filePath, "utf8");
  localKnowledge = JSON.parse(raw);
  console.log(`Loaded ${localKnowledge.length} local knowledge entries`);
} catch (err) {
  console.warn("⚠️ knowledge.json not found or failed to load");
}

import OpenAI from "openai";
import fs from "fs";
import path from "path";

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local knowledge.json
let localKnowledge = [];

try {
  const filePath = path.join(__dirname, "knowledge.json");
  const raw = fs.readFileSync(filePath, "utf8");
  localKnowledge = JSON.parse(raw);
  console.log(`Loaded ${localKnowledge.length} local knowledge entries`);
} catch (err) {
  console.warn("knowledge.json not found or failed to load");
}

/* =========================================================
   0. SIMPLE SESSION MEMORY
========================================================= */
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

  const trimmed = history.slice(-12);
  sessionStore.set(sessionId, trimmed);
}

function clearSessionHistory(sessionId = "default") {
  sessionStore.delete(sessionId);
}

/* =========================================================
   0.1 LOCAL KNOWLEDGE LOADER
========================================================= */

function loadLocalKnowledge() {
  try {
    const filePath = path.join(process.cwd(), "knowledge.json");

    if (!fs.existsSync(filePath)) {
      console.warn("knowledge.json not found for local fallback");
      return [];
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.warn("knowledge.json is not an array");
      return [];
    }

    return parsed;
  } catch (err) {
    console.error("Failed to load local knowledge:", err.message);
    return [];
  }
}

function scoreLocalKnowledgeEntry(question, entry) {
  const q = cleanText(question);

  const title = cleanText(entry?.title || "");
  const keyword = cleanText(entry?.keyword || "");
  const answer = cleanText(entry?.answer || "");
  const rawText = cleanText(entry?.raw_text || "");
  const tags = Array.isArray(entry?.tags)
    ? entry.tags.map((tag) => cleanText(tag)).join(" ")
    : "";

  const haystack = `${title} ${keyword} ${tags} ${answer} ${rawText}`.trim();
  if (!haystack) return 0;

  let score = 0;

  const importantTerms = getImportantQuestionTerms(question);

  for (const term of importantTerms) {
    if (title.includes(term)) score += 5;
    if (keyword.includes(term)) score += 6;
    if (tags.includes(term)) score += 4;
    if (answer.includes(term)) score += 3;
    if (rawText.includes(term)) score += 2;
  }

  if (keyword && q.includes(keyword)) score += 10;
  if (title && q.includes(title)) score += 8;

  if (
    q.includes("parking brake") &&
    haystack.includes("parking brake")
  ) score += 8;

  if (
    q.includes("spare tire") &&
    haystack.includes("spare tire")
  ) score += 8;

  if (
    q.includes("lane keeping") &&
    haystack.includes("lane keeping")
  ) score += 8;

  if (
    q.includes("class 3") &&
    haystack.includes("class 3")
  ) score += 8;

  return score;
}

function searchLocalKnowledge(question, maxResults = 4) {
  const localKnowledge = loadLocalKnowledge();

  if (!Array.isArray(localKnowledge) || localKnowledge.length === 0) {
    return [];
  }

  const ranked = localKnowledge
    .map((entry) => ({
      ...entry,
      local_score: scoreLocalKnowledgeEntry(question, entry)
    }))
    .filter((entry) => entry.local_score > 0)
    .sort((a, b) => b.local_score - a.local_score)
    .slice(0, maxResults);

  return ranked;
}

function formatLocalKnowledgeContext(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "No relevant local knowledge found.";
  }

  return entries
    .map((entry, index) => {
      const tags = Array.isArray(entry.tags) ? entry.tags.join(", ") : "";
      return `Local Source ${index + 1}:
Title: ${entry.title || "Untitled"}
Source ID: ${entry.source_id || "Unknown"}
Category: ${entry.category || "Unknown"}
Tags: ${tags}
Answer: ${entry.answer || ""}
Raw Text: ${entry.raw_text || ""}`;
    })
    .join("\n\n");
}

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

function hasAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
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
    "electric",
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
    "move over",
    "neutral",
    "parking brake",
    "wheel straps",
    "t-hook",
    "soft strap",
    "snatch block",
    "control arm",
    "loading angle",
    "securement",
    "non-roller",
    "doesn't roll",
    "wont roll",
    "won't roll",
    "seized",
    "scrape",
    "low clearance",
    "visibility",
    "hi vis",
    "high vis",
    "lane keeping",
    "class 3",
    "class 2",
    "class 1"
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
   4. BUILT-IN SMART ANSWERS - PRO MODE
========================================================= */

function getSmartBuiltInProAnswer(question) {
  const q = cleanText(question);

  if (isLoadingQuestion(question)) {
    return formatProAnswerFromSections({
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
        "Dollies or skates if the vehicle does not roll"
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
    });
  }

  if (
    isEVQuestion(question) &&
    hasAny(q, ["tow", "towing", "transport", "load", "loading"])
  ) {
    return formatProAnswerFromSections({
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
        "Dollies if the wheels cannot rotate safely"
      ],
      "Do Not Do": [
        "Do not drag drive wheels unless the OEM procedure allows it",
        "Do not hook unknown underbody or battery protection areas"
      ],
      "Critical Risk": [
        "Dragging or incorrect hookup can damage the drivetrain or create system faults"
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
    });
  }

  if (
    q.includes("winch") ||
    q.includes("winching") ||
    q.includes("pull out")
  ) {
    return formatProAnswerFromSections({
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
    });
  }

  if (
    q.includes("rollover") ||
    q.includes("on side") ||
    q.includes("upside down")
  ) {
    return formatProAnswerFromSections({
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
    });
  }

  if (
    q.includes("snow") ||
    q.includes("ice") ||
    q.includes("slippery") ||
    q.includes("stuck in snow") ||
    q.includes("mud")
  ) {
    return formatProAnswerFromSections({
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
    });
  }

  if (
    q.includes("won't roll") ||
    q.includes("wont roll") ||
    q.includes("locked wheel") ||
    q.includes("parking brake stuck") ||
    q.includes("doesn't roll") ||
    q.includes("doesnt roll") ||
    q.includes("non-roller")
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
    q.includes("accident") ||
    q.includes("collision") ||
    q.includes("crash") ||
    q.includes("damaged vehicle")
  ) {
    return formatProAnswerFromSections({
      "Scene Check": [
        "Check for fluid leaks, broken suspension, loose panels, and shifting weight",
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
    isEVQuestion(question) &&
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
      Setup: [
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
      Plan: [
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
    q.includes("which tow method") ||
    q.includes("which method")
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
      Setup: [
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
    });
  }

  if (
    q.includes("equipment") ||
    q.includes("what is the equipment called") ||
    q.includes("equipment names")
  ) {
    return formatProAnswerFromSections({
      "Common Loading Equipment": [
        "Winch line: pulls the casualty onto the deck",
        "J-hook or T-hook: attachment hardware for approved connection points",
        "Soft strap: non-metal attachment option when approved",
        "Wheel straps: transport securement around the tires",
        "Dollies or skates: move vehicles that do not roll freely"
      ],
      "Support Equipment": [
        "Snatch block: changes winch angle or doubles line advantage",
        "Chain: heavy-duty securement or recovery use when appropriate",
        "Control strap: helps manage movement during recovery"
      ],
      "Important Reminder": [
        "The right tool depends on vehicle condition, approved hookup points, and the recovery plan"
      ]
    });
  }

  return "";
}

/* =========================================================
   5. BUILT-IN SMART ANSWERS - NORMAL MODE
========================================================= */

function getSmartBuiltInAnswer(question, proMode = false) {
  if (proMode) {
    return getSmartBuiltInProAnswer(question);
  }

  const q = cleanText(question);

  if (
    isEVQuestion(question) &&
    hasAny(q, ["tow", "towing", "transport", "load", "loading"])
  ) {
    return "Most EVs should be transported on a flatbed because dragging the drive wheels can damage the drivetrain or create system issues. First confirm the exact make, model, drive type, and whether transport mode or tow mode is required before moving it. Do not assume the vehicle will roll freely just because it is powered off, and do not attach to unknown underbody components. If the exact manufacturer procedure is unclear, stop and verify before towing. Follow company policy and local regulations.";
  }

  if (isLoadingQuestion(question)) {
    return "Start by positioning the truck as straight as possible to the casualty vehicle and reducing the loading angle. Use the correct equipment for the setup, such as the winch line, approved hooks or straps, wheel straps, and dollies if the vehicle will not roll. Use approved tow or loading points only, take slack out slowly, and keep the pull straight and controlled while watching bumper, underbody, and transition clearance. Once loaded, use proper 4-point securement minimum and recheck tension after the vehicle settles. Follow company policy and local regulations.";
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

  if (
    q.includes("winch") ||
    q.includes("winching") ||
    q.includes("pull out")
  ) {
    return "Set up for the straightest pull you can, and reduce side-load on the cable, vehicle, and casualty unit as much as possible. Inspect the scene, ground condition, vehicle condition, and likely travel path before loading the line. Keep people clear of the danger zone, remove slack carefully, and use controlled tension instead of shock loading. If the vehicle may bind, shift, or climb unpredictably, stop and reset the plan before continuing. Follow company policy and local regulations.";
  }

  if (
    q.includes("rollover") ||
    q.includes("on side") ||
    q.includes("upside down")
  ) {
    return "Treat rollover work as a high-risk recovery from the start. Control the scene, check for occupant, fuel, battery, cargo, and stability hazards, and make sure the vehicle is not going to shift unexpectedly during setup. Build the recovery plan before applying force, control the roll path, and avoid rushing the lift or rotation. If stabilization, traffic exposure, or attachment strategy is uncertain, stop and reassess before proceeding. Follow company policy and local regulations.";
  }

  if (
    q.includes("snow") ||
    q.includes("ice") ||
    q.includes("slippery") ||
    q.includes("stuck in snow") ||
    q.includes("mud")
  ) {
    return "Start by checking how deep the vehicle is stuck and whether it will roll once it breaks free. Clear the path if needed and confirm where the vehicle will travel once it starts moving. Use a controlled pull and avoid spinning tires or shock loading, which can dig the vehicle in deeper or cause sudden movement. Keep the pull as straight as possible and watch for sideways slide on low traction surfaces. If traction, angle, or control is uncertain, stop and reassess before continuing. Follow company policy and local regulations.";
  }

  if (
    q.includes("soft shoulder") ||
    q.includes("off road") ||
    q.includes("edge of road") ||
    q.includes("soft ground")
  ) {
    return "Check the ground condition first and make sure your truck is not at risk of sinking or sliding toward the ditch. Position for the safest and most stable pull, even if it means taking more time to set up. Avoid driving too close to the edge and watch for collapse under load. Use a controlled, straight pull and avoid sudden jerks that can shift both vehicles. If ground stability or positioning is questionable, stop and reassess before continuing. Follow company policy and local regulations.";
  }

  if (
    q.includes("won't roll") ||
    q.includes("wont roll") ||
    q.includes("locked wheel") ||
    q.includes("parking brake stuck") ||
    q.includes("doesn't roll") ||
    q.includes("doesnt roll") ||
    q.includes("non-roller")
  ) {
    return "Confirm why the vehicle is not rolling before forcing movement. Check for parking brake engagement, seized brakes, transmission lock, or wheel damage. Do not drag the vehicle without understanding the cause, as this can create further damage. Use dollies, skates, or a lift method if the wheels cannot rotate safely. Keep the movement controlled and avoid shock loading the drivetrain or suspension. If the cause of the lock-up is unclear, stop and verify before continuing. Follow company policy and local regulations.";
  }

  if (
    q.includes("accident") ||
    q.includes("collision") ||
    q.includes("crash") ||
    q.includes("damaged vehicle")
  ) {
    return "Treat the vehicle as unstable until proven otherwise. Check for fluid leaks, broken suspension, loose panels, and shifting weight before touching it. Do not assume wheels will roll or steer correctly. Choose the safest loading method, often a flatbed, and control the vehicle during movement to prevent further damage. If anything looks compromised or unpredictable, stop and reassess before continuing. Follow company policy and local regulations.";
  }

  if (
    isEVQuestion(question) &&
    (q.includes("neutral") || q.includes("won't move") || q.includes("wont move"))
  ) {
    return "Confirm the vehicle state first, as many EVs require specific steps to enter transport or tow mode. Do not force movement if the drivetrain is locked. Use dollies or a flatbed if the wheels cannot rotate freely. Avoid dragging the vehicle, as this can damage the drive system or create electrical issues. If the correct procedure is unknown for that model, stop and verify before continuing. Follow company policy and local regulations.";
  }

  if (
    q.includes("tow points") ||
    q.includes("hook points") ||
    q.includes("where do i hook")
  ) {
    return "Do not guess tow points from appearance alone. Confirm approved recovery or tie-down points for that exact vehicle before loading or pulling, and never attach to suspension, steering, battery protection, or unknown underbody parts. Follow company policy and local regulations.";
  }

  if (
    q.includes("equipment") ||
    q.includes("what is the equipment called") ||
    q.includes("equipment names")
  ) {
    return "Common towing and loading equipment includes the winch line, J-hooks or T-hooks for approved connection points, soft straps when appropriate, wheel straps for final securement, dollies or skates for non-rollers, chains for heavy securement or recovery use when appropriate, and snatch blocks for changing line angle or improving pull setup. The right equipment depends on the casualty condition, approved hookup points, and the recovery plan.";
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
    "unclear from the information"
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
  builtInContext = ""
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
- if the user asks outside your scope, say exactly: Sorry, I can only answer towing and roadside safety questions.

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
  builtInContext = ""
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
- if the user asks outside your scope, say exactly: Sorry, I can only answer towing and roadside safety questions.

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
  builtInContext = ""
) {
  if (mode === "camera") {
    return buildCameraPrompt(question, knowledgeContext);
  }

  if (proMode) {
    return buildProChatPrompt(
      question,
      knowledgeContext,
      historyContext,
      builtInContext
    );
  }

  return buildChatPrompt(
    question,
    knowledgeContext,
    historyContext,
    builtInContext
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
      match_threshold: 0.25
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
    return matches.slice(0, 5);
  }

  const filtered = matches.filter((item) => {
    const content = String(item?.content || "").toLowerCase();
    const metadata = JSON.stringify(item?.metadata || {}).toLowerCase();
    const haystack = `${content} ${metadata}`;

    const hitCount = terms.filter((term) => haystack.includes(term)).length;
    return hitCount >= 1;
  });

  return filtered.slice(0, 5);
}

function formatKnowledgeContext(vectorMatches = [], localMatches = []) {
  const parts = [];

  if (Array.isArray(vectorMatches) && vectorMatches.length > 0) {
    parts.push(
      vectorMatches
        .map((item, index) => {
          const metadata = item.metadata ? JSON.stringify(item.metadata) : "{}";
          return `Vector Source ${index + 1}:
Content: ${item.content}
Metadata: ${metadata}`;
        })
        .join("\n\n")
    );
  }

  if (Array.isArray(localMatches) && localMatches.length > 0) {
    parts.push(formatLocalKnowledgeContext(localMatches));
  }

  if (parts.length === 0) {
    return "No relevant knowledge found.";
  }

  return parts.join("\n\n");
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

  if (!isTowingQuestion(normalizedQuestion) && !hasHistory) {
    return {
      answer: "Sorry, I can only answer towing and roadside safety questions.",
      sourcesUsed: 0,
      modeUsed,
      webSources: []
    };
  }

  let vectorMatches = [];
let localMatches = [];
let knowledgeContext = "";

// 1. ALWAYS search local knowledge first
localMatches = searchLocalKnowledge(normalizedQuestion, 4);

// 2. Search Supabase too if enabled
if (useStoredKnowledge) {
  const rawMatches = await searchKnowledgeBase(
    openai,
    supabase,
    normalizedQuestion,
    8
  );

  vectorMatches = filterKnowledgeMatches(normalizedQuestion, rawMatches);
}

// 3. Build combined context, preferring local brain content
knowledgeContext = formatKnowledgeContext(vectorMatches, localMatches);

// 4. Final fallback
if (!knowledgeContext || knowledgeContext.trim() === "") {
  knowledgeContext = "No relevant knowledge found.";
}

  const historyContext = useChatMemory
    ? buildHistoryContext(history)
    : "Conversation memory is currently disabled.";

  const builtInAnswer = getSmartBuiltInAnswer(normalizedQuestion, proMode);
  const builtInContext = builtInAnswer || "No built-in guidance available.";

  let answer = "";
  let webSources = [];

  try {
    const firstPass = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        modeUsed === "camera"
          ? buildCameraPrompt(normalizedQuestion, knowledgeContext)
          : proMode
            ? buildProChatPrompt(
                normalizedQuestion,
                knowledgeContext,
                historyContext,
                builtInContext
              )
            : buildChatPrompt(
                normalizedQuestion,
                knowledgeContext,
                historyContext,
                builtInContext
              ),
      input: `
Previous conversation:
${historyContext}

Current question:
${normalizedQuestion}

Built-in towing guidance:
${builtInContext}

Knowledge context:
${knowledgeContext}
`,
      max_output_tokens: 500
    });

    answer = extractResponseText(firstPass).replace(/\n\s+/g, "\n").trim();

    if (shouldUseWebFallback(answer)) {
      const webResult = await openai.responses.create({
        model: "gpt-5-mini",
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        instructions: buildWebSearchPrompt(
          normalizedQuestion,
          modeUsed,
          knowledgeContext,
          proMode,
          historyContext,
          builtInContext
        ),
        input: `
Previous conversation:
${historyContext}

Current question:
${normalizedQuestion}

Built-in towing guidance:
${builtInContext}

Knowledge context:
${knowledgeContext}
`,
        max_output_tokens: 550
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
              web_sources: webSources
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
      answer =
        `${bestLocal.title ? bestLocal.title + "\n\n" : ""}` +
        `${bestLocal.answer || bestLocal.raw_text || ""}` +
        `${bestLocal.source_id ? `\n\nSource: ${bestLocal.source_id}` : ""}`;
    } else if (builtInAnswer) {
      answer = builtInAnswer;
    } else {
      answer = buildFallbackAnswer(normalizedQuestion, proMode);
    }
  }

  if (useChatMemory) {
    saveSessionMessage(sessionId, "user", normalizedQuestion);
    saveSessionMessage(sessionId, "assistant", answer);
  }

  return {
    answer,
    sourcesUsed: vectorMatches.length + localMatches.length,
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
