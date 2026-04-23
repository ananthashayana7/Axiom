$ErrorActionPreference = "Stop"

$InputPptx = "C:\Users\anantha.shayana\Downloads\AI_Workshop_Interactive_Showcase.pptx"
$WorkspaceOut = "C:\Axiom\Axiom\workshop\ai-workshop-april-28-2026\outputs\ai-workshop-project-mapped\AI_Workshop_Project_Mapped_Showcase_Final.pptx"
$RootOut = "C:\Axiom\Axiom\AI_Workshop_Project_Mapped_Showcase.pptx"
$DownloadsOut = "C:\Users\anantha.shayana\Downloads\AI_Workshop_Project_Mapped_Showcase.pptx"

$Colors = @{
  Ink = "#111827"
  Ink2 = "#243041"
  Muted = "#64748B"
  Faint = "#E5E7EB"
  Paper = "#F7F8F5"
  White = "#FFFFFF"
  Teal = "#10A37F"
  Blue = "#2563EB"
  Gold = "#D69E2E"
  Coral = "#E76F51"
  Purple = "#7C3AED"
  Green = "#22A06B"
  Slate = "#334155"
}

$MsoTrue = -1
$MsoFalse = 0
$ppLayoutBlank = 12
$msoTextOrientationHorizontal = 1
$msoShapeRectangle = 1
$msoShapeRoundedRectangle = 5
$msoShapeOval = 9
$msoShapeRightArrow = 33
$msoAlignLeft = 1
$msoAlignCenter = 2

