import type { ChatMessage, Conversation } from '../types/chat.types';

const idOf = (value: string | { _id: string } | undefined) => typeof value === 'string' ? value : value?._id;

export const conversationGroupKey = (conversation: Conversation) => {
  const customer = idOf(conversation.customerId);
  const provider = idOf(conversation.providerId);
  return customer && provider ? `${customer}:${provider}` : conversation._id;
};

export function groupConversations(items: Conversation[]) {
  const groups = new Map<string, Conversation[]>();
  for (const item of items) {
    const key = conversationGroupKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export const conversationOrderLabel = (conversation: Conversation) =>
  `Đơn ${typeof conversation.orderId === 'object' ? conversation.orderId.orderCode || conversation.orderId._id : conversation.orderId}`;

const orderIdOf = (conversation: Conversation) => idOf(conversation.orderId) ?? conversation._id;

// ObjectId của đơn giữ thứ tự tạo, không phụ thuộc thời điểm gửi tin cuối.
export const sortOrderConversations = (conversations: Conversation[]) =>
  [...conversations].sort((a, b) => orderIdOf(a).localeCompare(orderIdOf(b)));

export const activeOrderConversation = (conversations: Conversation[]) =>
  sortOrderConversations(conversations).reverse().find((conversation) =>
    typeof conversation.orderId === 'object' && ['accepted', 'in_progress'].includes(conversation.orderId.status ?? ''));

export const conversationOrderStatus = (conversation: Conversation) => {
  const status = typeof conversation.orderId === 'object' ? conversation.orderId.status : undefined;
  return ({ created: 'Mới tạo', accepted: 'Đã nhận', in_progress: 'Đang thực hiện', completed: 'Đã hoàn thành', cancelled: 'Đã hủy' } as Record<string, string>)[status ?? ''] ?? '';
};

export function orderConversationMessages(messages: ChatMessage[], conversations: Conversation[]) {
  const positions = new Map(sortOrderConversations(conversations).map((conversation, index) => [conversation._id, index]));
  return [...messages].sort((a, b) =>
    (positions.get(a.conversationId) ?? -1) - (positions.get(b.conversationId) ?? -1) ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a._id.localeCompare(b._id));
}
