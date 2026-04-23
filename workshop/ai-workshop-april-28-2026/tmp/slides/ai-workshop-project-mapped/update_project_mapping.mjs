import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1280;
const H = 720;

const INPUT_PPTX = "C:\\Users\\anantha.shayana\\Downloads\\AI_Workshop_Interactive_Showcase.pptx";
const OUT_DIR = "C:\\Axiom\\Axiom\\workshop\\ai-workshop-april-28-2026\\outputs\\ai-workshop-project-mapped";
const SCRATCH_DIR = "C:\\Axiom\\Axiom\\workshop\\ai-workshop-april-28-2026\\tmp\\slides\\ai-workshop-project-mapped";
const PREVIEW_DIR = path.join(SCRATCH_DIR, "preview");
const VERIFY_DIR = path.join(SCRATCH_DIR, "verification");
const OUT_PPTX = path.join(OUT_DIR, "AI_Workshop_Project_Mapped_Showcase.pptx");
const APPENDIX_PPTX = path.join(OUT_DIR, "AI_Workshop_Project_Mapping_Appendix.pptx");
const INSPECT_PATH = path.join(VERIFY_DIR, "inspect-text.json");

const COLORS = {
  ink: "#111827",
  ink2: "#243041",
  muted: "#64748B",
  faint: "#E5E7EB",
  paper: "#F7F8F5",
  white: "#FFFFFF",
  teal: "#10A37F",
  tealDark: "#0B6B57",
  blue: "#2563EB",
  gold: "#D69E2E",
  coral: "#E76F51",
  purple: "#7C3AED",
  green: "#22A06B",
  cyan: "#0891B2",
  red: "#DC2626",
  slate: "#334155",
  transparent: "#00000000",
};

const FONT = {
  title: "Poppins",
  body: "Lato",
  mono: "Aptos Mono",
};

function stroke(fill = COLORS.transparent, width = 0, style = "solid") {
  return { style, fill, width };
}

function addShape(slide, geometry, x, y, w, h, fill = COLORS.transparent, border = COLORS.transparent, borderWidth = 0, opts = {}) {
  return slide.shapes.add({
    geometry,
    position: {
      left: x,
      top: y,
      width: w,
      height: h,
      rotation: opts.rotation || 0,
    },
    fill,
    line: stroke(border, borderWidth, opts.lineStyle || "solid"),
  });
}

function addText(slide, text, x, y, w, h, opts = {}) {
  const shape = addShape(
    slide,
    opts.geometry || "rect",
    x,
    y,
    w,
    h,
    opts.fill || COLORS.transparent,
    opts.border || COLORS.transparent,
    opts.borderWidth || 0,
  );
  shape.text = Array.isArray(text) ? text : String(text);
  shape.text.fontSize = opts.size || 18;
  shape.text.color = opts.color || COLORS.ink;
  shape.text.bold = Boolean(opts.bold);
  shape.text.typeface = opts.face || FONT.body;
  shape.text.alignment = opts.align || "left";
  shape.text.verticalAlignment = opts.valign || "top";
  shape.text.insets = opts.insets || { left: 0, right: 0, top: 0, bottom: 0 };
  if (opts.autoFit) shape.text.autoFit = opts.autoFit;
  return shape;
}

function addTopNav(slide, active) {
  const items = [
    ["HOME", COLORS.muted],
    ["FOUNDATIONS", COLORS.muted],
    ["DEMOS", COLORS.muted],
    ["STACK", COLORS.muted],
    ["GOVERNANCE", COLORS.muted],
    ["ROADMAP", COLORS.muted],
    ["PROJECT MAP", COLORS.teal],
  ];
  let x = 70;
  for (const [label, color] of items) {
    const width = label === "PROJECT MAP" ? 126 : label.length * 9 + 28;
    const fill = label === active ? color : COLORS.transparent;
    const textColor = label === active ? COLORS.white : COLORS.muted;
    addShape(slide, "roundRect", x, 28, width, 28, fill, label === active ? fill : COLORS.faint, 1);
    addText(slide, label, x + 10, 35, width - 20, 12, {
      size: 9.5,
      color: textColor,
      bold: true,
      face: FONT.mono,
      align: "center",
      valign: "middle",
      autoFit: "shrinkText",
    });
    x += width + 10;
  }
}

