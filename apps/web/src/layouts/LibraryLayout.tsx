import { useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { SearchAndFilterBar, ContentGrid, Pagination } from '../components/library';

export default function LibraryLayout() {
  const {
    contentItems,
    tags,
    loading,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    selectedTag,
    setSelectedTag,
  } = useLibrary();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const totalPages = Math.ceil(contentItems.length / itemsPerPage);
  const paginatedItems = contentItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-12 bg-white/[0.03] rounded-[10px] mb-6" />
        <div className="flex gap-3 mb-6">
          <div className="h-10 flex-1 bg-white/[0.03] rounded-lg" />
          <div className="h-10 w-[150px] bg-white/[0.03] rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
            <div key={i} className="h-[280px] bg-white/[0.03] rounded-[10px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e4f0] mb-1">Content Library</h1>
        <p className="text-[13px] text-[#555870] m-0">Browse and manage all content assets</p>
      </div>

      {/* Search and Filters */}
      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        tags={tags}
      />

      {/* Active filters */}
      {(searchQuery || selectedType !== 'all' || selectedTag !== 'all') && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {searchQuery && (
            <span className="px-2.5 py-1 bg-violet-500/15 rounded-2xl text-xs text-violet-400 flex items-center gap-1.5">
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="bg-transparent border-none text-violet-400 cursor-pointer p-0 flex">×</button>
            </span>
          )}
          {selectedType !== 'all' && (
            <span className="px-2.5 py-1 bg-cyan-500/15 rounded-2xl text-xs text-cyan-500 flex items-center gap-1.5">
              {selectedType}
              <button onClick={() => setSelectedType('all')} className="bg-transparent border-none text-cyan-500 cursor-pointer p-0 flex">×</button>
            </span>
          )}
        </div>
      )}

      {/* Content Grid */}
      <div className="mt-6">
        <ContentGrid items={paginatedItems} />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
