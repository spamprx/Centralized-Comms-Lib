import Slot from "../components/ui/Slot";

export default function ReviewLayout() {
  return (
    <div className="flex h-screen flex-col">
      <Slot name="ReviewTopbar" className="h-14 w-full shrink-0" />
      <div className="flex flex-1 overflow-hidden">
        <Slot name="ContentViewPanel" className="min-h-0 min-w-0 flex-1 overflow-auto" />
        <div className="flex w-96 shrink-0 flex-col gap-4 overflow-auto border-l border-gray-700 p-4">
          <Slot name="ApprovalButtons" className="h-14" />
          <Slot name="CommentsThread" className="min-h-[8rem]" />
          <Slot name="AIScreeningPanel" className="min-h-[12rem]" />
          <Slot name="VersionComparisonView" className="min-h-[8rem]" />
          <Slot name="AddCommentBox" className="min-h-[10rem]" />
        </div>
      </div>
    </div>
  );
}