function addFooter(slide, label, slideNo) {
  addText(slide, `${label}  -  ${String(slideNo).padStart(2, "0")} / 24`, 70, 654, 420, 22, {
    size: 11,
    color: COLORS.muted,
    bold: true,
    face: FONT.mono,
  });
  addShape(slide, "rect", 70, 638, 1140, 1.2, "#CBD5E1");
}

function createSlide(presentation, slideNo, label = "PROJECT MAP") {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.paper;
  addShape(slide, "ellipse", -100, -120, 320, 320, "#E9F7F2", COLORS.transparent, 0);
  addShape(slide, "ellipse", 1090, 500, 260, 260, "#F7EED8", COLORS.transparent, 0);
  addTopNav(slide, "PROJECT MAP");
  addFooter(slide, label, slideNo);
  return slide;
}

function addTitle(slide, title, subtitle, opts = {}) {
  addText(slide, title, 70, 82, opts.w || 820, opts.h || 58, {
    size: opts.size || 35,
    color: COLORS.ink,
    bold: true,
    face: FONT.title,
    autoFit: "shrinkText",
  });
  addText(slide, subtitle, 72, 142, opts.subW || 860, opts.subH || 42, {
    size: opts.subSize || 16,
    color: COLORS.ink2,
    face: FONT.body,
    autoFit: "shrinkText",
  });
}

function addPill(slide, text, x, y, w, h, color, opts = {}) {
  addShape(slide, "roundRect", x, y, w, h, color, color, 1);
  addText(slide, text, x + 12, y + Math.max(5, (h - 14) / 2), w - 24, h - 10, {
    size: opts.size || 11,
    color: COLORS.white,
    bold: true,
    face: opts.face || FONT.mono,
    align: "center",
    valign: "middle",
    autoFit: "shrinkText",
  });
}

function addCard(slide, x, y, w, h, title, body, color, opts = {}) {
  addShape(slide, "roundRect", x, y, w, h, COLORS.white, "#DDE5EE", 1.2);
  addShape(slide, "rect", x, y, w, 7, color, color, 0);
  addText(slide, title, x + 18, y + 20, w - 36, 26, {
    size: opts.titleSize || 16,
    color: color,
    bold: true,
    face: FONT.title,
    autoFit: "shrinkText",
  });
  addText(slide, body, x + 18, y + 54, w - 36, h - 66, {
    size: opts.bodySize || 12.8,
    color: COLORS.ink2,
    face: FONT.body,
    autoFit: "shrinkText",
  });
}

function addMiniCard(slide, x, y, w, h, title, bullets, color) {
  addShape(slide, "roundRect", x, y, w, h, COLORS.white, "#D7E0EA", 1);
  addPill(slide, title, x + 14, y + 14, Math.min(w - 28, title.length * 8 + 42), 28, color, { size: 10 });
  const body = bullets.map((item) => `- ${item}`).join("\n");
  addText(slide, body, x + 18, y + 58, w - 36, h - 70, {
    size: 12,
    color: COLORS.ink2,
    face: FONT.body,
    autoFit: "shrinkText",
  });
}

function addFlowNode(slide, x, y, w, h, label, detail, color) {
  addShape(slide, "roundRect", x, y, w, h, COLORS.white, "#D7E0EA", 1.2);
  addShape(slide, "ellipse", x + 14, y + 18, 28, 28, color, color, 0);
  addText(slide, label, x + 52, y + 16, w - 64, 22, {
    size: 13.5,
    color,
    bold: true,
    face: FONT.title,
    autoFit: "shrinkText",
  });
  addText(slide, detail, x + 18, y + 52, w - 36, h - 64, {
    size: 11.2,
    color: COLORS.ink2,
    face: FONT.body,
    autoFit: "shrinkText",
  });
}

