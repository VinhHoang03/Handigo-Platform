import type { ChatMessage, MessagePage } from '../types/chat.types';

export type MessageChange = { message: ChatMessage } | { deletedId: string };
type HistoryBoundary = Pick<ChatMessage, '_id' | 'createdAt'>;

const compareMessages = (a: HistoryBoundary, b: HistoryBoundary) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a._id.localeCompare(b._id);

export function mergeChatHistory(items: ChatMessage[], changes: MessageChange[]) {
  const messages = new Map(items.map((message) => [message._id, message]));
  for (const change of changes) {
    if ('deletedId' in change) messages.delete(change.deletedId);
    else messages.set(change.message._id, change.message);
  }
  return [...messages.values()].sort(compareMessages);
}

// Tải tới mốc cũ để không bỏ sót tin khi mất mạng lâu hoặc trang bị dịch bởi tin mới.
export async function loadChatHistory(
  fetchPage: (page: number) => Promise<MessagePage>,
  minimumPages: number,
  oldestLoaded: HistoryBoundary | undefined,
  isCurrent: () => boolean,
) {
  const items: ChatMessage[] = [];
  let page = 0;
  let totalPages: number;
  do {
    const result = await fetchPage(++page);
    if (!isCurrent()) return null;
    items.push(...result.items);
    totalPages = result.pagination.totalPages;
    const oldest = result.items[0];
    if (page >= minimumPages && (!oldestLoaded || (oldest && compareMessages(oldest, oldestLoaded) <= 0))) break;
  } while (page < totalPages);
  return { items: mergeChatHistory(items, []), pages: page, hasMore: page < totalPages };
}
