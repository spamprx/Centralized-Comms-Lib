import Slot from "../components/ui/Slot";

export default function ChatLayout() {
  return (
    <div className="flex h-screen flex-col">
      <Slot name="ChatHeader" className="h-14 w-full shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Slot name="ChatMessageThread" className="min-h-0 flex-1 overflow-auto" />
        <Slot name="ChatInputBar" className="mt-4 h-10 w-full" />
        <Slot name="SuggestedQuestionsPanel" className="mt-3 h-12 w-full" />
      </div>
    </div>
  );
}