function addArrow(slide, x1, y1, x2, y2, color = COLORS.muted) {
  const width = Math.max(24, x2 - x1);
  const height = Math.max(10, Math.abs(y2 - y1) + 14);
  return addShape(slide, "rightArrow", x1, y1 - height / 2, width, height, color, color, 0);
}

function addSpeakerNotes(slide, lines) {
  if (!slide.speakerNotes) return;
  slide.speakerNotes.setText(Array.isArray(lines) ? lines.join("\n") : String(lines));
}

function slide19(presentation) {
  const slide = createSlide(presentation, 19);
  addTitle(
    slide,
    "Project Mapping Overview",
    "Use this section to convert the workshop from a generic AI talk into proof from our own software work.",
    { w: 970 },
  );

  const projects = [
    ["Axiom", "Procurement intelligence", COLORS.blue, ["Agents, supplier risk, demand forecast", "Invoice OCR, SAP/API route, audit export", "Next.js, Postgres, Redis queues, Azure stack"]],
    ["Mastiff", "Conversational data analyst", COLORS.teal, ["CSV/Excel/JSON/Parquet ingestion", "LLM-to-Python sandbox execution", "Charts, report export, sessions, connectors"]],
    ["OEE Box", "Industrial edge AI", COLORS.gold, ["MQTT, Modbus, OPC-UA machine data", "Local RAG, schema inference, trust score", "RL shadow agent and command gatekeeper"]],
  ];

  for (let i = 0; i < projects.length; i += 1) {
    const [name, subtitle, color, bullets] = projects[i];
    const x = 70 + i * 390;
    addShape(slide, "roundRect", x, 218, 350, 312, COLORS.white, "#D7E0EA", 1.2);
    addShape(slide, "rect", x, 218, 350, 8, color, color, 0);
    addText(slide, name, x + 22, 246, 180, 28, {
      size: 21,
      color,
      bold: true,
      face: FONT.title,
      autoFit: "shrinkText",
    });
    addText(slide, subtitle, x + 22, 278, 270, 24, {
      size: 12.8,
      color: COLORS.muted,
      bold: true,
      face: FONT.mono,
      autoFit: "shrinkText",
    });
    addText(slide, bullets.map((b) => `- ${b}`).join("\n"), x + 26, 326, 296, 102, {
      size: 13,
      color: COLORS.ink2,
      face: FONT.body,
      autoFit: "shrinkText",
    });
    addPill(slide, i === 0 ? "business AI" : i === 1 ? "data AI" : "edge AI", x + 22, 454, 126, 30, color, { size: 10 });
    addPill(slide, "demo proof", x + 162, 454, 116, 30, COLORS.ink, { size: 10 });
  }

  addCard(
    slide,
    220,
    562,
    840,
    58,
    "Talk track",
    "The workshop pillars are not theoretical: these projects cover business agents, data analysis, retrieval, predictive ML, edge telemetry, APIs, jobs, storage, security controls, and live software delivery.",
    COLORS.teal,
    { titleSize: 13, bodySize: 11.8 },
  );

  addSpeakerNotes(slide, [
    "Open the mapping section by saying: here is where the abstract workshop becomes concrete.",
    "Keep the personal project out of this discussion and use Axiom, Mastiff, and OEE Box only.",
  ]);
}

