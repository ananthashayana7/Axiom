import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1280;
const H = 720;
const DECK_ID = "ai-workshop-interactive";
const OUT_DIR = "C:\\Axiom\\Axiom\\workshop\\ai-workshop-april-28-2026\\outputs\\ai-workshop-interactive-ppt";
const SCRATCH_DIR = "C:\\Axiom\\Axiom\\workshop\\ai-workshop-april-28-2026\\tmp\\slides\\ai-workshop-interactive";
const PREVIEW_DIR = path.join(SCRATCH_DIR, "preview");
const VERIFY_DIR = path.join(SCRATCH_DIR, "verification");
const INSPECT_PATH = path.join(SCRATCH_DIR, "inspect.ndjson");

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
  slate: "#334155",
  transparent: "#00000000",
};

const FONT = {
  title: "Poppins",
  body: "Lato",
  mono: "Aptos Mono",
};

const SECTION_TARGETS = {
  HOME: 2,
  AGENDA: 3,
  FOUNDATIONS: 4,
  DEMOS: 8,
  STACK: 15,
  GOVERNANCE: 16,
  ROADMAP: 22,
  "START WITH AGENDA": 3,
  "OPEN DEMO PORTFOLIO": 18,
  "GO TO ROADMAP": 22,
  "Q&A": 24,
};

const SECTION_NAV = [
  ["FOUNDATIONS", 4, COLORS.blue],
  ["DEMOS", 8, COLORS.teal],
  ["STACK", 15, COLORS.gold],
  ["GOVERNANCE", 16, COLORS.coral],
  ["ROADMAP", 22, COLORS.purple],
];

const slides = [
  {
    section: "OPENING",
    title: "AI Workshop",
    subtitle: "From ideas to reliable intelligent software",
    kicker: "APRIL 28, 2026 | 7-HOUR TECHNICAL SHOWCASE",
    notes:
      "Open with confidence. The promise is practical AI engineering: models connected to data, software, APIs, evaluation, and governance.",
  },
  {
    section: "HOME",
    title: "Workshop Control Room",
    subtitle: "Jump into any section, return home anytime, and keep the day moving.",
    notes:
      "Use this as the navigation dashboard. In slideshow mode, the cards and navigation pills act as a table of contents.",
  },
  {
    section: "AGENDA",
    title: "Seven-Hour Flow",
    subtitle: "A balanced day: vision, foundations, demos, engineering depth, governance, and roadmap.",
    notes:
      "Treat this as the contract for the day. Mention that demos appear early and architecture follows once the behavior is concrete.",
  },
  {
    section: "FOUNDATIONS",
    title: "North Star",
    subtitle: "AI is not a feature bolted on at the end. It is a capability layer inside a complete product system.",
    notes:
      "This slide anchors the workshop. The line to repeat: models are powerful, but systems create value.",
  },
  {
    section: "FOUNDATIONS",
    title: "Capability Map",
    subtitle: "Six pillars show breadth without turning the workshop into a random collection of experiments.",
    notes:
      "Move quickly across the six pillars. The goal is to signal breadth, then go deep in the demos.",
  },
  {
    section: "FOUNDATIONS",
    title: "Reference Architecture",
    subtitle: "A production-minded AI system coordinates UX, APIs, orchestration, models, retrieval, data, integrations, and operations.",
    notes:
      "Stress that the model is one layer. Reliability comes from the surrounding engineering system.",
  },
  {
    section: "FOUNDATIONS",
    title: "RAG Pipeline",
    subtitle: "Retrieval augmented generation grounds answers in trusted sources instead of asking the model to guess.",
    notes:
      "Use this as the technical bridge into the Knowledge Copilot demo. Explain chunking, embeddings, retrieval, reranking, citations, and feedback.",
  },
  {
    section: "DEMOS",
    title: "Demo 1: Knowledge Copilot",
    subtitle: "A private knowledge assistant that answers from approved documents with citations and refusal behavior.",
    notes:
      "Demo path: ask factual question, open citation, ask comparison question, ask unsupported question, show feedback capture.",
  },
  {
    section: "DEMOS",
    title: "Demo 2: Document Intelligence",
    subtitle: "Convert unstructured documents into validated, reviewable, API-ready structured data.",
    notes:
      "Show classification, extracted fields, confidence, validation, human correction, and generated API payload.",
  },
  {
    section: "DEMOS",
    title: "Demo 3: Predictive ML",
    subtitle: "Show that applied AI is broader than chat: forecasting, anomaly detection, scoring, and decision support.",
    notes:
      "Talk about train/test split, baseline model, backtesting, error metrics, confidence bands, and drift monitoring.",
  },
  {
    section: "DEMOS",
    title: "Demo 4: Agentic Workflow",
    subtitle: "Move from answers to controlled actions through typed tools, approvals, API execution, and audit logs.",
    notes:
      "Emphasize the safety boundary. Read-only tools are different from write tools. Human approval is required for external writes.",
  },
  {
    section: "DEMOS",
    title: "API Integration Topology",
    subtitle: "AI becomes useful when it can safely read context, call tools, and write approved outcomes.",
    notes:
      "Explain integration categories: identity, knowledge, business systems, communication, data, developer systems, AI providers, and monitoring.",
  },
  {
    section: "DEMOS",
    title: "Multimodal and Visual AI",
    subtitle: "Images, screenshots, charts, forms, and video frames become first-class inputs for intelligent workflows.",
    notes:
      "Keep this honest. Visual AI needs confidence thresholds, false-positive handling, labels, and human review.",
  },
  {
    section: "DEMOS",
    title: "Developer Intelligence",
    subtitle: "Use AI to understand code, generate tests, review diffs, explain logs, and speed up delivery.",
    notes:
      "This is where you demonstrate software skill directly. Show architecture explanation, test generation, patch review, and CI thinking.",
  },
  {
    section: "STACK",
    title: "Software Stack Deep Dive",
    subtitle: "The workshop should prove full-stack competence, not only model familiarity.",
    notes:
      "Walk layer by layer: frontend, backend, data, AI services, jobs, auth, DevOps, observability.",
  },
  {
    section: "GOVERNANCE",
    title: "Evaluation and LLMOps",
    subtitle: "The mature question is not only what the model can do. It is how we know it works.",
    notes:
      "Use the chart to talk about scorecards: groundedness, citation accuracy, structured output validity, tool success, latency, and cost.",
  },
  {
    section: "GOVERNANCE",
    title: "Security and Responsible AI",
    subtitle: "Trust comes from permission checks, audit logs, refusal behavior, privacy controls, and human approval.",
    notes:
      "State clearly: retrieved content is untrusted input. It cannot override system instructions or tool permissions.",
  },
  {
    section: "DEMOS",
    title: "Demo Portfolio Matrix",
    subtitle: "Pick a portfolio that proves both model depth and software integration depth.",
    notes:
      "A strong mix: two high-integration demos, two high-AI-depth demos, and one live engineering proof point.",
  },
  {
    section: "DEMOS",
    title: "Live Build Segment",
    subtitle: "A bounded live build proves real skill without risking the entire workshop.",
    notes:
      "Recommend one of three live options: mini RAG, API tool for an agent, or data insight generator. Keep starter code and fallback video ready.",
  },
  {
    section: "DEMOS",
    title: "Demo Fallback Runbook",
    subtitle: "Every impressive live demo needs a calm backup path.",
    notes:
      "Use this to show professionalism. Fallbacks are not weakness; they are how serious teams run important demos.",
  },
  {
    section: "STACK",
    title: "Video and Media Plan",
    subtitle: "Short videos support live demos, compress complex flows, and protect the session from network/API surprises.",
    notes:
      "Keep total video time short: 12 to 18 minutes across the full day. Videos are backup and emphasis, not the whole workshop.",
  },
  {
    section: "ROADMAP",
    title: "Prep Timeline",
    subtitle: "From Wednesday, April 22, 2026 to workshop day on Tuesday, April 28, 2026.",
    notes:
      "This makes the plan feel executable. Each day has a clear job: story, demos, slides, recordings, rehearsal, delivery.",
  },
  {
    section: "ROADMAP",
    title: "30-60-90 Roadmap",
    subtitle: "Turn the workshop energy into pilots, integrations, governance, and measurable production value.",
    notes:
      "Close the loop from showcase to action. Make the next step concrete: select use cases, prototype, evaluate, pilot, and scale.",
  },
  {
    section: "Q&A",
    title: "Q&A and Closing",
    subtitle: "The advantage is not access to models. The advantage is knowing how to turn models into reliable capability.",
    notes:
      "End with the closing line. Invite questions around production readiness, integrations, evaluation, data security, and first pilots.",
  },
];

