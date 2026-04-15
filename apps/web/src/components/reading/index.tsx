import Slot from '../ui/Slot';

export function ReadingProgressBar() {
  return <Slot className="h-1 w-full shrink-0" />;
}
export function ReadingTopbar() {
  return <Slot className="h-14 w-full shrink-0" />;
}
export function ContentBody() {
  return <Slot className="mx-auto max-w-3xl min-h-[40rem]" />;
}
export function SideAnnotationsPanel() {
  return <Slot className="w-64 shrink-0" />;
}
export function FooterEngagementBar() {
  return <Slot className="h-16 w-full shrink-0" />;
}