function slide20(presentation) {
  const slide = createSlide(presentation, 20);
  addTitle(
    slide,
    "Axiom: Procurement Intelligence Proof",
    "Maps to business AI, agentic workflows, document intelligence, API integration, cloud architecture, and engineering maturity.",
    { w: 1040 },
  );

  addMiniCard(slide, 70, 218, 344, 204, "Implemented product surface", [
    "Dashboards for orders, RFQs, suppliers, spend analytics",
    "Supplier risk scoring and operational intelligence",
    "Admin/user management, support tickets, exports",
    "Procurement workflows with structured review surfaces",
  ], COLORS.blue);

  addMiniCard(slide, 468, 218, 344, 204, "AI and automation layer", [
    "Agent registry and orchestrator with typed inputs",
    "Demand forecasting, fraud detection, payment optimizer",
    "Contract clause analyzer and negotiation autopilot",
    "Smart approval routing and bottleneck prediction",
  ], COLORS.teal);

  addMiniCard(slide, 866, 218, 344, 204, "Production software stack", [
    "Next.js, React, Drizzle ORM, PostgreSQL, NextAuth",
    "Google Generative AI, Azure Blob, Redis, BullMQ",
    "Zod validation, telemetry, rate limiting, audit exports",
    "Smoke, unit, and integration tests for release safety",
  ], COLORS.purple);

  const y = 486;
  const nodes = [
    ["UX", "Dashboards, chat, admin", COLORS.blue],
    ["API", "Routes, auth, validation", COLORS.teal],
    ["Agents", "Planner and tools", COLORS.purple],
    ["Data", "Postgres, Blob, Redis", COLORS.gold],
    ["Ops", "Jobs, audit, telemetry", COLORS.coral],
  ];
  for (let i = 0; i < nodes.length; i += 1) {
    const x = 80 + i * 235;
    addFlowNode(slide, x, y, 168, 82, nodes[i][0], nodes[i][1], nodes[i][2]);
    if (i < nodes.length - 1) addArrow(slide, x + 168, y + 41, x + 220, y + 41, COLORS.muted);
  }

  addSpeakerNotes(slide, [
    "Axiom is the strongest proof of full-stack business AI.",
    "Use it when discussing procurement intelligence, agentic workflow, document extraction, SAP/API integration, queues, audit, cloud deployment, and tests.",
  ]);
}

function slide21(presentation) {
  const slide = createSlide(presentation, 21);
  addTitle(
    slide,
    "Mastiff: Conversational Data Analyst Proof",
    "Maps to natural-language analytics, file ingestion, safe code execution, charts, exports, and enterprise data connectors.",
    { w: 1060 },
  );

  const steps = [
    ["Upload", "CSV, Excel, JSON, Parquet", COLORS.blue],
    ["Profile", "Schema, sample rows, metadata", COLORS.teal],
    ["Plan", "LLM creates analysis plan and Python", COLORS.purple],
    ["Execute", "Sandboxed pandas, numpy, matplotlib", COLORS.gold],
    ["Explain", "Charts, narrative insight, export", COLORS.green],
  ];
  for (let i = 0; i < steps.length; i += 1) {
    const x = 74 + i * 236;
    addFlowNode(slide, x, 230, 166, 110, steps[i][0], steps[i][1], steps[i][2]);
    if (i < steps.length - 1) addArrow(slide, x + 166, 285, x + 222, 285, COLORS.muted);
  }

  addMiniCard(slide, 90, 398, 330, 144, "API and app surfaces", [
    "Upload, preview, metadata, delete endpoints",
    "Chat message, history, regenerate endpoints",
    "Visualization and report export endpoints",
  ], COLORS.teal);

  addMiniCard(slide, 475, 398, 330, 144, "Safety and reliability", [
    "Never execute user code directly",
    "Docker or restricted execution boundary",
    "Timeouts, file limits, no internet, rate limits",
  ], COLORS.coral);

  addMiniCard(slide, 860, 398, 330, 144, "Enterprise expansion", [
    "SharePoint, Drive, Snowflake, BigQuery, Postgres",
    "pgvector semantic memory and shared workspaces",
    "Scheduled reports, SSO/SAML, audit logs",
  ], COLORS.purple);

  addCard(
    slide,
    222,
    570,
    836,
    50,
    "Workshop proof",
    "This project is the clean bridge from AI chat to real analytics: files become schema, schema becomes executable code, execution becomes visual insight, and insight becomes an exportable artifact.",
    COLORS.teal,
    { titleSize: 12.5, bodySize: 11.4 },
  );

  addSpeakerNotes(slide, [
    "Mastiff is the strongest proof for data analyst workflows.",
    "Call out code generation carefully: the intelligence is not just generating code, it is executing it in a controlled sandbox with limits and auditability.",
  ]);
}

