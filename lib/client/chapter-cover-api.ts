import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const BUCKET = "chapter-covers";

export async function uploadChapterCover(file: Blob): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("대표 이미지를 저장하려면 로그인이 필요해요.");

  const objectName = `${session.user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectName, file, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: false,
    });
  if (uploadError) throw new Error("대표 이미지를 업로드하지 못했어요. 네트워크를 확인해 주세요.");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectName);
  return data.publicUrl;
}
