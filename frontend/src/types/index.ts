export interface UserPublic {
  id: number;
  username: string;
  display_name: string | null;
  profile_picture_url: string;
  lives_in: string;
  caption: string;
  bio: string | null;
  created_at: string;
}

export interface UserMe extends UserPublic {
  email: string;
  meme_count: number;
  friend_count: number;
}

export type FriendshipStatus =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "friends"
  | "self";

export interface UserWithRelation extends UserPublic {
  friendship_status: FriendshipStatus;
}

export interface MediaAsset {
  url: string;
  media_type: "image" | "video";
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

export interface Meme {
  id: number;
  title: string | null;
  description: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: UserPublic;
  media: MediaAsset;
  liked_by_me: boolean;
}

export interface Comment {
  id: number;
  meme_id: number;
  body: string;
  created_at: string;
  author: UserPublic;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface FriendRequest {
  id: number;
  status: string;
  created_at: string;
  direction: "incoming" | "outgoing";
  user: UserPublic;
}

export interface Friend extends UserPublic {
  since: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  id: number;
  other_user: UserPublic;
  last_message: Message | null;
  unread_count: number;
  last_message_at: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SignupResponse extends TokenPair {
  user: UserMe;
}
