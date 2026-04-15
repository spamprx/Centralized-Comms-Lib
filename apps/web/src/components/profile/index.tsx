import Slot from '../ui/Slot';

export function ProfileHeader() {
  return <Slot className="h-24 w-full" />;
}
export function ProfileTabs() {
  return <Slot className="h-10 w-full max-w-2xl" />;
}
export function ProfileContent() {
  return <Slot className="min-h-[20rem] flex-1 max-w-2xl" />;
}