const inspectRecords = [];

function line(fill = COLORS.transparent, width = 0, style = "solid") {
  return { style, fill, width };
}

function addShape(slide, geometry, x, y, w, h, fill = COLORS.transparent, border = COLORS.transparent, borderWidth = 0, opts = {}) {
  const shape = slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h, rotation: opts.rotation || 0 },
    fill,
    line: line(border, borderWidth, opts.lineStyle || "solid"),
  });
  if (opts.adjustmentList) shape.adjustmentList = opts.adjustmentList;
  return shape;
}

function addText(slide, text, x, y, w, h, opts = {}) {
  const shape = addShape(slide, opts.geometry || "rect", x, y, w, h, opts.fill || COLORS.transparent, opts.border || COLORS.transparent, opts.borderWidth || 0);
  shape.text = Array.isArray(text) ? text : String(text);
  shape.text.fontSize = opts.size || 20;
  shape.text.color = opts.color || COLORS.ink;
  shape.text.bold = Boolean(opts.bold);
  shape.text.typeface = opts.face || FONT.body;
  shape.text.alignment = opts.align || "left";
  shape.text.verticalAlignment = opts.valign || "top";
  shape.text.insets = opts.insets || { left: 0, right: 0, top: 0, bottom: 0 };
  if (opts.autoFit) shape.text.autoFit = opts.autoFit;
  inspectRecords.push({
    kind: "textbox",
    slide: opts.slideNo || 0,
    role: opts.role || "text",
    text: Array.isArray(text) ? text.join("\n") : String(text),
    bbox: [x, y, w, h],
  });
  return shape;
}

function addPill(slide, label, x, y, w, h, fill, opts = {}) {
  const s = addText(slide, label, x, y, w, h, {
    slideNo: opts.slideNo,
    size: opts.size || 12,
    color: opts.color || COLORS.white,
    bold: true,
    face: FONT.mono,
    align: "center",
    valign: "middle",
    fill,
    border: opts.border || fill,
    borderWidth: opts.borderWidth || 1,
    geometry: "roundRect",
    insets: { left: 8, right: 8, top: 3, bottom: 3 },
    role: opts.role || "navigation pill",
  });
  return s;
}

function addHeader(slide, idx) {
  const data = slides[idx - 1];
  addText(slide, data.section, 50, 24, 280, 26, {
    slideNo: idx,
    size: 12,
    color: COLORS.tealDark,
    bold: true,
    face: FONT.mono,
    role: "section label",
  });
  addText(slide, `${String(idx).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`, 1136, 24, 92, 26, {
    slideNo: idx,
    size: 12,
    color: COLORS.muted,
    bold: true,
    face: FONT.mono,
    align: "right",
    role: "slide number",
  });
  addShape(slide, "rect", 50, 58, 1180, 1.5, COLORS.faint);
}

function addFooterNav(slide, idx) {
  addPill(slide, "HOME", 50, 665, 78, 30, COLORS.ink, { slideNo: idx, size: 10 });
  let x = 650;
  for (const [label, , color] of SECTION_NAV) {
    addPill(slide, label, x, 665, label === "GOVERNANCE" ? 118 : 94, 30, color, { slideNo: idx, size: 9 });
    x += label === "GOVERNANCE" ? 128 : 104;
  }
}

function addTitle(slide, idx, title, subtitle, opts = {}) {
  addText(slide, title, opts.x || 72, opts.y || 88, opts.w || 760, opts.h || 98, {
    slideNo: idx,
    size: opts.size || 34,
    color: opts.color || COLORS.ink,
    bold: true,
    face: FONT.title,
    role: "title",
    autoFit: "shrinkText",
  });
  if (subtitle) {
    addText(slide, subtitle, opts.x || 74, (opts.y || 88) + (opts.subtitleOffset || 104), opts.sw || 760, opts.sh || 52, {
      slideNo: idx,
      size: opts.subtitleSize || 17,
      color: opts.subtitleColor || COLORS.slate,
      face: FONT.body,
      role: "subtitle",
      autoFit: "shrinkText",
    });
  }
}

function addCard(slide, idx, x, y, w, h, label, body, color = COLORS.teal, opts = {}) {
  addShape(slide, "roundRect", x, y, w, h, opts.fill || COLORS.white, opts.border || "#CBD5E1", 1);
  addShape(slide, "rect", x, y, 8, h, color);
  addText(slide, label, x + 22, y + 18, w - 44, 28, {
    slideNo: idx,
    size: opts.labelSize || 13,
    color,
    bold: true,
    face: FONT.mono,
    role: "card label",
    autoFit: "shrinkText",
  });
  addText(slide, body, x + 22, y + 56, w - 44, h - 74, {
    slideNo: idx,
    size: opts.bodySize || 16,
    color: COLORS.ink2,
    face: FONT.body,
    role: "card body",
    autoFit: "shrinkText",
  });
}

