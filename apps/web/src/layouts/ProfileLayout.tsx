import Slot from "../components/ui/Slot";

export default function ProfileLayout() {
  return (
    <div className="flex min-h-screen flex-col p-6">
      <Slot name="ProfileHeader" className="mb-8 h-24 w-full" />
      <Slot name="ProfileTabs" className="mb-6 h-10 w-full max-w-2xl" />
      <div className="flex flex-1 gap-8">
        <Slot name="PersonalInfoForm" className="min-h-[20rem] flex-1 max-w-2xl" />
        <aside className="w-64 shrink-0">
          <Slot name="BookmarksList" className="min-h-[12rem]" />
        </aside>
      </div>
    </div>
  );
}
