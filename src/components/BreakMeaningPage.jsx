import React from "react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import { HERO_CONTENT, BREAK_VALUES, STANDARD_SECTION, CLOSING_STATEMENT } from "../utils/breakBrandContent.js";

// Brand/identity page — not a settings or workout screen. Explains what B.R.E.A.K. stands for
// and the philosophy behind it. Reached only from More → B.R.E.A.K. Meaning (and optionally the
// More brand card); it does not live in the permanent bottom navigation.
//
// All wording renders from src/utils/breakBrandContent.js — update that file, not this one, when
// the official brand copy is finalized. Typography uses the font-brk-display/heading/body
// Tailwind utilities (wired to CSS vars in index.css) so the brand font can be swapped centrally
// later without touching this page's structure.

function LetterCard({ value }) {
  const Icon = value.icon;
  return (
    <div className="border border-white/10 bg-v5-elevated px-4 py-4 flex items-start gap-4">
      <div className="font-brk-display text-4xl sm:text-5xl font-black leading-none text-v5-red shrink-0 w-10 sm:w-12 text-center">
        {value.letter}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="font-brk-heading text-sm font-bold uppercase tracking-widest text-white">{value.word}</div>
          {Icon && <Icon size={18} className="text-red-700/70 shrink-0 mt-0.5" aria-hidden="true" />}
        </div>
        <p className="font-brk-body text-sm text-v5-subtext mt-1.5 leading-relaxed">{value.description}</p>
      </div>
    </div>
  );
}

export default function BreakMeaningPage({ onBack, logoSrc }) {
  return (
    <SlideInPanel title="B.R.E.A.K. Meaning" onBack={onBack}>
      <div className="-mt-4 space-y-8 pb-6">
        {/* Hero */}
        <div className="text-center px-2 pt-2 pb-6 border-b border-white/10">
          {logoSrc && (
            <img
              src={logoSrc}
              alt="B.R.E.A.K. logo"
              className="w-14 h-14 rounded-full object-cover ring-1 ring-red-700/60 mx-auto mb-4"
            />
          )}
          <div className="font-brk-heading text-[11px] font-bold uppercase tracking-[0.35em] text-v5-subtext">
            {HERO_CONTENT.eyebrow}
          </div>
          <div className="font-brk-display text-3xl sm:text-4xl font-black tracking-tight text-white mt-2 break-words">
            {HERO_CONTENT.title}
          </div>
          <div className="font-brk-heading text-sm font-bold uppercase tracking-[0.3em] text-v5-red mt-1.5">
            {HERO_CONTENT.subtitle}
          </div>
          <p className="font-brk-body text-sm text-v5-subtext mt-5 max-w-xs mx-auto leading-relaxed whitespace-pre-line">
            {HERO_CONTENT.quote}
          </p>
        </div>

        {/* Letter cards */}
        <div className="space-y-3">
          {BREAK_VALUES.map((value) => (
            <LetterCard key={value.letter} value={value} />
          ))}
        </div>

        {/* The Standard */}
        <div className="px-1 pt-2 border-t border-white/10">
          <div className="text-[11px] uppercase tracking-widest text-v5-red mb-3 pt-6">{STANDARD_SECTION.heading}</div>
          <p className="font-brk-body text-sm text-v5-text/90 leading-relaxed whitespace-pre-line">{STANDARD_SECTION.body}</p>
        </div>

        {/* Closing statement */}
        <div className="text-center px-2 pt-4 pb-2">
          <div className="font-brk-display text-lg sm:text-xl font-black uppercase tracking-wide text-white leading-snug">
            {CLOSING_STATEMENT}
          </div>
        </div>
      </div>
    </SlideInPanel>
  );
}