function addMiniIcon(slide, x, y, color, kind = "nodes") {
  addShape(slide, "ellipse", x, y, 44, 44, "#FFFFFFD9", color, 1.5);
  if (kind === "data") {
    addShape(slide, "rect", x + 12, y + 26, 5, 9, color);
    addShape(slide, "rect", x + 20, y + 20, 5, 15, color);
    addShape(slide, "rect", x + 28, y + 14, 5, 21, color);
  } else if (kind === "shield") {
    addShape(slide, "roundRect", x + 13, y + 10, 18, 24, color, color, 1);
    addShape(slide, "rect", x + 18, y + 31, 8, 5, "#FFFFFF88");
  } else {
    addShape(slide, "ellipse", x + 12, y + 15, 8, 8, color);
    addShape(slide, "ellipse", x + 25, y + 24, 8, 8, color);
    addShape(slide, "rect", x + 20, y + 22, 12, 3, color);
  }
}

function addNotes(slide, text) {
  slide.speakerNotes.setText(text);
}

function setBackground(slide, variant = "paper") {
  slide.background.fill = variant === "dark" ? COLORS.ink : COLORS.paper;
  if (variant === "paper") {
    addShape(slide, "ellipse", 960, -140, 360, 360, "#DDEBFF");
    addShape(slide, "ellipse", -130, 500, 320, 320, "#E6F7F2");
    addShape(slide, "rect", 0, 0, W, H, "#FFFFFFC7");
  }
}

function addMatrixAxes(slide, idx, x, y, w, h) {
  addShape(slide, "rect", x, y, w, h, COLORS.white, "#CBD5E1", 1);
  addShape(slide, "rect", x + w / 2, y, 1.5, h, "#CBD5E1");
  addShape(slide, "rect", x, y + h / 2, w, 1.5, "#CBD5E1");
  addText(slide, "AI / ML depth", x - 72, y + h / 2 - 80, 46, 160, {
    slideNo: idx,
    size: 13,
    color: COLORS.slate,
    bold: true,
    face: FONT.mono,
    align: "center",
    valign: "middle",
    role: "matrix axis",
  });
  addText(slide, "Software and API integration depth", x + w / 2 - 220, y + h + 28, 440, 24, {
    slideNo: idx,
    size: 13,
    color: COLORS.slate,
    bold: true,
    face: FONT.mono,
    align: "center",
    role: "matrix axis",
  });
}

function addBubble(slide, idx, label, x, y, color, size = 86) {
  addShape(slide, "ellipse", x, y, size, size, color, COLORS.white, 2);
  addText(slide, label, x + 9, y + size / 2 - 22, size - 18, 44, {
    slideNo: idx,
    size: 12,
    color: COLORS.white,
    bold: true,
    face: FONT.body,
    align: "center",
    valign: "middle",
    role: "matrix bubble",
    autoFit: "shrinkText",
  });
}

function addStep(slide, idx, n, label, body, x, y, w, color) {
  addShape(slide, "ellipse", x, y, 44, 44, color);
  addText(slide, String(n), x, y + 8, 44, 20, {
    slideNo: idx,
    size: 16,
    color: COLORS.white,
    bold: true,
    face: FONT.mono,
    align: "center",
    role: "step number",
  });
  addText(slide, label, x + 58, y, w - 58, 24, {
    slideNo: idx,
    size: 15,
    color,
    bold: true,
    face: FONT.mono,
    role: "step label",
  });
  addText(slide, body, x + 58, y + 28, w - 58, 42, {
    slideNo: idx,
    size: 14,
    color: COLORS.ink2,
    face: FONT.body,
    role: "step body",
    autoFit: "shrinkText",
  });
}

function createSlide(presentation, idx) {
  const slide = presentation.slides.add();
  setBackground(slide, idx === 1 ? "dark" : "paper");
  if (idx > 1) {
    addHeader(slide, idx);
    addFooterNav(slide, idx);
  }
  addNotes(slide, slides[idx - 1].notes);
  return slide;
}

function slide1(p) {
  const idx = 1;
  const slide = createSlide(p, idx);
  addShape(slide, "ellipse", 790, 90, 340, 340, "#10A37F22", COLORS.teal, 2);
  addShape(slide, "ellipse", 900, 205, 112, 112, COLORS.teal);
  addText(slide, "AI", 900, 232, 112, 44, { slideNo: idx, size: 32, color: COLORS.white, bold: true, face: FONT.title, align: "center", role: "hero node" });
  const nodes = [
    ["DATA", 785, 165, COLORS.blue],
    ["APIs", 1050, 170, COLORS.gold],
    ["UX", 815, 420, COLORS.purple],
    ["EVALS", 1030, 418, COLORS.coral],
    ["CODE", 920, 510, COLORS.green],
  ];
  for (const [label, x, y, c] of nodes) {
    addShape(slide, "ellipse", x, y, 86, 86, c);
    addText(slide, label, x + 7, y + 31, 72, 24, { slideNo: idx, size: 14, color: COLORS.white, bold: true, face: FONT.mono, align: "center", role: "hero node" });
  }
  addText(slide, slides[0].kicker, 76, 92, 530, 26, { slideNo: idx, size: 13, color: "#A7F3D0", bold: true, face: FONT.mono, role: "kicker" });
  addText(slide, "AI Workshop", 72, 142, 610, 72, { slideNo: idx, size: 52, color: COLORS.white, bold: true, face: FONT.title, role: "cover title" });
  addText(slide, "From ideas to reliable intelligent software", 76, 224, 600, 94, { slideNo: idx, size: 28, color: "#E2E8F0", face: FONT.body, role: "cover subtitle" });
  addShape(slide, "roundRect", 76, 390, 550, 110, "#FFFFFF14", "#FFFFFF30", 1);
  addText(slide, "Models + data + APIs + product engineering + governance", 104, 420, 494, 48, { slideNo: idx, size: 22, color: COLORS.white, bold: true, face: FONT.title, role: "core statement" });
  addPill(slide, "START WITH AGENDA", 76, 550, 190, 40, COLORS.teal, { slideNo: idx, size: 11 });
  addPill(slide, "OPEN DEMO PORTFOLIO", 282, 550, 220, 40, COLORS.blue, { slideNo: idx, size: 11 });
}

