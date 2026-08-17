type ChatWidgetState = {
  open: boolean;
  targetShopId: string | null;
};

let state: ChatWidgetState = { open: false, targetShopId: null };
const listeners = new Set<() => void>();

export function getChatWidgetState() {
  return state;
}

export function subscribeChatWidget(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openChatWidget(targetShopId?: string) {
  setState({ open: true, targetShopId: targetShopId ?? state.targetShopId });
}

export function closeChatWidget() {
  setState({ ...state, open: false });
}

export function clearChatTarget() {
  if (state.targetShopId) setState({ ...state, targetShopId: null });
}

function setState(next: ChatWidgetState) {
  state = next;
  for (const listener of listeners) listener();
}