function Convert-HexToRgbValue {
  param([string]$Hex)
  $clean = $Hex.TrimStart("#")
  $r = [Convert]::ToInt32($clean.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($clean.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($clean.Substring(4, 2), 16)
  return $r + ($g * 256) + ($b * 65536)
}

function Initialize-Scale {
  param([object]$Deck)
  $script:ScaleX = [double]$Deck.PageSetup.SlideWidth / 1280.0
  $script:ScaleY = [double]$Deck.PageSetup.SlideHeight / 720.0
}

function X { param([double]$Value) return $Value * $script:ScaleX }
function Y { param([double]$Value) return $Value * $script:ScaleY }
function F {
  param([double]$Value)
  $scaled = $Value * $script:ScaleY
  if ($scaled -lt 7.6) { return 7.6 }
  return $scaled
}

function Add-ShapeBox {
  param(
    [object]$Slide,
    [int]$Type,
    [double]$Left,
    [double]$Top,
    [double]$Width,
    [double]$Height,
    [string]$Fill,
    [string]$Line = "",
    [double]$LineWeight = 0
  )
  $shapeLeft = [single](X $Left)
  $shapeTop = [single](Y $Top)
  $shapeWidth = [single]([Math]::Max(1.0, (X $Width)))
  $shapeHeight = [single]([Math]::Max(1.0, (Y $Height)))
  $shape = $Slide.Shapes.AddShape($Type, $shapeLeft, $shapeTop, $shapeWidth, $shapeHeight)
  if ($Fill -eq "" -or $Fill -eq "transparent") {
    $shape.Fill.Visible = $MsoFalse
  } else {
    $shape.Fill.Visible = $MsoTrue
    $shape.Fill.ForeColor.RGB = Convert-HexToRgbValue $Fill
  }
  if ($Line -eq "" -or $LineWeight -le 0) {
    $shape.Line.Visible = $MsoFalse
  } else {
    $shape.Line.Visible = $MsoTrue
    $shape.Line.ForeColor.RGB = Convert-HexToRgbValue $Line
    $shape.Line.Weight = [Math]::Max(0.5, (Y $LineWeight))
  }
  return $shape
}

function Add-TextBox {
  param(
    [object]$Slide,
    [string]$Text,
    [double]$Left,
    [double]$Top,
    [double]$Width,
    [double]$Height,
    [double]$Size = 18,
    [string]$Color = "#111827",
    [bool]$Bold = $false,
    [string]$Font = "Lato",
    [int]$Align = 1
  )
  $boxLeft = [single](X $Left)
  $boxTop = [single](Y $Top)
  $boxWidth = [single]([Math]::Max(4.0, (X $Width)))
  $boxHeight = [single]([Math]::Max(8.0, (Y $Height)))
  $box = $Slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $boxLeft, $boxTop, $boxWidth, $boxHeight)
  $box.Fill.Visible = $MsoFalse
  $box.Line.Visible = $MsoFalse
  $box.TextFrame2.MarginLeft = 0
  $box.TextFrame2.MarginRight = 0
  $box.TextFrame2.MarginTop = 0
  $box.TextFrame2.MarginBottom = 0
  $box.TextFrame2.WordWrap = $MsoTrue
  $box.TextFrame2.TextRange.Text = $Text
  $box.TextFrame2.TextRange.Font.Name = $Font
  $box.TextFrame2.TextRange.Font.Size = F $Size
  $box.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = Convert-HexToRgbValue $Color
  $box.TextFrame2.TextRange.Font.Bold = $(if ($Bold) { $MsoTrue } else { $MsoFalse })
  $box.TextFrame2.TextRange.ParagraphFormat.Alignment = $Align
  return $box
}

function Add-Pill {
  param([object]$Slide, [string]$Text, [double]$Left, [double]$Top, [double]$Width, [double]$Height, [string]$Color, [double]$Size = 10)
  Add-ShapeBox $Slide $msoShapeRoundedRectangle $Left $Top $Width $Height $Color $Color 0 | Out-Null
  Add-TextBox $Slide $Text ($Left + 10) ($Top + 5) ($Width - 20) ($Height - 7) $Size $Colors.White $true "Aptos Mono" $msoAlignCenter | Out-Null
}

function Add-TopNav {
  param([object]$Slide)
  $items = @("HOME", "FOUNDATIONS", "DEMOS", "STACK", "GOVERNANCE", "ROADMAP", "PROJECT MAP")
  $x = 70
  foreach ($item in $items) {
    $width = if ($item -eq "PROJECT MAP") { 126 } else { ($item.Length * 9 + 28) }
    $fill = if ($item -eq "PROJECT MAP") { $Colors.Teal } else { "transparent" }
    $line = if ($item -eq "PROJECT MAP") { $Colors.Teal } else { $Colors.Faint }
    $textColor = if ($item -eq "PROJECT MAP") { $Colors.White } else { $Colors.Muted }
    Add-ShapeBox $Slide $msoShapeRoundedRectangle $x 28 $width 28 $fill $line 1 | Out-Null
    Add-TextBox $Slide $item ($x + 9) 35 ($width - 18) 12 9.5 $textColor $true "Aptos Mono" $msoAlignCenter | Out-Null
    $x += $width + 10
  }
}

function Add-Footer {
  param([object]$Slide, [int]$SlideNumber)
  Add-ShapeBox $Slide $msoShapeRectangle 70 638 1140 1.2 $Colors.Faint $Colors.Faint 0 | Out-Null
  Add-TextBox $Slide ("PROJECT MAP  -  {0:00} / 24" -f $SlideNumber) 70 654 420 22 11 $Colors.Muted $true "Aptos Mono" $msoAlignLeft | Out-Null
}

function Add-Title {
  param([object]$Slide, [string]$Title, [string]$Subtitle)
  Add-TextBox $Slide $Title 70 82 1040 58 35 $Colors.Ink $true "Poppins" $msoAlignLeft | Out-Null
  Add-TextBox $Slide $Subtitle 72 142 1040 42 16 $Colors.Ink2 $false "Lato" $msoAlignLeft | Out-Null
}

function Add-Card {
  param([object]$Slide, [double]$Left, [double]$Top, [double]$Width, [double]$Height, [string]$Title, [string]$Body, [string]$Color)
  Add-ShapeBox $Slide $msoShapeRoundedRectangle $Left $Top $Width $Height $Colors.White "#D7E0EA" 1 | Out-Null
  Add-ShapeBox $Slide $msoShapeRectangle $Left $Top $Width 7 $Color $Color 0 | Out-Null
  Add-TextBox $Slide $Title ($Left + 18) ($Top + 20) ($Width - 36) 26 16 $Color $true "Poppins" $msoAlignLeft | Out-Null
  Add-TextBox $Slide $Body ($Left + 18) ($Top + 54) ($Width - 36) ($Height - 64) 12.8 $Colors.Ink2 $false "Lato" $msoAlignLeft | Out-Null
}

function Add-MiniCard {
  param([object]$Slide, [double]$Left, [double]$Top, [double]$Width, [double]$Height, [string]$Title, [string[]]$Bullets, [string]$Color)
  Add-ShapeBox $Slide $msoShapeRoundedRectangle $Left $Top $Width $Height $Colors.White "#D7E0EA" 1 | Out-Null
  $pillWidth = [Math]::Min(($Width - 28), ($Title.Length * 8 + 42))
  Add-Pill $Slide $Title ($Left + 14) ($Top + 14) $pillWidth 28 $Color 10
  $body = ($Bullets | ForEach-Object { "- $_" }) -join "`r"
  Add-TextBox $Slide $body ($Left + 18) ($Top + 58) ($Width - 36) ($Height - 68) 12 $Colors.Ink2 $false "Lato" $msoAlignLeft | Out-Null
}

function Add-FlowNode {
  param([object]$Slide, [double]$Left, [double]$Top, [double]$Width, [double]$Height, [string]$Label, [string]$Detail, [string]$Color)
  Add-ShapeBox $Slide $msoShapeRoundedRectangle $Left $Top $Width $Height $Colors.White "#D7E0EA" 1 | Out-Null
  Add-ShapeBox $Slide $msoShapeOval ($Left + 14) ($Top + 18) 28 28 $Color $Color 0 | Out-Null
  Add-TextBox $Slide $Label ($Left + 52) ($Top + 16) ($Width - 64) 22 13.5 $Color $true "Poppins" $msoAlignLeft | Out-Null
  Add-TextBox $Slide $Detail ($Left + 18) ($Top + 52) ($Width - 36) ($Height - 64) 11.2 $Colors.Ink2 $false "Lato" $msoAlignLeft | Out-Null
}

function Add-Arrow {
  param([object]$Slide, [double]$Left, [double]$Top, [double]$Width)
  Add-ShapeBox $Slide $msoShapeRightArrow $Left ($Top - 8) $Width 16 $Colors.Faint $Colors.Faint 0 | Out-Null
}

function New-MappingSlide {
  param([object]$Deck, [int]$SlideNumber, [string]$Title, [string]$Subtitle)
  $slide = $Deck.Slides.Add(($Deck.Slides.Count + 1), $ppLayoutBlank)
  $slide.FollowMasterBackground = $MsoFalse
  $slide.Background.Fill.ForeColor.RGB = Convert-HexToRgbValue $Colors.Paper
  Add-ShapeBox $slide $msoShapeOval -100 -120 320 320 "#E9F7F2" "" 0 | Out-Null
  Add-ShapeBox $slide $msoShapeOval 1090 500 260 260 "#F7EED8" "" 0 | Out-Null
  Add-TopNav $slide
  Add-Footer $slide $SlideNumber
  Add-Title $slide $Title $Subtitle
  return $slide
}

function Update-ControlRoomTip {
  param([object]$Deck)
  $replacement = "Tip: use slideshow mode - use this control room as your navigation cue."
  foreach ($slide in $Deck.Slides) {
    foreach ($shape in $slide.Shapes) {
      try {
        if ($shape.HasTextFrame -eq $MsoTrue -and $shape.TextFrame2.HasText -eq $MsoTrue) {
          $text = $shape.TextFrame2.TextRange.Text
          if ($text -like "Tip: use slideshow mode*") {
            $shape.TextFrame2.TextRange.Text = $replacement
          }
        }
      } catch {
        continue
      }
    }
  }
}

function Add-Slide19 {
  param([object]$Deck)
  $slide = New-MappingSlide $Deck 19 "Project Mapping Overview" "Use this section to convert the workshop from a generic AI talk into proof from our own software work."
  $projects = @(
    @{Name="Axiom"; Subtitle="Procurement intelligence"; Color=$Colors.Blue; Bullets=@("Agents, supplier risk, demand forecast", "Invoice OCR, SAP/API route, audit export", "Next.js, Postgres, Redis queues, Azure stack"); Tag="business AI"},
    @{Name="Mastiff"; Subtitle="Conversational data analyst"; Color=$Colors.Teal; Bullets=@("CSV/Excel/JSON/Parquet ingestion", "LLM-to-Python sandbox execution", "Charts, report export, sessions, connectors"); Tag="data AI"},
    @{Name="OEE Box"; Subtitle="Industrial edge AI"; Color=$Colors.Gold; Bullets=@("MQTT, Modbus, OPC-UA machine data", "Local RAG, schema inference, trust score", "RL shadow agent and command gatekeeper"); Tag="edge AI"}
  )
  for ($i = 0; $i -lt $projects.Count; $i++) {
    $p = $projects[$i]
    $x = 70 + ($i * 390)
    Add-ShapeBox $slide $msoShapeRoundedRectangle $x 218 350 312 $Colors.White "#D7E0EA" 1 | Out-Null
    Add-ShapeBox $slide $msoShapeRectangle $x 218 350 8 $p.Color $p.Color 0 | Out-Null
    Add-TextBox $slide $p.Name ($x + 22) 246 180 28 21 $p.Color $true "Poppins" $msoAlignLeft | Out-Null
    Add-TextBox $slide $p.Subtitle ($x + 22) 278 270 24 12.8 $Colors.Muted $true "Aptos Mono" $msoAlignLeft | Out-Null
    $body = ($p.Bullets | ForEach-Object { "- $_" }) -join "`r"
    Add-TextBox $slide $body ($x + 26) 326 296 102 13 $Colors.Ink2 $false "Lato" $msoAlignLeft | Out-Null
    Add-Pill $slide $p.Tag ($x + 22) 454 126 30 $p.Color 10
    Add-Pill $slide "demo proof" ($x + 162) 454 116 30 $Colors.Ink 10
  }
  Add-Card $slide 220 562 840 58 "Talk track" "The workshop pillars are not theoretical: these projects cover business agents, data analysis, retrieval, predictive ML, edge telemetry, APIs, jobs, storage, security controls, and live software delivery." $Colors.Teal
}

function Add-Slide20 {
  param([object]$Deck)
  $slide = New-MappingSlide $Deck 20 "Axiom: Procurement Intelligence Proof" "Maps to business AI, agentic workflows, document intelligence, API integration, cloud architecture, and engineering maturity."
  Add-MiniCard $slide 70 218 344 204 "Implemented product surface" @("Dashboards for orders, RFQs, suppliers, spend analytics", "Supplier risk scoring and operational intelligence", "Admin/user management, support tickets, exports", "Procurement workflows with structured review surfaces") $Colors.Blue
  Add-MiniCard $slide 468 218 344 204 "AI and automation layer" @("Agent registry and orchestrator with typed inputs", "Demand forecasting, fraud detection, payment optimizer", "Contract clause analyzer and negotiation autopilot", "Smart approval routing and bottleneck prediction") $Colors.Teal
  Add-MiniCard $slide 866 218 344 204 "Production software stack" @("Next.js, React, Drizzle ORM, PostgreSQL, NextAuth", "Google Generative AI, Azure Blob, Redis, BullMQ", "Zod validation, telemetry, rate limiting, audit exports", "Smoke, unit, and integration tests for release safety") $Colors.Purple
  $nodes = @(
    @("UX", "Dashboards, chat, admin", $Colors.Blue),
    @("API", "Routes, auth, validation", $Colors.Teal),
    @("Agents", "Planner and tools", $Colors.Purple),
    @("Data", "Postgres, Blob, Redis", $Colors.Gold),
    @("Ops", "Jobs, audit, telemetry", $Colors.Coral)
  )
  for ($i = 0; $i -lt $nodes.Count; $i++) {
    $x = 80 + ($i * 235)
    Add-FlowNode $slide $x 486 168 82 $nodes[$i][0] $nodes[$i][1] $nodes[$i][2]
    if ($i -lt ($nodes.Count - 1)) { Add-Arrow $slide ($x + 174) 527 42 }
  }
}

function Add-Slide21 {
  param([object]$Deck)
  $slide = New-MappingSlide $Deck 21 "Mastiff: Conversational Data Analyst Proof" "Maps to natural-language analytics, file ingestion, safe code execution, charts, exports, and enterprise data connectors."
  $steps = @(
    @("Upload", "CSV, Excel, JSON, Parquet", $Colors.Blue),
    @("Profile", "Schema, sample rows, metadata", $Colors.Teal),
    @("Plan", "LLM creates analysis plan and Python", $Colors.Purple),
    @("Execute", "Sandboxed pandas, numpy, matplotlib", $Colors.Gold),
    @("Explain", "Charts, narrative insight, export", $Colors.Green)
  )
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $x = 74 + ($i * 236)
    Add-FlowNode $slide $x 230 166 110 $steps[$i][0] $steps[$i][1] $steps[$i][2]
    if ($i -lt ($steps.Count - 1)) { Add-Arrow $slide ($x + 174) 285 42 }
  }
  Add-MiniCard $slide 90 398 330 144 "API and app surfaces" @("Upload, preview, metadata, delete endpoints", "Chat message, history, regenerate endpoints", "Visualization and report export endpoints") $Colors.Teal
  Add-MiniCard $slide 475 398 330 144 "Safety and reliability" @("Never execute user code directly", "Docker or restricted execution boundary", "Timeouts, file limits, no internet, rate limits") $Colors.Coral
  Add-MiniCard $slide 860 398 330 144 "Enterprise expansion" @("SharePoint, Drive, Snowflake, BigQuery, Postgres", "pgvector semantic memory and shared workspaces", "Scheduled reports, SSO/SAML, audit logs") $Colors.Purple
  Add-Card $slide 222 570 836 50 "Workshop proof" "Files become schema, schema becomes executable code, execution becomes visual insight, and insight becomes an exportable artifact." $Colors.Teal
}

