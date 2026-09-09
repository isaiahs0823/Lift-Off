import React, { useState } from "react";
import { Pencil } from "lucide-react";

// Beyond this many characters a note is treated as "extremely long" (task section 7) — capped
// to a scrollable max-height behind "Show more" so one outlier note can't push everything below
// it off a screenshot, while any normal-length note (including a full multi-line paragraph)
// always renders in full, uncollapsed.
const LONG_NOTE_CHAR_THRESHOLD = 400;

// Session-level free-text note, shown on the completed workout recap and Workout History detail
// (task: "add visible workout notes"). Audited first: no session-wide note field existed before
// this — only per-exercise `exerciseNotes` and per-set `jointNote`/pain notes, both scoped to one
// exercise, not the whole session. So this is the first and only session-wide note field, stored
// as a flat `note` string directly on the session record — the same shape `session.rating`
// already uses — rather than a second, competing notes system.
//
// `onSave` is optional: pass it to allow inline add/edit (task section 5, "if easy to add safely");
// omit it for a strictly read-only render. Editing is a plain inline textarea, never a modal or
// accordion, so the note is always visible without an extra tap (the one hard rule this task set).
//
// `boxed` switches the outer wrapper between two host contexts: false (default) is a plain
// top-divider, for sitting as one more subsection inside an existing bordered Card (Session
// Complete's recap card); true gives it its own bordered/elevated box, matching the standalone
// sibling sections Workout History's detail screen already uses for PRs/Coach review/etc.
export default function WorkoutNotesSection({ session, onSave, boxed = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.note || "");
  const [expanded, setExpanded] = useState(false);

  const note = typeof session.note === "string" ? session.note.trim() : "";
  const isLong = note.length > LONG_NOTE_CHAR_THRESHOLD;
  const wrapperClass = boxed ? "border border-white/10 bg-v5-elevated p-4" : "border-t border-white/[0.06] pt-3";

  if (editing) {
    return (
      <div className={`${wrapperClass} space-y-2`}>
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">Workout notes</div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="How did this session feel? Anything worth remembering next time?"
          rows={4}
          autoFocus
          className="w-full bg-v5-muted rounded-lg text-v5-text px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-v5-red placeholder:text-v5-subtext/50 resize-y"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onSave(draft.trim());
              setEditing(false);
            }}
            className="flex-1 py-2 rounded-lg text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:opacity-90"
          >
            Save
          </button>
          <button
            onClick={() => {
              setDraft(note);
              setEditing(false);
            }}
            className="px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold bg-v5-elevated text-v5-subtext hover:text-v5-text"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    // Default preference (task section 4): hide entirely when empty — no empty card. The one
    // exception is this compact text-only prompt, shown only when a save handler actually exists
    // (otherwise there'd be no way to ever create a note from this screen).
    if (!onSave) return null;
    return (
      <div className={wrapperClass}>
        <button
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          className="text-[11px] uppercase tracking-widest font-bold text-v5-subtext hover:text-v5-red"
        >
          + Add workout note
        </button>
      </div>
    );
  }

  return (
    <div className={`${wrapperClass} space-y-1.5`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">Workout notes</div>
        {onSave && (
          <button
            onClick={() => {
              setDraft(note);
              setEditing(true);
            }}
            className="shrink-0 flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold text-v5-subtext hover:text-v5-red"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>
      <div
        className={`text-sm text-v5-text/90 leading-relaxed whitespace-pre-line break-words ${
          isLong && !expanded ? "max-h-32 overflow-hidden" : ""
        }`}
      >
        {note}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[11px] uppercase tracking-widest font-bold text-v5-red hover:opacity-80"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
