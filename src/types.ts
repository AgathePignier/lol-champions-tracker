export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  tag: string;
  created_at?: string;
  avatar?: string
}

export type Message = {
  id: number
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}