function slide2(p) {
  const idx = 2;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 870 });
  const cards = [
    ["AGENDA", "Seven-hour flow and pacing", 86, 244, COLORS.blue],
    ["FOUNDATIONS", "AI/ML basics, RAG, architecture", 356, 244, COLORS.teal],
    ["DEMOS", "Six showcase demos and runbook", 626, 244, COLORS.gold],
    ["STACK", "Software stack and API connects", 896, 244, COLORS.purple],
    ["GOVERNANCE", "Security, evals, responsible AI", 226, 454, COLORS.coral],
    ["ROADMAP", "Prep plan and 30-60-90 path", 636, 454, COLORS.green],
  ];
  for (const [label, body, x, y, color] of cards) {
    addShape(slide, "roundRect", x, y, 248, 156, COLORS.white, "#CBD5E1", 1.2);
    addMiniIcon(slide, x + 22, y + 22, color, label === "STACK" ? "data" : label === "GOVERNANCE" ? "shield" : "nodes");
    addText(slide, label, x + 82, y + 30, 140, 28, { slideNo: idx, size: 15, color, bold: true, face: FONT.mono, role: "home link" });
    addText(slide, body, x + 24, y + 88, 200, 42, { slideNo: idx, size: 16, color: COLORS.ink2, face: FONT.body, role: "home card body", autoFit: "shrinkText" });
  }
  addShape(slide, "roundRect", 72, 625, 1135, 30, "#11182710", "#CBD5E1", 1);
  addText(slide, "Tip: use slideshow mode. Every top-level card, footer pill, and HOME button is clickable.", 94, 631, 760, 18, {
    slideNo: idx,
    size: 12,
    color: COLORS.slate,
    face: FONT.body,
    role: "usage note",
  });
}

function slide3(p) {
  const idx = 3;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 890 });
  const segments = [
    ["0:00", "Opening", COLORS.blue, 70],
    ["0:30", "Foundations", COLORS.teal, 205],
    ["1:15", "Knowledge demo", COLORS.gold, 360],
    ["2:15", "Predictive ML", COLORS.purple, 535],
    ["3:00", "Agents", COLORS.coral, 710],
    ["3:45", "Break", COLORS.slate, 850],
    ["4:15", "Stack deep dive", COLORS.green, 975],
    ["5:45", "Governance", COLORS.cyan, 1130],
  ];
  addShape(slide, "rect", 88, 325, 1100, 7, "#CBD5E1");
  for (const [time, label, color, x] of segments) {
    addShape(slide, "ellipse", x, 301, 55, 55, color, COLORS.white, 2);
    addText(slide, time, x - 24, 250, 104, 24, { slideNo: idx, size: 16, color: COLORS.ink, bold: true, face: FONT.mono, align: "center", role: "agenda time" });
    addText(slide, label, x - 42, 370, 140, 44, { slideNo: idx, size: 13, color: COLORS.ink2, bold: true, face: FONT.body, align: "center", role: "agenda label", autoFit: "shrinkText" });
  }
  addCard(slide, idx, 90, 492, 338, 120, "Pacing rule", "Use demos early. Explain architecture after the audience has seen the behavior.", COLORS.teal, { bodySize: 14 });
  addCard(slide, idx, 472, 492, 338, 120, "Flexible buffer", "Keep 30 to 45 minutes available for deeper Q&A, setup delays, or audience-led discussion.", COLORS.gold, { bodySize: 14 });
  addCard(slide, idx, 854, 492, 338, 120, "Presenter mode", "Use HOME for navigation and speaker notes for talk tracks.", COLORS.purple, { bodySize: 14 });
}

function slide4(p) {
  const idx = 4;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 990 });
  addShape(slide, "roundRect", 86, 265, 1108, 120, COLORS.ink, COLORS.ink, 1);
  addText(slide, "\"AI is a capability layer: data, models, APIs, UX, evaluation, security, and operations working together.\"", 126, 302, 1028, 48, {
    slideNo: idx,
    size: 25,
    color: COLORS.white,
    bold: true,
    face: FONT.title,
    align: "center",
    role: "north star quote",
    autoFit: "shrinkText",
  });
  const points = [
    ["Model", "Reasoning, generation, classification, embeddings", COLORS.blue],
    ["System", "Retrieval, tools, jobs, data, APIs, state", COLORS.teal],
    ["Trust", "Permissions, evals, audit logs, human approval", COLORS.coral],
  ];
  for (let i = 0; i < points.length; i += 1) {
    const [label, body, color] = points[i];
    addCard(slide, idx, 108 + i * 370, 445, 320, 140, label, body, color, { bodySize: 15 });
  }
}

function slide5(p) {
  const idx = 5;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 900 });
  const caps = [
    ["Knowledge AI", "RAG, semantic search, citations", COLORS.blue],
    ["Document Intelligence", "OCR, extraction, validation", COLORS.teal],
    ["Predictive ML", "Forecasting, anomalies, risk", COLORS.gold],
    ["Workflow Agents", "Tool calling, approvals, logs", COLORS.purple],
    ["Visual AI", "Images, charts, screenshots", COLORS.coral],
    ["Developer Intelligence", "Code, tests, review, docs", COLORS.green],
  ];
  for (let i = 0; i < caps.length; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const [label, body, color] = caps[i];
    addCard(slide, idx, 80 + col * 390, 245 + row * 180, 344, 140, label, body, color, { bodySize: 15 });
  }
}

function slide6(p) {
  const idx = 6;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040 });
  const layers = [
    ["Experience", "Web app, dashboards, chat, admin console", COLORS.blue],
    ["Application API", "REST/GraphQL, auth, validation, rate limits", COLORS.teal],
    ["Orchestration", "Workflow engine, agent planner, queues, approvals", COLORS.purple],
    ["AI + Retrieval", "LLMs, embeddings, vector search, reranking", COLORS.gold],
    ["Data + Integrations", "SQL, files, CRM, ERP, email, calendar", COLORS.cyan],
    ["Governance + Ops", "RBAC, audit logs, evals, monitoring, CI/CD", COLORS.coral],
  ];
  for (let i = 0; i < layers.length; i += 1) {
    const [label, body, color] = layers[i];
    const y = 222 + i * 62;
    addShape(slide, "roundRect", 154, y, 970, 48, COLORS.white, "#CBD5E1", 1);
    addShape(slide, "rect", 154, y, 12, 48, color);
    addText(slide, label, 188, y + 11, 210, 24, { slideNo: idx, size: 15, color, bold: true, face: FONT.mono, role: "architecture layer" });
    addText(slide, body, 430, y + 12, 625, 24, { slideNo: idx, size: 15, color: COLORS.ink2, face: FONT.body, role: "architecture body" });
  }
}

