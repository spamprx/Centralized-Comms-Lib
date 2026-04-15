import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { tagService, templateService, type Tag } from '../../services';

interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
  tags?: Tag[];
  variables?: Record<string, string>;
  usage_count?: number;
  last_used?: string;
}

export default function TemplatesList({
  templates,
  deletedTemplates,
  setTemplates,
  onViewTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onRestoreTemplate,
  onCloneTemplate,
  deletingId,
}: {
  templates: Template[];
  deletedTemplates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
  onViewTemplate: (id: string) => void;
  onEditTemplate?: (id: string) => void;
  onDeleteTemplate?: (id: string) => void;
  onRestoreTemplate?: (template: Template) => void;
  onCloneTemplate?: (id: string) => void;
  deletingId?: string | null;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag =
      selectedTag === 'all' ||
      (template.tags && template.tags.some((tag) => tag.id === selectedTag));
    return matchesSearch && matchesTag;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex);

  // Reset to page 1 when filters or items per page change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTag, itemsPerPage]);

  // Load all available tags from API
  useEffect(() => {
    const loadTags = async () => {
      try {
        setTagsLoading(true);
        const tags = await tagService.list();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
        setAvailableTags([]);
      } finally {
        setTagsLoading(false);
      }
    };

    loadTags();
  }, []);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const handleCreateTemplate = async () => {
    try {
      const newTemplate = await templateService.create({
        name: 'New Template',
        description: 'Click to edit this template - A versatile template for various content types',
        content: `---
title: "{{title}}"
author: "{{author}}"
date: "{{date}}"
tags: [{{tags}}]

# {{title}}

Published by {{author}} on {{date}}

---

{{content}}

---
*Tags: {{tags}}*
*Last updated: {{date}}*`,
        status: 'draft',
      });

      // Update local state with the created template
      setTemplates((prev) => {
        const updated = [...prev, newTemplate];
        return updated;
      });

      console.log('Template created successfully:', newTemplate);
    } catch (error) {
      console.error('Failed to create template:', error);
      // Fallback to localStorage if API fails
      const fallbackTemplate: Template = {
        id: Date.now().toString(),
        name: 'New Template',
        description: 'Click to edit this template - A versatile template for various content types',
        content: `---
title: "{{title}}"
author: "{{author}}"
date: "{{date}}"
tags: [{{tags}}]

# {{title}}

Published by {{author}} on {{date}}

---

{{content}}

---
*Tags: {{tags}}*
*Last updated: {{date}}*`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        tags: [
          { id: 'tag_1', name: 'blog', slug: 'blog' },
          { id: 'tag_2', name: 'content', slug: 'content' },
          { id: 'tag_3', name: 'markdown', slug: 'markdown' },
        ],
        variables: {
          title: 'The main title or headline',
          author: 'Content author name',
          date: 'Publication date',
          tags: 'Comma-separated tags',
          content: 'Main body content',
        },
        usage_count: 0,
        last_used: 'Never',
      };

      setTemplates((prev) => {
        const updated = [...prev, fallbackTemplate];
        localStorage.setItem('templates', JSON.stringify(updated));
        return updated;
      });
    }
  };

  return (
    <div className="app-main-canvas relative p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-16 top-0 h-48 w-48 rounded-full bg-app-accent/10 blur-[80px]" />
        <div className="absolute right-0 top-24 h-40 w-40 rounded-full bg-app-accent-2/10 blur-[70px]" />
      </div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-app-text">Templates</h1>
        <button
          type="button"
          onClick={handleCreateTemplate}
          className="flex items-center gap-2 rounded-app-lg bg-gradient-to-r from-app-accent to-app-accent-2 px-4 py-2.5 text-sm font-semibold text-app-bg shadow-[0_0_24px_-8px_rgba(147,124,248,0.45)] ring-1 ring-white/15 transition-[transform,filter] duration-(--duration-app-slow) ease-(--ease-app-out) hover:brightness-105 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-accent/70" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-app-lg border border-white/10 bg-app-bg/50 py-2.5 pl-10 pr-4 text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md outline-none transition-colors focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/25"
          />
        </div>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          disabled={tagsLoading}
          className="rounded-app-lg border border-white/10 bg-app-bg/50 px-4 py-2.5 text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md outline-none focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/25 disabled:opacity-50"
        >
          <option value="all">All Tags</option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>

      {/* Pagination Controls */}
      <div className="mb-6 rounded-app-xl border border-white/10 bg-app-bg/45 p-6 shadow-app-lift backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/32">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          {/* Items per page selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-app-lg border border-white/8 bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <span className="text-sm font-medium text-app-muted">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="cursor-pointer border-none bg-transparent text-sm font-medium text-app-accent outline-none focus:ring-0"
              >
                <option value={3}>3</option>
                <option value={6}>6</option>
                <option value={9}>9</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
              </select>
              <span className="text-sm font-medium text-app-muted">per page</span>
            </div>
          </div>

          {/* Results count */}
          {totalPages > 1 && (
            <div className="flex items-center">
              <div className="rounded-app-lg border border-app-accent/25 bg-app-accent/10 px-4 py-2 text-app-accent backdrop-blur-sm">
                <span className="text-sm font-medium">
                  {startIndex + 1}-{Math.min(endIndex, filteredTemplates.length)} of{' '}
                  {filteredTemplates.length} templates
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {paginatedTemplates.map((template) => (
          <div
            key={template.id}
            className="group overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/40 shadow-app-lift backdrop-blur-2xl transition-[border-color,box-shadow,transform] duration-(--duration-app-slow) ease-(--ease-app-out) supports-backdrop-filter:bg-app-bg/28 hover:border-white/16 hover:shadow-[0_20px_48px_-24px_rgba(0,0,0,0.55)]"
          >
            {/* Header Section */}
            <div className="relative border-b border-white/8 bg-gradient-to-b from-white/[0.06] to-transparent px-4 py-3">
              <div className="text-center">
                <h3 className="mb-1 text-lg font-bold tracking-tight text-app-text">
                  {template.name}
                </h3>
                <p className="mb-2 text-sm text-app-muted">{template.description}</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-4">
              {/* Tags */}
              {template.tags && template.tags.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-app-faint mb-2 uppercase tracking-wider">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {template.tags?.map((tag, index) => (
                      <span
                        key={tag.id || index}
                        className="inline-flex items-center rounded-full border border-app-accent/25 bg-app-accent/10 px-2 py-1 text-xs font-medium text-app-accent"
                      >
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-app-accent shadow-[0_0_8px_rgba(147,124,248,0.5)]"></span>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variables */}
              {template.variables && Object.keys(template.variables).length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-app-faint mb-2 uppercase tracking-wider">
                    Variables
                  </p>
                  <div className="rounded-app-lg border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(template.variables).map(([key, value], index) => (
                        <div key={index} className="flex items-center gap-1">
                          <span className="rounded-app-md border border-white/10 bg-app-bg/50 px-2 py-1 font-mono text-app-muted">
                            {key}
                          </span>
                          <span className="text-app-faint">=</span>
                          <span className="rounded-app-md border border-app-accent/20 bg-app-accent/10 px-2 py-1 font-mono text-app-accent">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Status and Actions */}
              <div className="flex items-center justify-between">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {template.status === 'archived' && (
                    <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-200">
                      <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 4a2 2 0 00-2 2v6a2 2 0 002 2H6a2 2 0 00-2-2V6a2 2 0 002-2h2a2 2 0 002-2zm6 0H4v2h12V4z" />
                      </svg>
                      Archived
                    </span>
                  )}
                  {template.status === 'active' && (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100">
                      <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 00-8-8v4a8 8 0 008 8h2a8 8 0 008-8v-4a8 8 0 00-8-8H2a8 8 0 00-8 8z"
                        />
                      </svg>
                      Active
                    </span>
                  )}
                  {template.status === 'draft' && (
                    <span className="inline-flex items-center rounded-full border border-amber-400/35 bg-amber-500/12 px-3 py-1.5 text-xs font-medium text-amber-100">
                      <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 0l-2.829 2.829a2 2 0 11.414 0l2.829 2.829a2 2 0 01.414 0l2.829-2.829a2 2 0 01.414 0l-2.829-2.829a2 2 0 00-2.828-2.828z" />
                      </svg>
                      Draft
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onViewTemplate(template.id)}
                    className="inline-flex items-center rounded-app-md bg-gradient-to-r from-app-accent to-app-accent-2 px-3 py-2 text-sm font-semibold text-app-bg shadow-[0_0_16px_-6px_rgba(147,124,248,0.5)] ring-1 ring-white/12 transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditTemplate?.(template.id)}
                    className="inline-flex items-center rounded-app-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-app-text transition-colors hover:border-white/18 hover:bg-white/10"
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloneTemplate?.(template.id)}
                    className="inline-flex items-center rounded-app-md border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25"
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    Clone
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate?.(template.id)}
                    disabled={deletingId === template.id}
                    className="inline-flex items-center rounded-app-md border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === template.id ? (
                      <>
                        <div className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="flex justify-between items-center text-xs text-app-faint">
                <div className="flex items-center">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6 0l3-3m-3 3v4m0-6h-6"
                    />
                  </svg>
                  Created {formatRelativeTime(template.createdAt)}
                </div>
                <div className="flex items-center">
                  <div className="flex items-center">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h5a2 2 0 002-2V7a2 2 0 00-2-2zm0 0h14v14H0z"
                      />
                    </svg>
                    Updated {formatRelativeTime(template.updatedAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="rounded-app-xl border border-dashed border-white/12 bg-app-bg/35 py-14 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
          <p className="text-app-muted">No templates found matching your criteria.</p>
        </div>
      ) : (
        totalPages > 1 && (
          <div className="mt-8 rounded-app-xl border border-white/10 bg-app-bg/45 p-6 shadow-app-lift backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/32">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              {/* Page navigation */}
              <div className="flex flex-wrap items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="group flex items-center gap-2 rounded-app-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-app-muted transition-colors hover:border-white/16 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center">
                  {(() => {
                    const pages = [];
                    const maxVisible = 7;

                    if (totalPages <= maxVisible) {
                      // Show all pages if total is small
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Complex pagination logic for many pages
                      if (currentPage <= 4) {
                        // Show first pages + ... + last
                        for (let i = 1; i <= 5; i++) {
                          pages.push(i);
                        }
                        pages.push('ellipsis');
                        pages.push(totalPages);
                      } else if (currentPage >= totalPages - 3) {
                        // Show first + ... + last pages
                        pages.push(1);
                        pages.push('ellipsis');
                        for (let i = totalPages - 4; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Show first + ... + current + ... + last
                        pages.push(1);
                        pages.push('ellipsis');
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(i);
                        }
                        pages.push('ellipsis');
                        pages.push(totalPages);
                      }
                    }

                    return pages.map((page, index) => {
                      if (page === 'ellipsis') {
                        return (
                          <div
                            key={`ellipsis-${index}`}
                            className="flex items-center justify-center w-10 h-10"
                          >
                            <MoreHorizontal className="w-4 h-4 text-app-faint" />
                          </div>
                        );
                      }

                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page as number)}
                          className={`h-10 w-10 rounded-app-lg text-sm font-medium transition-[border-color,background-color,box-shadow] ${
                            currentPage === page
                              ? 'border border-transparent bg-gradient-to-br from-app-accent to-app-accent-2 text-app-bg shadow-[0_0_20px_-6px_rgba(147,124,248,0.55)] ring-1 ring-white/15'
                              : 'border border-white/10 bg-white/[0.03] text-app-muted hover:border-white/16 hover:bg-white/[0.06]'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="group flex items-center gap-2 rounded-app-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-app-muted transition-colors hover:border-white/16 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Page info */}
              <div className="flex items-center gap-3">
                <div className="rounded-app-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Deleted Templates Section */}
      {deletedTemplates.length > 0 && (
        <div className="mt-8 rounded-app-xl border border-red-400/25 bg-red-950/25 p-6 shadow-app-soft backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-red-200">Recently Deleted</h3>
            <button
              type="button"
              onClick={() => {
                if (confirm('Clear all deleted templates?')) {
                  setTemplates([]);
                  localStorage.removeItem('deletedTemplates');
                }
              }}
              className="text-sm font-medium text-red-300 transition-colors hover:text-red-100"
            >
              Clear Trash
            </button>
          </div>
          <div className="space-y-2">
            {deletedTemplates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between rounded-app-lg border border-white/8 bg-app-bg/40 p-3 backdrop-blur-sm"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-app-text">{template.name}</p>
                  <p className="text-xs text-app-faint">
                    Deleted {formatRelativeTime(template.updatedAt)}
                    {template.usage_count !== undefined && (
                      <span className="ml-2">• Used {template.usage_count} times</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onRestoreTemplate?.(template)}
                    className="rounded-app-md border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
