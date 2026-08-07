/** إدارة المحادثات والرسائل في قاعدة البيانات السحابية (مقيّدة بالمستخدم عبر RLS). */
import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";

export interface ChatThread {
  id: string;
  title: string;
  updated_at: string;
}

export async function listThreads(): Promise<ChatThread[]> {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createThread(title = "محادثة جديدة"): Promise<ChatThread> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول أولاً.");
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ title, user_id: userId })
    .select("id, title, updated_at")
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