function slide7(p) {
  const idx = 7;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1050 });
  const steps = [
    ["Sources", "Docs, tickets, reports, wikis", COLORS.blue],
    ["Ingest", "Extract, clean, chunk, enrich", COLORS.teal],
    ["Embed", "Create searchable vector signals", COLORS.gold],
    ["Retrieve", "Hybrid search and reranking", COLORS.purple],
    ["Answer", "Grounded response with citations", COLORS.coral],
    ["Evaluate", "Feedback, golden tests, refusal checks", COLORS.green],
  ];
  for (let i = 0; i < steps.length; i += 1) {
    const [label, body, color] = steps[i];
    const x = 80 + i * 190;
    addShape(slide, "roundRect", x, 278, 150, 150, COLORS.white, "#CBD5E1", 1);
    addShape(slide, "ellipse", x + 48, 236, 54, 54, color, COLORS.white, 2);
    addText(slide, String(i + 1), x + 48, 250, 54, 24, { slideNo: idx, size: 16, color: COLORS.white, bold: true, face: FONT.mono, align: "center", role: "rag number" });
    addText(slide, label, x + 14, 310, 122, 24, { slideNo: idx, size: 14, color, bold: true, face: FONT.mono, align: "center", role: "rag label" });
    addText(slide, body, x + 16, 346, 118, 48, { slideNo: idx, size: 13, color: COLORS.ink2, face: FONT.body, align: "center", role: "rag body", autoFit: "shrinkText" });
    if (i < steps.length - 1) addShape(slide, "rightArrow", x + 152, 335, 36, 24, "#CBD5E1");
  }
  addCard(slide, idx, 175, 505, 930, 88, "Quality contract", "Answer directly, cite sources, separate fact from interpretation, show uncertainty, and refuse unsupported questions.", COLORS.teal, { bodySize: 15 });
}

function slide8(p) {
  const idx = 8;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 980 });
  const flow = [
    ["Upload/connect docs", "Document library and metadata filters"],
    ["Ask grounded question", "Retriever selects evidence"],
    ["Answer with citations", "Open source and inspect context"],
    ["Unsupported question", "Refuse or ask for clarification"],
  ];
  for (let i = 0; i < flow.length; i += 1) {
    addStep(slide, idx, i + 1, flow[i][0], flow[i][1], 110 + (i % 2) * 540, 260 + Math.floor(i / 2) * 135, 455, i % 2 ? COLORS.gold : COLORS.teal);
  }
  addCard(slide, idx, 768, 510, 360, 96, "Technical proof", "Chunking, embeddings, hybrid retrieval, reranking, citations, feedback loop, evaluation set.", COLORS.blue, { bodySize: 14 });
}

function slide9(p) {
  const idx = 9;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1030 });
  const pipeline = [
    ["Classify", COLORS.blue],
    ["Extract", COLORS.teal],
    ["Validate", COLORS.gold],
    ["Review", COLORS.purple],
    ["Payload", COLORS.coral],
  ];
  for (let i = 0; i < pipeline.length; i += 1) {
    const [label, color] = pipeline[i];
    const x = 130 + i * 205;
    addShape(slide, "roundRect", x, 288, 138, 92, COLORS.white, color, 2);
    addText(slide, label, x + 12, 321, 114, 28, { slideNo: idx, size: 18, color, bold: true, face: FONT.mono, align: "center", role: "document pipeline" });
    if (i < pipeline.length - 1) addShape(slide, "rightArrow", x + 150, 318, 42, 28, "#CBD5E1");
  }
  addCard(slide, idx, 120, 470, 310, 126, "Schema-driven", "Extraction fields are defined up front and validated before export.", COLORS.teal, { bodySize: 14 });
  addCard(slide, idx, 485, 470, 310, 126, "Confidence-aware", "Low-confidence values are routed to human review instead of hidden.", COLORS.gold, { bodySize: 14 });
  addCard(slide, idx, 850, 470, 310, 126, "API-ready", "Validated JSON payloads can move into workflow systems safely.", COLORS.purple, { bodySize: 14 });
}

function slide10(p) {
  const idx = 10;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040 });
  addCard(slide, idx, 76, 245, 312, 112, "ML lifecycle", "Clean data, features, split, train, test, serve, monitor.", COLORS.teal, { bodySize: 13 });
  addCard(slide, idx, 76, 385, 312, 112, "Presenter angle", "Use metrics to show that ML is measurable, not magical.", COLORS.gold, { bodySize: 13 });
  addShape(slide, "roundRect", 430, 220, 755, 390, COLORS.white, "#CBD5E1", 1);
  addText(slide, "Forecast demo scorecard", 458, 244, 320, 26, { slideNo: idx, size: 18, color: COLORS.ink, bold: true, face: FONT.title, role: "chart title" });
  const chart = slide.charts.add("bar");
  chart.position = { left: 470, top: 292, width: 650, height: 270 };
  chart.title = "";
  chart.categories = ["Baseline", "Feature model", "Backtested", "Monitored"];
  const series = chart.series.add("Readiness");
  series.values = [42, 68, 82, 74];
  series.categories = chart.categories;
  series.fill = COLORS.teal;
  chart.hasLegend = false;
  chart.barOptions.direction = "column";
  chart.dataLabels.showValue = true;
  chart.dataLabels.position = "outEnd";
  chart.plotAreaFill = "#FFFFFF";
  chart.xAxis.textStyle.fontSize = 12;
  chart.xAxis.textStyle.typeface = FONT.body;
  chart.yAxis.textStyle.fontSize = 12;
  chart.yAxis.textStyle.typeface = FONT.body;
}

function slide11(p) {
  const idx = 11;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1050 });
  const states = [
    ["Request", 90, 280, COLORS.blue],
    ["Classify", 260, 280, COLORS.teal],
    ["Gather context", 430, 280, COLORS.gold],
    ["Plan", 620, 280, COLORS.purple],
    ["Approve", 770, 280, COLORS.coral],
    ["Execute", 940, 280, COLORS.green],
    ["Audit", 1090, 280, COLORS.cyan],
  ];
  for (let i = 0; i < states.length; i += 1) {
    const [label, x, y, color] = states[i];
    addShape(slide, "roundRect", x, y, 120, 72, COLORS.white, color, 2);
    addText(slide, label, x + 10, y + 23, 100, 24, { slideNo: idx, size: 14, color, bold: true, face: FONT.body, align: "center", role: "agent state", autoFit: "shrinkText" });
    if (i < states.length - 1) addShape(slide, "rightArrow", x + 125, y + 24, 38, 24, "#CBD5E1");
  }
  addCard(slide, idx, 120, 460, 320, 122, "Safety boundary", "Read tools and write tools are separate. External writes require approval.", COLORS.coral, { bodySize: 14 });
  addCard(slide, idx, 480, 460, 320, 122, "Typed tools", "Every tool has a schema, validation, timeout, retry behavior, and audit payload.", COLORS.teal, { bodySize: 14 });
  addCard(slide, idx, 840, 460, 320, 122, "Dry run mode", "Show proposed actions before execution. Keep demos safe and inspectable.", COLORS.blue, { bodySize: 14 });
}

