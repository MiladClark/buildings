export const CHAT_SEEN_EVENT = "buildings-chat-seen";

export function chatSeenStorageKey(buildingId: string) {
  return `buildings-chat-seen:${buildingId}`;
}

export function readChatSeen(buildingId: string) {
  try {
    return localStorage.getItem(chatSeenStorageKey(buildingId));
  } catch {
    return null;
  }
}

export function markChatSeen(buildingId: string, messageId: string) {
  try {
    localStorage.setItem(chatSeenStorageKey(buildingId), messageId);
  } catch {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(CHAT_SEEN_EVENT, {
      detail: { buildingId, messageId },
    }),
  );
}
