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

export async function moveThreadToProject(id: string, projectId: string): Promise<ChatThread> {
  const { data, error } = await supabase
    .from("chat_threads")
    .update({ project_id: projectId })
    .eq("id", id)
    .is("project_id", null)
    .select("id, title, updated_at, project_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Legacy thread not found or already assigned.");
  return data;
}

export async function renameThread(id: string, title: string, projectId: string | null = null) {
  let query = supabase.from("chat_threads").update({ title }).eq("id", id).select("id");
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Thread not found in this project.");
}

export async function deleteThread(id: string, projectId: string | null = null) {
  let query = supabase.from("chat_threads").delete().eq("id", id).select("id");
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Thread not found in this project.");
}

export async function loadMessages(threadId: string, projectId: string | null = null): Promise<UIMessage[]> {
  let threadQuery = supabase.from("chat_threads").select("id").eq("id", threadId);
  threadQuery = projectId ? threadQuery.eq("project_id", projectId) : threadQuery.is("project_id", null);
  const { data: thread, error: threadError } = await threadQuery.maybeSingle();
  if (threadError) throw new Error(threadError.message);
  if (!thread) throw new Error("Thread not found in this project.");

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
