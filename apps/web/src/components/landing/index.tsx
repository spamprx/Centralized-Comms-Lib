import Slot from '../ui/Slot';

export function Navbar() {
  return <Slot className="h-14 w-full shrink-0" />;
}
export function HeroSection() {
  return <Slot className="min-h-[28rem] w-full shrink-0" />;
}
export function AnnouncementsBanner() {
  return <Slot className="h-24 w-full shrink-0" />;
}
export function SearchBar() {
  return <Slot className="h-12 w-full max-w-2xl" />;
}
export function TrendingContentGrid() {
  return <Slot className="min-h-[20rem] w-full" />;
}
export function CategoryFilterBar() {
  return <Slot className="h-12 w-full" />;
}
export function ContentCard() {
  return <Slot className="min-h-[14rem]" />;
}
export function FooterBar() {
  return <Slot className="h-20 w-full shrink-0" />;
}