function Add-Slide22 {
  param([object]$Deck)
  $slide = New-MappingSlide $Deck 22 "OEE Box: Edge AI + Industrial Intelligence Proof" "Maps to edge telemetry, local retrieval, machine reasoning, data trust, RL shadow mode, and safe command execution."
  $flow = @(
    @("Signals", "MQTT, Modbus, OPC-UA, simulator", $Colors.Blue),
    @("Trust", "Sanitize readings, score confidence", $Colors.Teal),
    @("Reason", "OEE calculator, schema inference", $Colors.Purple),
    @("Assist", "Manual RAG, copilot, offline fallback", $Colors.Gold),
    @("Act", "RL shadow suggestions, gatekeeper", $Colors.Coral)
  )
  for ($i = 0; $i -lt $flow.Count; $i++) {
    $x = 74 + ($i * 236)
    Add-FlowNode $slide $x 222 166 118 $flow[$i][0] $flow[$i][1] $flow[$i][2]
    if ($i -lt ($flow.Count - 1)) { Add-Arrow $slide ($x + 174) 281 42 }
  }
  Add-MiniCard $slide 70 402 270 142 "Semantic copilot" @("Local RAG over manuals and safety protocols", "FAISS with Sentence Transformers", "LLM answers operator questions with context") $Colors.Teal
  Add-MiniCard $slide 372 402 270 142 "Autonomous intelligence" @("RL agent observes and simulates in shadow mode", "Virtual sensors infer missing machine states", "Predictive health roadmap with RUL models") $Colors.Purple
  Add-MiniCard $slide 674 402 270 142 "Safety-by-design" @("Command gatekeeper before machine action", "Offline heuristic fallback when AI is unavailable", "Audit trace from signal to suggestion") $Colors.Coral
  Add-MiniCard $slide 976 402 234 142 "Real-time stack" @("FastAPI, SQLite async, WebSockets", "React, Vite, MUI dashboard", "Docker Compose edge deployment") $Colors.Gold
  Add-Card $slide 238 574 804 46 "Workshop proof" "It reads industrial signals, reasons locally, explains machine behavior, and gates every optimization before action." $Colors.Gold
}