function slide22(presentation) {
  const slide = createSlide(presentation, 22);
  addTitle(
    slide,
    "OEE Box: Edge AI + Industrial Intelligence Proof",
    "Maps to multimodal/edge telemetry, local retrieval, machine reasoning, data trust, RL shadow mode, and safe command execution.",
    { w: 1050 },
  );

  const flow = [
    ["Signals", "MQTT, Modbus, OPC-UA, simulator", COLORS.blue],
    ["Trust", "Sanitize readings, score confidence", COLORS.teal],
    ["Reason", "OEE calculator, schema inference", COLORS.purple],
    ["Assist", "Manual RAG, copilot, offline fallback", COLORS.gold],
    ["Act", "RL shadow suggestions, gatekeeper", COLORS.coral],
  ];
  for (let i = 0; i < flow.length; i += 1) {
    const x = 74 + i * 236;
    addFlowNode(slide, x, 222, 166, 118, flow[i][0], flow[i][1], flow[i][2]);
    if (i < flow.length - 1) addArrow(slide, x + 166, 281, x + 222, 281, COLORS.muted);
  }

  addMiniCard(slide, 70, 402, 270, 142, "Semantic copilot", [
    "Local RAG over manuals and safety protocols",
    "FAISS with Sentence Transformers",
    "LLM answers operator questions with context",
  ], COLORS.teal);

  addMiniCard(slide, 372, 402, 270, 142, "Autonomous intelligence", [
    "RL agent observes and simulates in shadow mode",
    "Virtual sensors infer missing machine states",
    "Predictive health roadmap with RUL models",
  ], COLORS.purple);

  addMiniCard(slide, 674, 402, 270, 142, "Safety-by-design", [
    "Command gatekeeper before machine action",
    "Offline heuristic fallback when AI is unavailable",
    "Audit trace from signal to suggestion",
  ], COLORS.coral);

  addMiniCard(slide, 976, 402, 234, 142, "Real-time stack", [
    "FastAPI, SQLite async, WebSockets",
    "React, Vite, MUI dashboard",
    "Docker Compose edge deployment",
  ], COLORS.gold);

  addCard(
    slide,
    238,
    574,
    804,
    46,
    "Workshop proof",
    "This project shows AI outside a browser chat box: it reads industrial signals, reasons locally, explains machine behavior, and gates every optimization before action.",
    COLORS.gold,
    { titleSize: 12.5, bodySize: 11.2 },
  );

  addSpeakerNotes(slide, [
    "OEE Box is the strongest proof for edge AI, real-time data, industrial reliability, and safety guardrails.",
    "Emphasize shadow mode and command gatekeeping as the responsible AI story.",
  ]);
}

