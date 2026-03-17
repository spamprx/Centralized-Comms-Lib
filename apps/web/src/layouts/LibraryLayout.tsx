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
      <div style={{ padding: 24 }}>
        <div style={{ height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 24 }} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div style={{ height: 40, flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
          <div style={{ height: 40, width: 150, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
            <div key={i} style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', margin: '0 0 4px' }}>Content Library</h1>
        <p style={{ fontSize: 13, color: '#555870', margin: 0 }}>Browse and manage all content assets</p>
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
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {searchQuery && (
            <span style={{
              padding: '4px 10px',
              background: 'rgba(139, 92, 246, 0.15)',
              borderRadius: 16,
              fontSize: 12,
              color: '#a78bfa',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery('')} style={{
                background: 'none',
                border: 'none',
                color: '#a78bfa',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
              }}>×</button>
            </span>
          )}
          {selectedType !== 'all' && (
            <span style={{
              padding: '4px 10px',
              background: 'rgba(6, 182, 212, 0.15)',
              borderRadius: 16,
              fontSize: 12,
              color: '#06b6d4',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {selectedType}
              <button onClick={() => setSelectedType('all')} style={{
                background: 'none',
                border: 'none',
                color: '#06b6d4',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
              }}>×</button>
            </span>
          )}
        </div>
      )}

      {/* Content Grid */}
      <div style={{ marginTop: 24 }}>
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
