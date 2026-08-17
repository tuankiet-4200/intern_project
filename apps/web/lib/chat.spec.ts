import { describe, expect, it } from '@jest/globals';
import { chatMessageLabel, chatPeerName, mergeChatMessage, type ChatConversation, type ChatMessage } from './chat';

const conversation = {
  id: 'conversation', shopId: 'shop', customerId: 'customer', lastMessageAt: '2026-01-01T00:00:00.000Z', unreadCount: 0,
  shop: { id: 'shop', name: 'North Studio', slug: 'north-studio', logoUrl: null, aiChatEnabled: true },
  customer: { id: 'customer', fullName: 'Customer Demo' }, lastMessage: null,
} satisfies ChatConversation;

function message(id: string, senderType: ChatMessage['senderType'], createdAt: string): ChatMessage {
  return { id, conversationId: 'conversation', senderUserId: null, senderType, content: id, aiStatus: null, aiModel: null, createdAt, sender: null };
}

describe('chat presentation helpers', () => {
  it('deduplicates realtime messages and keeps chronological order', () => {
    const later = message('later', 'SHOP', '2026-01-01T02:00:00.000Z');
    const earlier = message('earlier', 'CUSTOMER', '2026-01-01T01:00:00.000Z');
    expect(mergeChatMessage([later], earlier).map((item) => item.id)).toEqual(['earlier', 'later']);
    expect(mergeChatMessage([earlier], { ...earlier, content: 'updated' })).toEqual([{ ...earlier, content: 'updated' }]);
  });

  it('uses the correct peer and sender labels for both surfaces', () => {
    expect(chatPeerName(conversation, 'CUSTOMER')).toBe('North Studio');
    expect(chatPeerName(conversation, 'SHOP')).toBe('Customer Demo');
    expect(chatMessageLabel(message('ai', 'AI', '2026-01-01T00:00:00.000Z'), 'CUSTOMER')).toBe('AI của shop');
    expect(chatMessageLabel(message('shop', 'SHOP', '2026-01-01T00:00:00.000Z'), 'SHOP')).toBe('Bạn');
  });
});