function Add-Slide23 {
  param([object]$Deck)
  $slide = New-MappingSlide $Deck 23 "Slide-by-Slide Talking Map" "Use this as the presenter cheat sheet: theme first, project proof second, technical competency third."
  Add-ShapeBox $slide $msoShapeRoundedRectangle 82 222 1116 344 $Colors.White "#D7E0EA" 1 | Out-Null
  Add-TextBox $slide "Workshop theme" 112 246 210 20 12 $Colors.Muted $true "Aptos Mono" $msoAlignLeft | Out-Null
  Add-TextBox $slide "Project proof line" 356 246 610 20 12 $Colors.Muted $true "Aptos Mono" $msoAlignLeft | Out-Null
  Add-TextBox $slide "Competency" 1000 246 150 20 12 $Colors.Muted $true "Aptos Mono" $msoAlignCenter | Out-Null
  $rows = @(
    @("Capability map", "Axiom = business AI; Mastiff = data AI; OEE Box = edge AI", $Colors.Blue, "RAG"),
    @("RAG pipeline", "OEE manuals copilot; Axiom evidence-grounded answers and audit posture", $Colors.Teal, "RAG"),
    @("Document intelligence", "Axiom invoice OCR/upload routes; Mastiff file parsing and schema extraction", $Colors.Purple, "ML/data"),
    @("Predictive ML", "Axiom demand forecast and supplier scoring; OEE RL/predictive health roadmap", $Colors.Gold, "ML/data"),
    @("Agentic workflow", "Axiom agent orchestrator; OEE command gatekeeper; Mastiff sandboxed code tool", $Colors.Coral, "APIs"),
    @("API topology", "SAP/API routes, cron jobs, queues, email, Blob, Redis, Postgres, MQTT", $Colors.Green, "APIs"),
    @("Developer intelligence", "Next.js, React, FastAPI, Docker, typed validation, tests, telemetry", $Colors.Slate, "code")
  )
  for ($i = 0; $i -lt $rows.Count; $i++) {
    $y = 284 + ($i * 38)
    Add-ShapeBox $slide $msoShapeRectangle 102 ($y - 8) 1068 1 "#EEF2F7" "#EEF2F7" 0 | Out-Null
    Add-Pill $slide $rows[$i][0] 112 $y 190 24 $rows[$i][2] 9.2
    Add-TextBox $slide $rows[$i][1] 356 ($y + 2) 580 22 12.2 $Colors.Ink2 $false "Lato" $msoAlignLeft | Out-Null
    Add-TextBox $slide $rows[$i][3] 1004 ($y + 2) 140 20 11 $rows[$i][2] $true "Aptos Mono" $msoAlignCenter | Out-Null
  }
  Add-Card $slide 180 590 920 42 "Presenter rhythm" "For every concept slide, say: here is the pattern, here is where we used it, here is the engineering control that makes it reliable." $Colors.Teal
}