function slide12(p) {
  const idx = 12;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040 });
  addShape(slide, "ellipse", 550, 285, 180, 180, COLORS.ink);
  addText(slide, "AI\nOrchestration\nHub", 580, 327, 120, 72, { slideNo: idx, size: 20, color: COLORS.white, bold: true, face: FONT.title, align: "center", role: "api hub" });
  const systems = [
    ["Identity", 145, 215, COLORS.blue],
    ["Knowledge", 470, 175, COLORS.teal],
    ["Business systems", 800, 215, COLORS.gold],
    ["Communication", 895, 420, COLORS.purple],
    ["AI providers", 740, 555, COLORS.coral],
    ["Data systems", 385, 555, COLORS.green],
    ["Developer systems", 100, 420, COLORS.cyan],
  ];
  for (const [label, x, y, color] of systems) {
    addShape(slide, "roundRect", x, y, 250, 90, COLORS.white, color, 2);
    addText(slide, label, x + 18, y + 28, 214, 30, { slideNo: idx, size: 17, color, bold: true, face: FONT.title, align: "center", role: "api system" });
  }
  addCard(slide, idx, 78, 595, 300, 60, "Rule", "Permission first, then retrieval, then action.", COLORS.teal, { bodySize: 12, labelSize: 11 });
}

function slide13(p) {
  const idx = 13;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1030 });
  const demos = [
    ["Screenshot analyzer", "Understand UI states and errors", COLORS.blue],
    ["Form image reader", "OCR + structured extraction", COLORS.teal],
    ["Chart explainer", "Ask questions about visual data", COLORS.gold],
    ["Visual QA", "Classify defects and flag uncertainty", COLORS.coral],
  ];
  for (let i = 0; i < demos.length; i += 1) {
    const [label, body, color] = demos[i];
    addCard(slide, idx, 110 + (i % 2) * 520, 250 + Math.floor(i / 2) * 165, 450, 125, label, body, color, { bodySize: 15 });
  }
  addShape(slide, "roundRect", 835, 246, 260, 270, "#111827", COLORS.ink, 1);
  addShape(slide, "rect", 867, 280, 196, 130, "#E2E8F0", "#CBD5E1", 1);
  addShape(slide, "ellipse", 898, 312, 34, 34, COLORS.teal);
  addShape(slide, "rect", 950, 314, 86, 12, COLORS.blue);
  addShape(slide, "rect", 950, 340, 64, 12, COLORS.gold);
  addText(slide, "Confidence + review", 862, 444, 210, 28, { slideNo: idx, size: 17, color: COLORS.white, bold: true, face: FONT.title, align: "center", role: "visual mock label" });
}

function slide14(p) {
  const idx = 14;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040 });
  const cards = [
    ["Understand", "Index a repo, explain modules, map dependencies.", COLORS.blue],
    ["Generate", "Create focused unit tests and API docs.", COLORS.teal],
    ["Review", "Inspect diffs for bugs, regressions, missing tests.", COLORS.gold],
    ["Debug", "Summarize logs and propose next checks.", COLORS.coral],
  ];
  for (let i = 0; i < cards.length; i += 1) {
    addCard(slide, idx, 92 + i * 288, 275, 244, 150, cards[i][0], cards[i][1], cards[i][2], { bodySize: 14 });
  }
  addShape(slide, "roundRect", 220, 505, 840, 72, COLORS.ink, COLORS.ink, 1);
  addText(slide, "Human review remains the gate: AI proposes, engineers verify, tests prove.", 250, 526, 780, 30, {
    slideNo: idx,
    size: 21,
    color: COLORS.white,
    bold: true,
    face: FONT.title,
    align: "center",
    role: "developer principle",
  });
}

function slide15(p) {
  const idx = 15;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 980 });
  const stack = [
    ["Frontend", "React-style UI, dashboards, chat, uploads", COLORS.blue],
    ["Backend", "Typed APIs, auth, validation, background jobs", COLORS.teal],
    ["Data", "SQL, object storage, vector search, cache", COLORS.gold],
    ["AI/ML", "LLMs, embeddings, vision, speech, classical ML", COLORS.purple],
    ["DevOps", "CI/CD, tests, containers, staged deploys", COLORS.green],
    ["Observability", "Logs, traces, metrics, cost controls", COLORS.coral],
  ];
  for (let i = 0; i < stack.length; i += 1) {
    const [label, body, color] = stack[i];
    addCard(slide, idx, 92 + (i % 3) * 380, 235 + Math.floor(i / 3) * 170, 332, 130, label, body, color, { bodySize: 14 });
  }
}

function slide16(p) {
  const idx = 16;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1020 });
  addShape(slide, "roundRect", 80, 230, 1120, 340, COLORS.white, "#CBD5E1", 1);
  const chart = slide.charts.add("bar");
  chart.position = { left: 115, top: 285, width: 620, height: 235 };
  chart.categories = ["Groundedness", "Citations", "JSON validity", "Tool success", "Latency"];
  const s1 = chart.series.add("Target");
  s1.values = [90, 95, 98, 95, 85];
  s1.categories = chart.categories;
  s1.fill = COLORS.teal;
  const s2 = chart.series.add("Current");
  s2.values = [78, 84, 92, 88, 72];
  s2.categories = chart.categories;
  s2.fill = COLORS.gold;
  chart.hasLegend = true;
  chart.legend.position = "bottom";
  chart.barOptions.direction = "column";
  chart.dataLabels.showValue = true;
  chart.dataLabels.position = "outEnd";
  chart.plotAreaFill = "#FFFFFF";
  chart.xAxis.textStyle.fontSize = 11;
  chart.xAxis.textStyle.typeface = FONT.body;
  chart.yAxis.textStyle.fontSize = 11;
  chart.yAxis.textStyle.typeface = FONT.body;
  chart.legend.textStyle.fontSize = 12;
  chart.legend.textStyle.typeface = FONT.body;
  addCard(slide, idx, 780, 260, 350, 140, "Evaluation methods", "Golden Q&A\nHuman review\nSchema and source checks\nRed-team prompts", COLORS.teal, { bodySize: 14, labelSize: 11 });
  addCard(slide, idx, 780, 420, 350, 140, "Operational metrics", "Latency and cost\nRefusal rate\nTool success\nFeedback review", COLORS.gold, { bodySize: 14, labelSize: 11 });
}

