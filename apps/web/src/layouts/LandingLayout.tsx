import Slot from "../components/ui/Slot";

export default function LandingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Slot name="Navbar" className="h-14 w-full shrink-0" />
      <Slot name="HeroSection" className="min-h-[28rem] w-full shrink-0" />
      <Slot name="AnnouncementsBanner" className="h-24 w-full shrink-0" />
      <div className="flex-1 px-6 py-4">
        <Slot name="SearchBar" className="mb-4 h-12 w-full max-w-2xl" />
        <Slot name="CategoryFilterBar" className="mb-4 h-12 w-full" />
        <Slot name="TrendingContentGrid" className="mb-6 min-h-[20rem] w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Slot key={i} name="ContentCard" className="min-h-[14rem]" />
          ))}
        </div>
      </div>
      <Slot name="FooterBar" className="mt-auto h-20 w-full shrink-0" />
    </div>
  );
}
