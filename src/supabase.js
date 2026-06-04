import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sewoamxaafpcsbwsjubr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNld29hbXhhYWZwY3Nid3NqdWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTE0ODQsImV4cCI6MjA5NTk2NzQ4NH0.pRMvzSTgZw3jelF-mgJSaUQuBS2aBUVyIMQwKI-mAGs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: "plan90_auth",
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

export async function loadStateFromDB(userId) {
  try {
    const { data, error } = await supabase
      .from("plan_state")
      .select("state")
      .eq("user_id", userId)
      .single();
    if (error && error.code !== "PGRST116") console.error("Supabase load error:", error);
    return data?.state ?? null;
  } catch (e) {
    console.error("Supabase load failed:", e);
    return null;
  }
}

export async function saveStateToDB(userId, state) {
  try {
    const { error } = await supabase
      .from("plan_state")
      .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
    if (error) console.error("Supabase save error:", error);
  } catch (e) {
    console.error("Supabase save failed:", e);
  }
}
