import type { Timestamp } from 'firebase/firestore';

export type User = {
  id: string;
  uid: string;
  username: string;
  bio: string;
  role: 'penulis' | 'pembaca' | 'admin';
  followers: number;
  following: number;
  photoURL: string;
  displayName: string;
  email: string;
  phoneNumber?: string; // Informasi industri kawan
  domicile?: string;    // Informasi industri kawan
  status?: 'online' | 'offline';
  lastSeen?: Timestamp;
  notificationPreferences?: {
    onNewFollower?: boolean;
    onBookComment?: boolean;
    onBookFavorite?: boolean;
    onStoryComment?: boolean;
    onReelLike?: boolean;
    onReelComment?: boolean;
  };
};

export type MusicTrack = {
  id?: string;
  name: string;
  artist: string;
  image: string;
  url?: string;
  source: 'lastfm' | 'youtube' | 'internal';
};

export type ScreenplayBlock = {
  id: string;
  type: 'slugline' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';
  text: string;
};

export type Shot = {
  id: string;
  number: string;
  scene: string;
  type: 'WS' | 'MS' | 'CU' | 'ECU' | string;
  angle: string;
  movement: string;
  description: string;
};

export type Book = {
  id: string;
  title: string;
  genre: string;
  type: 'book' | 'screenplay' | 'poem';
  synopsis: string;
  coverUrl: string;
  fileUrl?: string; 
  shotListUrl?: string; 
  viewCount: number;
  favoriteCount: number;
  chapterCount: number;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string;
  status: 'draft' | 'pending_review' | 'published' | 'rejected';
  isCompleted?: boolean;
  visibility: 'public' | 'followers_only';
  playlist?: MusicTrack[];
  collaboratorUids?: string[];
  collaborators?: {
    uid: string;
    displayName: string;
    photoURL: string;
    username: string;
  }[];
  createdAt: Timestamp;
};

export type Chapter = {
    id: string;
    title: string;
    content: string; 
    order: number;
    createdAt: Timestamp;
};

export type ArtWork = {
  id: string;
  type: 'image' | 'video' | 'quote';
  title: string;
  content?: string;
  mediaUrl?: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string;
  likes: number;
  commentCount: number;
  createdAt: Timestamp;
};

export type ArtLike = {
  id: string;
  userId: string;
  likedAt: Timestamp;
};

export type ArtComment = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  username: string;
  userAvatarUrl: string;
  likeCount: number;
  replyCount: number;
  createdAt: Timestamp;
};

export type ArtCommentLike = {
  id: string;
  userId: string;
  likedAt: Timestamp;
};

export type CollaborationInvitation = {
  id: string;
  bookId: string;
  bookTitle: string;
  ownerId: string;
  ownerName: string;
  collaboratorId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
};

export type Music = {
  id: string;
  title: string;
  artist: string;
  url: string;
  createdAt: Timestamp;
};

export type Comment = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  username: string;
  userAvatarUrl: string;
  likeCount: number;
  replyCount: number;
  createdAt: Timestamp;
};

export type BookCommentLike = {
  id: string;
  userId: string;
  likedAt: Timestamp;
};

export type AuthorRequest = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber: string; // Informasi industri kawan
  domicile: string;    // Informasi industri kawan
  portfolio?: string;
  motivation: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Timestamp;
};

export interface ChatParticipant {
  uid: string;
  displayName: string;
  photoURL: string;
  username: string;
}

export type Chat = {
  id: string;
  participants: ChatParticipant[];
  participantUids: string[];
  adminUids?: string[];
  isGroup?: boolean;
  groupName?: string;
  groupAvatarUrl?: string;
  lastMessage?: {
    text: string;
    timestamp: Timestamp;
    senderId: string;
    type?: string;
    status?: 'active' | 'ended';
    messageId?: string;
  };
  unreadCounts?: { [key: string]: number };
  typingStatus?: { [uid: string]: boolean };
};

export type TextMessage = {
  id: string;
  type: 'text';
  text: string;
};

export type ImageMessage = {
  id: string;
  type: 'image';
  imageUrl: string;
};

export type VoiceNoteMessage = {
  id: string;
  type: 'voice_note';
  audioUrl: string;
};

export type VideoCallMessage = {
    id: string;
    type: 'video_call';
    callId: string;
    status: 'calling' | 'missed' | 'ended' | 'accepted' | 'rejected';
    duration?: string;
};

export type BookShareMessage = {
  id: string;
  type: 'book_share';
  book: {
    id: string;
    title: string;
    coverUrl: string;
    authorName: string;
  };
};

export type ReelShareMessage = {
  id: string;
  type: 'reel_share';
  reel: {
    id: string;
    authorName: string;
    caption: string;
    videoUrl: string;
  };
};

export type ArtShareMessage = {
  id: string;
  type: 'art_share';
  art: {
    id: string;
    title: string;
    type: 'image' | 'video' | 'quote';
    mediaUrl?: string;
    authorName: string;
    content?: string;
  };
};

export type ChatMessage = (
  TextMessage | ImageMessage | VoiceNoteMessage | VideoCallMessage | BookShareMessage | ReelShareMessage | ArtShareMessage
) & {
  id: string;
  senderId: string;
  createdAt: Timestamp;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
    type: string;
  };
};


export type Notification = {
  id: string;
  type: 'comment' | 'follow' | 'favorite' | 'author_request' | 'story_comment' | 'broadcast' | 'reel_like' | 'reel_comment';
  text: string;
  link: string;
  actor: {
    uid: string;
    displayName: string;
    photoURL: string;
  };
  read: boolean;
  createdAt: Timestamp;
};

export type AiChatMessage = {
  id?: string;
  role: 'user' | 'model';
  content: string;
  createdAt?: Timestamp;
};

export type Favorite = {
    id: string; 
    userId: string;
    addedAt: Timestamp;
};

export type Follow = {
    id: string; 
    userId: string;
    followedAt: Timestamp;
};

export type Story = {
  id: string;
  type: 'text' | 'image' | 'video';
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string;
  authorRole: 'penulis' | 'pembaca' | 'admin';
  content: string;
  createdAt: Timestamp;
  likes: number;
  commentCount: number;
  viewCount: number;
  background?: string;
  mediaUrl?: string;
};

export type StoryComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  text: string;
  createdAt: Timestamp;
};

export type StoryLike = {
  id: string; 
  userId: string;
  likedAt: Timestamp;
};

export type StoryLikeDoc = {
  id: string; 
  userId: string;
  likedAt: Timestamp;
};

export type StoryView = {
  id: string; 
  userId: string;
  userName: string;
  userAvatarUrl: string;
  viewedAt: Timestamp;
};

export type Reel = {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string;
  authorRole: string;
  caption: string;
  videoUrl: string;
  likes: number;
  commentCount: number;
  viewCount: number;
  createdAt: Timestamp;
};

export type ReelComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  text: string;
  likeCount: number;
  replyCount: number;
  createdAt: Timestamp;
};

export type ReelLike = {
  id: string; 
  userId: string;
  likedAt: Timestamp;
};

export type ReelCommentLike = {
  id: string; 
  userId: string;
  likedAt: Timestamp;
}

export interface VideoCallSession {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  callerPhotoURL: string;
  status: 'calling' | 'accepted' | 'rejected' | 'ended';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  chatId: string; // New field
  messageId: string; // New field
  createdAt: Timestamp;
}