function slide17(p) {
  const idx = 17;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1050 });
  const controls = [
    ["Least privilege", "Every connector gets only the scope it needs.", COLORS.blue],
    ["Access-aware retrieval", "Filter content before the model sees it.", COLORS.teal],
    ["Approval gates", "External writes require explicit human approval.", COLORS.gold],
    ["Audit logs", "Store prompts, tool calls, decisions, and outcomes.", COLORS.purple],
    ["Prompt injection defense", "Retrieved text cannot override system/tool rules.", COLORS.coral],
    ["Cost controls", "Rate limits, quotas, caching, and model routing.", COLORS.green],
  ];
  for (let i = 0; i < controls.length; i += 1) {
    addCard(slide, idx, 74 + (i % 3) * 395, 235 + Math.floor(i / 3) * 166, 350, 126, controls[i][0], controls[i][1], controls[i][2], { bodySize: 13 });
  }
}

function slide18(p) {
  const idx = 18;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1020 });
  addMatrixAxes(slide, idx, 225, 238, 830, 315);
  addBubble(slide, idx, "Knowledge\nCopilot", 760, 268, COLORS.blue, 92);
  addBubble(slide, idx, "Document\nWorkflow", 775, 392, COLORS.teal, 92);
  addBubble(slide, idx, "AI Ops\nAgent", 895, 440, COLORS.purple, 92);
  addBubble(slide, idx, "Predictive\nML", 430, 272, COLORS.gold, 92);
  addBubble(slide, idx, "Visual\nAI", 342, 374, COLORS.coral, 92);
  addBubble(slide, idx, "Developer\nWorkbench", 590, 448, COLORS.green, 96);
  addText(slide, "Best mix: two high-integration demos, two high-AI-depth demos, one live engineering proof point.", 245, 620, 790, 24, {
    slideNo: idx,
    size: 15,
    color: COLORS.slate,
    bold: true,
    face: FONT.body,
    align: "center",
    role: "matrix recommendation",
  });
}

function slide19(p) {
  const idx = 19;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040 });
  const options = [
    ["Mini RAG App", "Paste text, chunk it, retrieve relevant sections, generate cited answer.", COLORS.blue],
    ["Agent API Tool", "Define schema, validate input, dry-run action, request approval, log result.", COLORS.teal],
    ["Data Insight Generator", "Load CSV, profile columns, chart metrics, generate grounded summary.", COLORS.gold],
  ];
  for (let i = 0; i < options.length; i += 1) {
    addCard(slide, idx, 110 + i * 365, 275, 315, 170, options[i][0], options[i][1], options[i][2], { bodySize: 15 });
  }
  addShape(slide, "roundRect", 182, 520, 916, 62, COLORS.ink, COLORS.ink, 1);
  addText(slide, "Rule: tiny scope, rehearsed starter code, mock mode, and a recorded fallback.", 214, 538, 852, 24, {
    slideNo: idx,
    size: 20,
    color: COLORS.white,
    bold: true,
    face: FONT.title,
    align: "center",
    role: "live build rule",
  });
}

function slide20(p) {
  const idx = 20;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040 });
  const rows = [
    ["Knowledge Copilot", "recorded walkthrough, screenshots, sample Q&A"],
    ["Document Extraction", "pre-extracted JSON and validation screen"],
    ["Predictive ML", "precomputed outputs and metrics screenshot"],
    ["Agent Workflow", "dry-run mode and visible tool payload"],
    ["Visual AI", "labeled expected output and review queue"],
  ];
  addShape(slide, "roundRect", 120, 230, 1040, 350, COLORS.white, "#CBD5E1", 1);
  addText(slide, "Demo", 150, 258, 250, 24, { slideNo: idx, size: 14, color: COLORS.tealDark, bold: true, face: FONT.mono, role: "table header" });
  addText(slide, "Fallback asset", 460, 258, 540, 24, { slideNo: idx, size: 14, color: COLORS.tealDark, bold: true, face: FONT.mono, role: "table header" });
  for (let i = 0; i < rows.length; i += 1) {
    const y = 306 + i * 48;
    addShape(slide, "rect", 140, y - 11, 980, 1, "#E2E8F0");
    addText(slide, rows[i][0], 150, y, 250, 24, { slideNo: idx, size: 15, color: COLORS.ink, bold: true, face: FONT.body, role: "fallback demo" });
    addText(slide, rows[i][1], 460, y, 560, 24, { slideNo: idx, size: 15, color: COLORS.ink2, face: FONT.body, role: "fallback asset" });
  }
}

function slide21(p) {
  const idx = 21;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1000 });
  const videos = [
    ["Opening montage", "45-60 sec", COLORS.blue],
    ["Knowledge Copilot", "2-3 min", COLORS.teal],
    ["Agent workflow", "2-3 min", COLORS.purple],
    ["ML dashboard", "90 sec", COLORS.gold],
    ["Engineering stack", "2 min", COLORS.coral],
    ["Closing roadmap", "45 sec", COLORS.green],
  ];
  for (let i = 0; i < videos.length; i += 1) {
    const [name, time, color] = videos[i];
    const x = 86 + (i % 3) * 380;
    const y = 250 + Math.floor(i / 3) * 155;
    addShape(slide, "roundRect", x, y, 326, 112, COLORS.white, "#CBD5E1", 1);
    addShape(slide, "rightArrow", x + 25, y + 40, 42, 28, color);
    addText(slide, name, x + 82, y + 25, 210, 26, { slideNo: idx, size: 16, color: COLORS.ink, bold: true, face: FONT.title, role: "video name" });
    addText(slide, time, x + 82, y + 62, 140, 22, { slideNo: idx, size: 14, color, bold: true, face: FONT.mono, role: "video duration" });
  }
  addText(slide, "Keep total video time around 12 to 18 minutes. Use videos as backup and emphasis, not as the whole workshop.", 180, 594, 920, 28, {
    slideNo: idx,
    size: 17,
    color: COLORS.slate,
    bold: true,
    face: FONT.body,
    align: "center",
    role: "video guidance",
  });
}

