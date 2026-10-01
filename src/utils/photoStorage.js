// ---------------- PROGRESS PHOTO CLOUD SYNC ----------------
// Local photos keep working exactly as before — state.photos[].dataUrl stays the on-device
// copy and is what the Photos screen always renders first. This module only adds a background
// backup/sync path into the private "progress-photos" Storage bucket (see
// supabase_schema_update.sql) when signed in; signed-out behavior is completely unchanged.
import { supabase, supabaseEnabled } from "../lib/supabaseClient.js";

const BUCKET = "progress-photos";

function storagePathFor(userId, photoId) {
  return `${userId}/${photoId}.jpg`;
}

// Uploads any local photo that hasn't been uploaded yet (tracked via the additive
// `syncedToCloud` flag) and records a matching row in the `photos` table. Skips photos that are
// already marked synced, so re-running this after every change is cheap.
export async function pushPhotosToSupabase(photos, userId) {
  if (!supabaseEnabled || !userId || !Array.isArray(photos)) return { ok: false, uploadedIds: [] };
  const pending = photos.filter((p) => p.dataUrl && !p.syncedToCloud);
  const uploadedIds = [];

  for (const photo of pending) {
    try {
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      const path = storagePathFor(userId, photo.id);
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true,
      });
      if (uploadError) continue;
      const { error: rowError } = await supabase
        .from("photos")
        .upsert({ id: photo.id, user_id: userId, date: photo.date, context: photo.context ?? null, storage_path: path }, { onConflict: "id" });
      if (rowError) continue;
      uploadedIds.push(photo.id);
    } catch {
      // Network hiccup on one photo shouldn't block the rest — it just stays unsynced and
      // retries on the next push.
    }
  }

  return { ok: true, uploadedIds };
}

// Pulls remote photo rows not present locally (by id) and turns them into displayable local
// photo objects using a long-lived signed URL (the bucket is private, so a plain public URL
// won't work). A signed URL this long isn't a permanent fix — it's a pragmatic stand-in for a
// real "re-sign on load" refresh path, which is more plumbing than this first pass covers.
export async function pullNewPhotosFromSupabase(userId, existingLocalIds) {
  if (!supabaseEnabled || !userId) return [];
  const { data: rows, error } = await supabase.from("photos").select("*").eq("user_id", userId);
  if (error || !rows) return [];

  const missing = rows.filter((r) => r.storage_path && !existingLocalIds.has(r.id));
  const results = [];
  for (const row of missing) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60 * 60 * 24 * 365);
    if (!signed?.signedUrl) continue;
    results.push({
      id: row.id,
      date: row.date,
      context: row.context,
      dataUrl: signed.signedUrl,
      syncedToCloud: true,
    });
  }
  return results;
}