function slide23(presentation) {
  const slide = createSlide(presentation, 23);
  addTitle(
    slide,
    "Slide-by-Slide Talking Map",
    "Use this as the presenter cheat sheet: theme first, project proof second, technical competency third.",
    { w: 1020 },
  );

  const rows = [
    ["Capability map", "Axiom = business AI; Mastiff = data AI; OEE Box = edge AI", COLORS.blue],
    ["RAG pipeline", "OEE manuals copilot; Axiom evidence-grounded answers and audit posture", COLORS.teal],
    ["Document intelligence", "Axiom invoice OCR/upload routes; Mastiff file parsing and schema extraction", COLORS.purple],
    ["Predictive ML", "Axiom demand forecast and supplier scoring; OEE RL/predictive health roadmap", COLORS.gold],
    ["Agentic workflow", "Axiom agent orchestrator; OEE command gatekeeper; Mastiff sandboxed code tool", COLORS.coral],
    ["API topology", "SAP/API routes, cron jobs, queues, email, Blob, Redis, Postgres, MQTT", COLORS.green],
    ["Developer intelligence", "Next.js, React, FastAPI, Docker, typed validation, tests, telemetry", COLORS.slate],
  ];

  addShape(slide, "roundRect", 82, 222, 1116, 344, COLORS.white, "#D7E0EA", 1.2);
  addText(slide, "Workshop theme", 112, 246, 210, 20, {
    size: 12,
    color: COLORS.muted,
    bold: true,
    face: FONT.mono,
  });
  addText(slide, "Project proof line", 356, 246, 610, 20, {
    size: 12,
    color: COLORS.muted,
    bold: true,
    face: FONT.mono,
  });
  addText(slide, "Competency signal", 1000, 246, 150, 20, {
    size: 12,
    color: COLORS.muted,
    bold: true,
    face: FONT.mono,
    align: "center",
  });

  for (let i = 0; i < rows.length; i += 1) {
    const y = 284 + i * 38;
    const [theme, proof, color] = rows[i];
    addShape(slide, "rect", 102, y - 8, 1068, 1, "#EEF2F7", "#EEF2F7", 0);
    addPill(slide, theme, 112, y, 190, 24, color, { size: 9.2 });
    addText(slide, proof, 356, y + 2, 580, 22, {
      size: 12.2,
      color: COLORS.ink2,
      face: FONT.body,
      autoFit: "shrinkText",
    });
    addText(slide, i < 2 ? "RAG" : i < 4 ? "ML/data" : i < 6 ? "APIs" : "code", 1004, y + 2, 140, 20, {
      size: 11,
      color,
      bold: true,
      face: FONT.mono,
      align: "center",
    });
  }

  addCard(
    slide,
    180,
    590,
    920,
    42,
    "Presenter rhythm",
    "For every concept slide, say: here is the pattern, here is where we used it, here is the engineering control that makes it reliable.",
    COLORS.teal,
    { titleSize: 12, bodySize: 11 },
  );

  addSpeakerNotes(slide, [
    "This slide is for rehearsal and live Q&A recovery.",
    "If someone asks whether the workshop is theoretical, jump here and anchor the answer in project evidence.",
  ]);
}

function slide24(presentation) {
  const slide = createSlide(presentation, 24);
  addTitle(
    slide,
    "Live Demo Run Sheet",
    "A practical path for the seven-hour workshop: show breadth, then show code-level and system-level depth.",
    { w: 1060 },
  );

  const demos = [
    ["Axiom business AI", COLORS.blue, ["Open dashboard or supplier view", "Show risk/forecast/agent recommendation", "Point to audit, queue, API, validation path"]],
    ["Mastiff data analyst", COLORS.teal, ["Upload a dataset", "Ask a natural-language question", "Inspect generated Python, chart, and export"]],
    ["OEE Box edge AI", COLORS.gold, ["Simulate machine telemetry", "Ask why OEE dropped", "Show RAG answer, trust score, gatekeeper"]],
  ];

  for (let i = 0; i < demos.length; i += 1) {
    const [title, color, bullets] = demos[i];
    addMiniCard(slide, 86 + i * 398, 222, 338, 184, title, bullets, color);
  }

  addShape(slide, "roundRect", 120, 452, 1040, 84, COLORS.ink, COLORS.ink, 1);
  addText(slide, "Closing proof statement", 154, 474, 260, 20, {
    size: 12,
    color: "#CBD5E1",
    bold: true,
    face: FONT.mono,
  });
  addText(
    slide,
    "We are not only prompting models. We are connecting AI to data, APIs, workflows, jobs, security controls, tests, dashboards, and measurable business outcomes.",
    154,
    498,
    960,
    28,
    {
      size: 18,
      color: COLORS.white,
      bold: true,
      face: FONT.title,
      autoFit: "shrinkText",
    },
  );

  addMiniCard(slide, 146, 570, 282, 52, "Breadth", ["LLMs, RAG, ML, agents, vision-ready flows"], COLORS.blue);
  addMiniCard(slide, 498, 570, 282, 52, "Depth", ["Full-stack apps, APIs, queues, data, cloud"], COLORS.teal);
  addMiniCard(slide, 850, 570, 282, 52, "Maturity", ["Guardrails, audit, tests, telemetry, fallbacks"], COLORS.coral);

  addSpeakerNotes(slide, [
    "Use this as the final rehearsal sheet before the workshop.",
    "Keep each demo bounded. If a live system is not available, use screenshots or a short recorded fallback, but keep the talking points the same.",
  ]);
}

