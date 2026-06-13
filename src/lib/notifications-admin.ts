import { supabase } from './supabase'

export interface AdminNotificationRow {
  id: string
  text: string
  time_label: string
  is_active: boolean
  created_at: string
}

export interface NotificationDraft {
  text: string
  time_label: string
}

export async function adminListNotifications(): Promise<AdminNotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,text,time_label,is_active,created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminNotificationRow[]
}

export async function adminSendNotification(draft: NotificationDraft): Promise<void> {
  const text = draft.text.trim()
  const timeLabel = draft.time_label.trim() || 'New'
  if (!text) throw new Error('Message is required')

  const { error } = await supabase
    .from('notifications')
    .insert({ text, time_label: timeLabel, is_active: true })
  if (error) throw new Error(error.message)
}

export async function adminSetNotificationActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function adminDeleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
