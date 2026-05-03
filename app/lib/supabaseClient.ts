import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export const uploadFileToSupabase = async (
  file: File,
  folder = "attachments",
) => {
  if (!supabase) throw new Error("Supabase not configured");

  const safeName = file.name.replace(/[^a-zA-Z0-9.א-ת_-]/g, "_");
  const filePath = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from("attachments")
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);

  return data.publicUrl;
};
