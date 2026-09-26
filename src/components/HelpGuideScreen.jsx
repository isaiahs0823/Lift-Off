import React, { useMemo, useState } from "react";
import { Search, X, Download, Mail, Info, ChevronRight } from "lucide-react";
import { HELP_SECTIONS, searchHelpSections } from "../content/helpGuide.js";
import { APP_VERSION, BUILD_ID, BUILD_TIME } from "../utils/appVersion.js";
import { SlideInPanel } from "./SlideInPanel.jsx";
import { ListRow, SectionLabel } from "./ui/Kit.jsx";

// Renders one content block from src/content/helpGuide.js — the only place that needs to know
// about block shapes, so adding a new block type is a one-line addition here, never a change to
// how sections are listed, searched, or navigated (see that file's own header comment).
function Block({ block, index }) {
  switch (block.type) {
    case "p":
      return <p className="text-sm text-v5-text/90 leading-relaxed">{block.text}</p>;
    case "h":
      return <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold pt-1">{block.text}</div>;
    case "callout":
      return (
        <div className="border border-v5-red/25 bg-v5-red/10 text-sm text-v5-text px-3 py-2.5 leading-relaxed">
          {block.text}
        </div>
      );
    case "list":
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="text-sm text-v5-text/90 leading-relaxed flex gap-2">
              <span className="text-v5-red shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="text-sm text-v5-text/90 leading-relaxed flex gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-v5-elevated text-v5-red text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      );
    case "terms":
      return (
        <div className="space-y-2.5">
          {block.items.map((t, i) => (
            <div key={i} className="border-t border-white/[0.06] pt-2.5 first:border-t-0 first:pt-0">
              <div className="text-sm font-bold text-v5-text">{t.term}</div>
              <div className="text-xs text-v5-subtext mt-0.5 leading-relaxed">{t.def}</div>
            </div>
          ))}
        </div>
      );
    case "qa":
      return (
        <div className="space-y-3">
          {block.items.map((qa, i) => (
            <div key={i}>
              <div className="text-sm font-bold text-v5-text">{qa.q}</div>
              <div className="text-xs text-v5-subtext mt-0.5 leading-relaxed">{qa.a}</div>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function HelpArticle({ section, onBack }) {
  return (
    <SlideInPanel title={section.title} subtitle={section.summary} onBack={onBack}>
      {section.content.map((block, i) => (
        <Block key={i} block={block} index={i} />
      ))}
    </SlideInPanel>
  );
}

// Downloadable PDF lives at a plain static route (task: "Do not embed a massive base64 PDF
// inside App.jsx") — public/docs/BRK_Lift_User_Guide_v1.pdf, generated from this same content
// module by scripts/generateUserGuidePdf.mjs, served by Vite exactly as any other static asset.
// A plain <a download> uses the platform's normal open/share/save behavior with no extra code.
const USER_GUIDE_PDF_PATH = "/docs/BRK_Lift_User_Guide_v1.pdf";

// No support inbox/contact channel exists anywhere else in the app yet (checked: no
// settings.supportEmail, no support/contact screen). Per the task's own instruction not to
// invent one, this stays a plain informational row rather than a fake mailto: link — swap the
// body copy for a real channel (email, form, in-app ticket) the moment one exists.
function ContactSupportPanel({ onBack }) {
  return (
    <SlideInPanel title="Contact support" onBack={onBack}>
      <p className="text-sm text-v5-text/90 leading-relaxed">
        A direct support channel isn't set up in this version yet. In the meantime, most questions are answered
        in the guide sections above — search for a keyword if you're not sure where to look.
      </p>
    </SlideInPanel>
  );
}

function AboutPanel({ onBack }) {
  return (
    <SlideInPanel title="About BRK Lift" onBack={onBack}>
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-v5-subtext">Version</span>
          <span className="text-v5-text font-bold tabular-nums">{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-v5-subtext">Build</span>
          <span className="text-v5-text font-bold tabular-nums">{BUILD_ID}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-v5-subtext">Built</span>
          <span className="text-v5-text font-bold tabular-nums">{new Date(BUILD_TIME).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
        </div>
      </div>
      <p className="text-xs text-v5-subtext/70 leading-relaxed pt-1">
        Useful when reporting a bug — it confirms exactly which build you're running.
      </p>
    </SlideInPanel>
  );
}

// Help & Guide home (task: "BRK LIFT HELP & GUIDE"). First-class row from More, one tap deep
// like every other More destination — never buried further. Search + section list here; each
// section opens as its own SlideInPanel article, the same "drill into one thing" pattern used
// everywhere else in the app (swap pickers, exercise history, day detail), so Back behaves
// exactly the way it already does everywhere else.
//
// `screen` is a single piece of state for "which one panel is showing" (home / one article /
// support / about) rather than each row owning its own open/close boolean — that earlier shape
// let Support or About render as a SECOND SlideInPanel stacked on top of the still-mounted home
// list, which put two Back buttons on screen at once and made Back behave unpredictably. One
// screen at a time, exactly like every other drill-down in the app.
export default function HelpGuideScreen({ onBack }) {
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState({ type: "home" });

  const results = useMemo(() => searchHelpSections(query), [query]);

  if (screen.type === "article") {
    const section = HELP_SECTIONS.find((s) => s.id === screen.id);
    return <HelpArticle section={section} onBack={() => setScreen({ type: "home" })} />;
  }
  if (screen.type === "support") {
    return <ContactSupportPanel onBack={() => setScreen({ type: "home" })} />;
  }
  if (screen.type === "about") {
    return <AboutPanel onBack={() => setScreen({ type: "home" })} />;
  }

  return (
    <SlideInPanel title="Help & Guide" subtitle="How BRK works, and what to do when it doesn't" onBack={onBack}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-v5-subtext/70" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help — RIR, machine, history…"
          className="w-full bg-v5-elevated border border-white/10 rounded-lg pl-8 pr-8 py-2.5 text-sm text-v5-text placeholder-neutral-600 focus:border-v5-red focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-v5-subtext/70 hover:text-v5-text/90" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="text-center py-8 text-sm text-v5-subtext">No help articles match "{query}".</div>
      ) : (
        <div className="space-y-1.5">
          {results.map((s) => (
            <ListRow key={s.id} title={s.title} subtitle={s.summary} onClick={() => setScreen({ type: "article", id: s.id })} />
          ))}
        </div>
      )}

      <div className="pt-2 space-y-2">
        <SectionLabel tone="muted">More</SectionLabel>
        <a href={USER_GUIDE_PDF_PATH} download className="block">
          <ListRow icon={Download} title="Download user guide" subtitle="Full guide as a PDF" right={<ChevronRight size={15} className="text-v5-subtext shrink-0" />} />
        </a>
        <ListRow icon={Mail} title="Contact support" subtitle="Get help from the BRK team" onClick={() => setScreen({ type: "support" })} />
        <ListRow icon={Info} title="About BRK Lift" subtitle={`Version ${APP_VERSION}`} onClick={() => setScreen({ type: "about" })} />
      </div>
    </SlideInPanel>
  );
}
