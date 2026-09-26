// Regenerates public/docs/BRK_Lift_User_Guide_v1.pdf from the exact same content module the
// in-app Help & Guide screen reads (src/content/helpGuide.js) — task: "Eventually the PDF can
// be regenerated from the same content source." Run with: node scripts/generateUserGuidePdf.mjs
//
// Deliberately plain formatting (headings, paragraphs, numbered/bulleted lists, term glossaries,
// Q&A) rather than a fully designed layout — the in-app guide is the primary, always-current
// source of truth; this PDF is explicitly supplemental (task section 17).
import PDFKit from "pdfkit";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { HELP_SECTIONS } from "../src/content/helpGuide.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "docs");
const outPath = path.join(outDir, "BRK_Lift_User_Guide_v1.pdf");

await mkdir(outDir, { recursive: true });

const doc = new PDFKit({ size: "LETTER", margins: { top: 60, bottom: 60, left: 64, right: 64 } });
doc.pipe(createWriteStream(outPath));

const RED = "#D2262E";
const TEXT = "#1a1a1a";
const MUTED = "#666666";

function ensureSpace(needed) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function heading(text) {
  ensureSpace(40);
  doc.moveDown(0.6);
  doc.fillColor(RED).fontSize(16).font("Helvetica-Bold").text(text);
  doc.moveDown(0.3);
  doc.fillColor(TEXT);
}

function subheading(text) {
  ensureSpace(24);
  doc.moveDown(0.4);
  doc.fillColor(RED).fontSize(10.5).font("Helvetica-Bold").text(text.toUpperCase(), { characterSpacing: 0.6 });
  doc.moveDown(0.15);
  doc.fillColor(TEXT);
}

function paragraph(text) {
  doc.fontSize(10.5).font("Helvetica").fillColor(TEXT).text(text, { lineGap: 3 });
  doc.moveDown(0.4);
}

function callout(text) {
  ensureSpace(30);
  const boxTop = doc.y;
  doc.fontSize(10.5).font("Helvetica-Bold").fillColor(RED);
  const textHeight = doc.heightOfString(text, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20 });
  doc.rect(doc.page.margins.left, boxTop, doc.page.width - doc.page.margins.left - doc.page.margins.right, textHeight + 16).stroke(RED);
  doc.text(text, doc.page.margins.left + 10, boxTop + 8, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20 });
  doc.y = boxTop + textHeight + 24;
  doc.fillColor(TEXT);
}

function list(items, ordered) {
  items.forEach((item, i) => {
    doc.fontSize(10.5).font("Helvetica").fillColor(TEXT);
    const marker = ordered ? `${i + 1}.` : "•";
    doc.text(`${marker}  ${item}`, { indent: 4, lineGap: 3 });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.25);
}

function terms(items) {
  items.forEach((t) => {
    doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT).text(t.term);
    doc.fontSize(10).font("Helvetica").fillColor(MUTED).text(t.def, { lineGap: 2 });
    doc.moveDown(0.35);
  });
}

function qa(items) {
  items.forEach((pair) => {
    doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT).text(pair.q);
    doc.fontSize(10).font("Helvetica").fillColor(MUTED).text(pair.a, { lineGap: 2 });
    doc.moveDown(0.35);
  });
}

// ---- Cover ----
doc.fillColor(RED).fontSize(28).font("Helvetica-Bold").text("BRK — LIFT", { align: "left" });
doc.fillColor(TEXT).fontSize(18).font("Helvetica-Bold").text("User Guide", { align: "left" });
doc.moveDown(0.3);
doc.fontSize(10).font("Helvetica").fillColor(MUTED).text("Version 1 — this guide covers the current app. The in-app Help & Guide screen (More > Help & Guide) is always the most up to date.");
doc.moveDown(1.2);

// ---- Table of contents ----
doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT).text("Contents");
doc.moveDown(0.2);
HELP_SECTIONS.forEach((s) => {
  doc.fontSize(10).font("Helvetica").fillColor(MUTED).text(s.title);
});

doc.addPage();

// ---- Sections ----
HELP_SECTIONS.forEach((section) => {
  heading(section.title);
  if (section.summary) {
    doc.fontSize(10.5).font("Helvetica-Oblique").fillColor(MUTED).text(section.summary);
    doc.moveDown(0.4);
    doc.fillColor(TEXT);
  }
  section.content.forEach((block) => {
    ensureSpace(20);
    switch (block.type) {
      case "p":
        paragraph(block.text);
        break;
      case "h":
        subheading(block.text);
        break;
      case "callout":
        callout(block.text);
        break;
      case "list":
        list(block.items, false);
        break;
      case "steps":
        list(block.items, true);
        break;
      case "terms":
        terms(block.items);
        break;
      case "qa":
        qa(block.items);
        break;
      default:
        break;
    }
  });
});

doc.end();
console.log(`Wrote ${outPath}`);