function Add-Slide24 {
  param([object]$Deck)
  $slide = New-MappingSlide $Deck 24 "Live Demo Run Sheet" "A practical path for the seven-hour workshop: show breadth, then show code-level and system-level depth."
  Add-MiniCard $slide 86 222 338 184 "Axiom business AI" @("Open dashboard or supplier view", "Show risk/forecast/agent recommendation", "Point to audit, queue, API, validation path") $Colors.Blue
  Add-MiniCard $slide 484 222 338 184 "Mastiff data analyst" @("Upload a dataset", "Ask a natural-language question", "Inspect generated Python, chart, and export") $Colors.Teal
  Add-MiniCard $slide 882 222 338 184 "OEE Box edge AI" @("Simulate machine telemetry", "Ask why OEE dropped", "Show RAG answer, trust score, gatekeeper") $Colors.Gold
  Add-ShapeBox $slide $msoShapeRoundedRectangle 120 452 1040 84 $Colors.Ink $Colors.Ink 0 | Out-Null
  Add-TextBox $slide "Closing proof statement" 154 474 260 20 12 "#CBD5E1" $true "Aptos Mono" $msoAlignLeft | Out-Null
  Add-TextBox $slide "We are not only prompting models. We are connecting AI to data, APIs, workflows, jobs, security controls, tests, dashboards, and measurable business outcomes." 154 498 960 28 18 $Colors.White $true "Poppins" $msoAlignLeft | Out-Null
  Add-MiniCard $slide 146 570 282 52 "Breadth" @("LLMs, RAG, ML, agents, vision-ready flows") $Colors.Blue
  Add-MiniCard $slide 498 570 282 52 "Depth" @("Full-stack apps, APIs, queues, data, cloud") $Colors.Teal
  Add-MiniCard $slide 850 570 282 52 "Maturity" @("Guardrails, audit, tests, telemetry, fallbacks") $Colors.Coral
}

foreach ($target in @($WorkspaceOut, $RootOut, $DownloadsOut)) {
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Force
  }
}

$ppt = $null
$deck = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.DisplayAlerts = 1
  $ppt.Visible = $MsoTrue
  $deck = $ppt.Presentations.Open($InputPptx, $MsoTrue, $MsoFalse, $MsoFalse)
  Initialize-Scale $deck
  Update-ControlRoomTip $deck

  Add-Slide19 $deck
  Add-Slide20 $deck
  Add-Slide21 $deck
  Add-Slide22 $deck
  Add-Slide23 $deck
  Add-Slide24 $deck

  if ($deck.Slides.Count -ne 24) {
    throw "Expected 24 slides after append, got $($deck.Slides.Count)"
  }

  $deck.SaveAs($WorkspaceOut)
  $deck.SaveCopyAs($RootOut)
  $deck.SaveCopyAs($DownloadsOut)
  Write-Output "Slides=$($deck.Slides.Count)"
  Write-Output $DownloadsOut
} finally {
  if ($deck -ne $null) {
    $deck.Close() | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($deck) | Out-Null
  }
  if ($ppt -ne $null) {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
