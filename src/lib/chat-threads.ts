/** إدارة المحادثات والرسائل في قاعدة البيانات السحابية (مقيّدة بالمستخدم عبر RLS). */
import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";

export interface ChatThread {
  id: string;
  title: string;
  updated_at: string;
  project_id: string | null;
}

export async function listThreads(projectId: string | null = null): Promise<ChatThread[]> {
  let query = supabase
    .from("chat_threads")
    .select("id, title, updated_at, project_id")
    .order("updated_at", { ascending: false });
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createThread(
  title = "محادثة جديدة",
  projectId: string | null = null,
): Promise<ChatThread> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول أولاً.");
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ title, user_id: userId, project_id: projectId })
    .select("id, title, updated_at, project_id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameThread(id: string, title: string) {
  const { error } = await supabase.from("chat_threads").update({ title }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteThread(id: string) {
  const { error } = await supabase.from("chat_threads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function loadMessages(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as UIMessage["role"],
    parts: (row.parts ?? []) as UIMessage["parts"],
  }));
}
