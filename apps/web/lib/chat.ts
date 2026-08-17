export type ChatMode = 'CUSTOMER' | 'SHOP';
export type ChatSenderType = 'CUSTOMER' | 'SHOP' | 'AI';
export type ChatAiStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | null;

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  senderType: ChatSenderType;
  content: string;
  aiStatus: ChatAiStatus;
  aiModel: string | null;
  createdAt: string;
  sender: { id: string; fullName: string } | null;
};

export type ChatConversation = {
  id: string;
  shopId: string;
  customerId: string;
  lastMessageAt: string;
  unreadCount: number;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    aiChatEnabled: boolean;
  };
  customer: { id: string; fullName: string };
  lastMessage: ChatMessage | null;
};

export type ShopAiSetting = {
  shopId: string;
  enabled: boolean;
  configured: boolean;
};

export function mergeChatMessage(messages: ChatMessage[], incoming: ChatMessage) {
  const existingIndex = messages.findIndex((message) => message.id === incoming.id);
  if (existingIndex >= 0) {
    return messages.map((message, index) => index === existingIndex ? incoming : message);
  }
  return [...messages, incoming].sort((left, right) => {
    const timeDifference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
}

export function chatPeerName(conversation: ChatConversation, mode: ChatMode) {
  return mode === 'SHOP' ? conversation.customer.fullName : conversation.shop.name;
}

export function chatMessageLabel(message: ChatMessage, mode: ChatMode) {
  if (message.senderType === 'AI') return 'AI của shop';
  if (message.senderType === 'SHOP') return mode === 'SHOP' ? 'Bạn' : 'Shop';
  return mode === 'CUSTOMER' ? 'Bạn' : message.sender?.fullName ?? 'Khách hàng';
}