function slide22(p) {
  const idx = 22;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040 });
  const days = [
    ["Apr 22", "Build story", COLORS.blue],
    ["Apr 23", "Polish demos", COLORS.teal],
    ["Apr 24", "Slides + visuals", COLORS.gold],
    ["Apr 25-26", "Record backups", COLORS.purple],
    ["Apr 27", "Full rehearsal", COLORS.coral],
    ["Apr 28", "Workshop day", COLORS.green],
  ];
  addShape(slide, "rect", 112, 342, 1020, 6, "#CBD5E1");
  for (let i = 0; i < days.length; i += 1) {
    const [date, task, color] = days[i];
    const x = 112 + i * 200;
    addShape(slide, "ellipse", x, 318, 54, 54, color, COLORS.white, 2);
    addText(slide, date, x - 30, 262, 115, 24, { slideNo: idx, size: 15, color, bold: true, face: FONT.mono, align: "center", role: "prep date" });
    addText(slide, task, x - 48, 394, 150, 44, { slideNo: idx, size: 14, color: COLORS.ink2, bold: true, face: FONT.body, align: "center", role: "prep task", autoFit: "shrinkText" });
  }
  addCard(slide, idx, 192, 494, 895, 106, "Rehearsal checklist", "Network, display, mock mode, local data, backup videos, tabs, commands.", COLORS.teal, { bodySize: 14 });
}

function slide23(p) {
  const idx = 23;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1030 });
  const roadmap = [
    ["30 days", "Select use cases, define success metrics, build bounded prototypes.", COLORS.blue],
    ["60 days", "Pilot with users, connect APIs, create evaluation sets, review security.", COLORS.teal],
    ["90 days", "Productionize winners, monitor quality/cost, create reusable AI platform patterns.", COLORS.gold],
  ];
  for (let i = 0; i < roadmap.length; i += 1) {
    addCard(slide, idx, 118 + i * 350, 282, 302, 190, roadmap[i][0], roadmap[i][1], roadmap[i][2], { bodySize: 15 });
  }
  addPill(slide, "Q&A", 565, 545, 150, 40, COLORS.ink, { slideNo: idx, size: 13 });
}

function slide24(p) {
  const idx = 24;
  const slide = createSlide(p, idx);
  addTitle(slide, idx, slides[idx - 1].title, slides[idx - 1].subtitle, { w: 1040, h: 116, size: 38 });
  const questions = [
    "How do we prevent hallucinations?",
    "Which workflows should be productionized first?",
    "How do we connect AI safely to APIs?",
    "How do we measure quality and cost?",
    "What data and governance are required?",
  ];
  for (let i = 0; i < questions.length; i += 1) {
    addText(slide, questions[i], 175, 270 + i * 54, 930, 34, {
      slideNo: idx,
      size: 20,
      color: COLORS.ink2,
      bold: true,
      face: FONT.body,
      align: "center",
      role: "qa prompt",
    });
  }
  addShape(slide, "roundRect", 190, 565, 900, 54, COLORS.ink, COLORS.ink, 1);
  addText(slide, "Models are powerful. Reliable AI capability comes from the system around them.", 220, 581, 840, 22, {
    slideNo: idx,
    size: 18,
    color: COLORS.white,
    bold: true,
    face: FONT.title,
    align: "center",
    role: "closing line",
  });
}

const slideRenderers = [
  slide1,
  slide2,
  slide3,
  slide4,
  slide5,
  slide6,
  slide7,
  slide8,
  slide9,
  slide10,
  slide11,
  slide12,
  slide13,
  slide14,
  slide15,
  slide16,
  slide17,
  slide18,
  slide19,
  slide20,
  slide21,
  slide22,
  slide23,
  slide24,
];

async function saveBlob(blob, filePath) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  await fs.mkdir(VERIFY_DIR, { recursive: true });
}

async function renderPreviews(presentation) {
  const paths = [];
  for (let i = 0; i < presentation.slides.items.length; i += 1) {
    const slide = presentation.slides.items[i];
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    const filePath = path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await saveBlob(png, filePath);
    paths.push(filePath);
  }
  return paths;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function shapeText(shapeXml) {
  const parts = [...shapeXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]).trim());
  return parts.join(" ").replace(/\s+/g, " ").trim().toUpperCase();
}

function linkForText(text) {
  if (SECTION_TARGETS[text]) return SECTION_TARGETS[text];
  if (text.startsWith("AGENDA ")) return SECTION_TARGETS.AGENDA;
  if (text.startsWith("FOUNDATIONS ")) return SECTION_TARGETS.FOUNDATIONS;
  if (text.startsWith("DEMOS ")) return SECTION_TARGETS.DEMOS;
  if (text.startsWith("STACK ")) return SECTION_TARGETS.STACK;
  if (text.startsWith("GOVERNANCE ")) return SECTION_TARGETS.GOVERNANCE;
  if (text.startsWith("ROADMAP ")) return SECTION_TARGETS.ROADMAP;
  return null;
}

async function patchInteractiveLinks(pptxPath) {
  const bytes = await fs.readFile(pptxPath);
  const zip = await JSZip.loadAsync(bytes);
  for (let slideNo = 1; slideNo <= slides.length; slideNo += 1) {
    const slidePath = `ppt/slides/slide${slideNo}.xml`;
    const relPath = `ppt/slides/_rels/slide${slideNo}.xml.rels`;
    const file = zip.file(slidePath);
    if (!file) continue;
    let xml = await file.async("string");
    let relXml = zip.file(relPath)
      ? await zip.file(relPath).async("string")
      : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    let relCounter = 900;
    xml = xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (shape) => {
      const text = shapeText(shape);
      const target = linkForText(text);
      if (!target || target === slideNo) return shape;
      const relId = `rIdNav${relCounter++}`;
      const rel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${target}.xml"/>`;
      relXml = relXml.replace("</Relationships>", `${rel}</Relationships>`);
      if (shape.includes("<a:hlinkClick")) return shape;
      return shape.replace(/<p:cNvPr([^>]*?)\/>/, `<p:cNvPr$1><a:hlinkClick r:id="${relId}" action="ppaction://hlinksldjump"/></p:cNvPr>`)
        .replace(/(<p:cNvPr\b[^>]*>)([\s\S]*?<\/p:cNvPr>)/, `$1<a:hlinkClick r:id="${relId}" action="ppaction://hlinksldjump"/>$2`);
    });
    zip.file(slidePath, xml);
    zip.file(relPath, relXml);
  }
  const patched = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(pptxPath, patched);
}

async function writeInspection(presentation, previewPaths, pptxPath) {
  const records = [
    { kind: "deck", id: DECK_ID, slideCount: presentation.slides.count, pptxPath },
    ...inspectRecords,
    { kind: "previews", paths: previewPaths },
  ];
  await fs.writeFile(INSPECT_PATH, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}

async function build() {
  await ensureDirs();
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  presentation.theme.colorScheme = {
    name: "AI Workshop",
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
  for (const renderer of slideRenderers) renderer(presentation);
  const previewPaths = await renderPreviews(presentation);
  const blob = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(OUT_DIR, "AI_Workshop_Showcase_PowerPoint_Safe.pptx");
  await blob.save(pptxPath);
  await writeInspection(presentation, previewPaths, pptxPath);
  console.log(pptxPath);
}

await build();
