import Slot from "../ui/Slot";

export function ChatHeader() {
  return <Slot className="h-14 w-full shrink-0" />;
}
export function ChatMessageThread() {
  return <Slot className="min-h-0 flex-1 overflow-auto" />;
}
export function ChatInputBar() {
  return <Slot className="h-10 w-full" />;
}
export function SuggestedQuestionsPanel() {
  return <Slot className="h-12 w-full" />;
}