async function saveBlob(blob, filePath) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  await fs.mkdir(VERIFY_DIR, { recursive: true });
}

async function renderNewSlides(presentation, startIndex) {
  const previewPaths = [];
  for (let i = startIndex; i < presentation.slides.items.length; i += 1) {
    const slide = presentation.slides.items[i];
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    const filePath = path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await saveBlob(png, filePath);
    previewPaths.push(filePath);
  }
  return previewPaths;
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractTextBySlide(pptxPath) {
  const bytes = await fs.readFile(pptxPath);
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)[1]) - Number(b.match(/slide(\d+)\.xml/)[1]));
  const records = [];
  for (const fileName of slideFiles) {
    const xml = await zip.file(fileName).async("string");
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXml(match[1]))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    records.push({ fileName, text });
  }
  return records;
}

async function verifyNoPersonalProjectText(pptxPath) {
  const text = (await extractTextBySlide(pptxPath)).map((r) => r.text).join("\n").toLowerCase();
  if (text.includes("thun")) {
    throw new Error("Excluded personal project text found in deck.");
  }
}

async function build() {
  await ensureDirs();
  const sourceDeck = await FileBlob.load(INPUT_PPTX);
  const presentation = await PresentationFile.importPptx(sourceDeck);
  const originalSlideCount = presentation.slides.count;

  slide19(presentation);
  slide20(presentation);
  slide21(presentation);
  slide22(presentation);
  slide23(presentation);
  slide24(presentation);

  if (presentation.slides.count !== 24) {
    throw new Error(`Expected 24 slides after mapping update, got ${presentation.slides.count}`);
  }

  const previewPaths = await renderNewSlides(presentation, originalSlideCount);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT_PPTX);

  const verificationDeck = await PresentationFile.importPptx(await FileBlob.load(OUT_PPTX));
  const slideText = await extractTextBySlide(OUT_PPTX);
  await verifyNoPersonalProjectText(OUT_PPTX);
  await fs.writeFile(
    INSPECT_PATH,
    JSON.stringify({
      input: INPUT_PPTX,
      output: OUT_PPTX,
      originalSlideCount,
      finalSlideCount: verificationDeck.slides.count,
      renderedPreviews: previewPaths,
      slideText,
    }, null, 2),
    "utf8",
  );

  console.log(OUT_PPTX);
}

async function buildAppendix() {
  await ensureDirs();
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  presentation.theme.colorScheme = {
    name: "AI Workshop Project Map",
    themeColors: {
      accent1: COLORS.teal,
      accent2: COLORS.blue,
      accent3: COLORS.gold,
      accent4: COLORS.coral,
      bg1: COLORS.paper,
      bg2: COLORS.ink,
      tx1: COLORS.ink,
      tx2: COLORS.white,
    },
  };

  slide19(presentation);
  slide20(presentation);
  slide21(presentation);
  slide22(presentation);
  slide23(presentation);
  slide24(presentation);

  const previewPaths = await renderNewSlides(presentation, 0);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(APPENDIX_PPTX);

  const verificationDeck = await PresentationFile.importPptx(await FileBlob.load(APPENDIX_PPTX));
  const slideText = await extractTextBySlide(APPENDIX_PPTX);
  await verifyNoPersonalProjectText(APPENDIX_PPTX);
  await fs.writeFile(
    INSPECT_PATH,
    JSON.stringify({
      output: APPENDIX_PPTX,
      finalSlideCount: verificationDeck.slides.count,
      renderedPreviews: previewPaths,
      slideText,
    }, null, 2),
    "utf8",
  );

  console.log(APPENDIX_PPTX);
}

if (process.argv.includes("--appendix-only")) {
  await buildAppendix();
} else {
  await build();
}
