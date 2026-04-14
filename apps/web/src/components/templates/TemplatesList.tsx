import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Copy, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
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
  deletingId
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

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag === 'all' || (template.tags && template.tags.some(tag => tag.id === selectedTag));
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
        status: 'draft'
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
          { id: 'tag_3', name: 'markdown', slug: 'markdown' }
        ],
        variables: {
          title: 'The main title or headline',
          author: 'Content author name',
          date: 'Publication date',
          tags: 'Comma-separated tags',
          content: 'Main body content'
        },
        usage_count: 0,
        last_used: 'Never'
      };
      
      setTemplates((prev) => {
        const updated = [...prev, fallbackTemplate];
        localStorage.setItem('templates', JSON.stringify(updated));
        return updated;
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-app-text">Templates</h1>
        <button 
          onClick={handleCreateTemplate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-app-faint" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-app-border bg-app-bg/40 py-2 pl-10 pr-4 text-app-text outline-none focus:ring-2 focus:ring-app-accent"
          />
        </div>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          disabled={tagsLoading}
          className="rounded-lg border border-app-border bg-app-bg/40 px-4 py-2 text-app-text outline-none focus:ring-2 focus:ring-app-accent disabled:opacity-50"
        >
          <option value="all">All Tags</option>
          {availableTags.map(tag => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
      </div>

      {/* Pagination Controls */}
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Items per page selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-app-surface px-3 py-2 rounded-lg">
              <span className="text-sm font-medium text-app-muted">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-medium text-blue-600 cursor-pointer"
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
              <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium">
                  {startIndex + 1}-{Math.min(endIndex, filteredTemplates.length)} of {filteredTemplates.length} templates
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedTemplates.map((template) => (
          <div key={template.id} className="bg-app-surface border border-app-border rounded-lg overflow-hidden">
            {/* Header Section */}
            <div className="relative border-b border-app-border bg-app-bg-subtle px-4 py-3">
              <div className="text-center">
                <h3 className="text-lg font-bold text-app-text mb-1">{template.name}</h3>
                <p className="text-sm text-app-muted mb-2">{template.description}</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-4">
              {/* Tags */}
              {template.tags && template.tags.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-app-faint mb-2 uppercase tracking-wider">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {template.tags?.map((tag, index) => (
                      <span key={tag.id || index} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1"></span>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variables */}
              {template.variables && Object.keys(template.variables).length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-app-faint mb-2 uppercase tracking-wider">Variables</p>
                  <div className="bg-app-surface rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(template.variables).map(([key, value], index) => (
                        <div key={index} className="flex items-center">
                          <span className="font-mono text-app-muted bg-app-border px-2 py-1 rounded">{key}</span>
                          <span className="text-app-faint">=</span>
                          <span className="font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">{value}</span>
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
                    <span className="inline-flex items-center px-3 py-1.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 4a2 2 0 00-2 2v6a2 2 0 002 2H6a2 2 0 00-2-2V6a2 2 0 002-2h2a2 2 0 002-2zm6 0H4v2h12V4z"/>
                      </svg>
                      Archived
                    </span>
                  )}
                  {template.status === 'active' && (
                    <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 00-8-8v4a8 8 0 008 8h2a8 8 0 008-8v-4a8 8 0 00-8-8H2a8 8 0 00-8 8z"/>
                      </svg>
                      Active
                    </span>
                  )}
                  {template.status === 'draft' && (
                    <span className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 0l-2.829 2.829a2 2 0 11.414 0l2.829 2.829a2 2 0 01.414 0l2.829-2.829a2 2 0 01.414 0l-2.829-2.829a2 2 0 00-2.828-2.828z"/>
                      </svg>
                      Draft
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1">
                  <button 
                    onClick={() => onViewTemplate(template.id)}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </button>
                  <button 
                    onClick={() => onEditTemplate?.(template.id)}
                    className="inline-flex items-center px-3 py-2 bg-app-muted text-white text-sm font-medium rounded-lg hover:bg-app-bg-subtle"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                  <button 
                    onClick={() => onCloneTemplate?.(template.id)}
                    className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Clone
                  </button>
                  <button 
                    onClick={() => onDeleteTemplate?.(template.id)}
                    disabled={deletingId === template.id}
                    className="inline-flex items-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === template.id ? (
                      <>
                        <div className="w-4 h-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
            <div className="bg-app-surface px-4 py-3 border-t border-app-border">
              <div className="flex justify-between items-center text-xs text-app-faint">
                <div className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6 0l3-3m-3 3v4m0-6h-6"/>
                  </svg>
                  Created {formatRelativeTime(template.createdAt)}
                </div>
                <div className="flex items-center">
                  <div className="flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h5a2 2 0 002-2V7a2 2 0 00-2-2zm0 0h14v14H0z"/>
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
        <div className="text-center py-12">
          <p className="text-app-faint">No templates found matching your criteria.</p>
        </div>
      ) : (
        totalPages > 1 && (
          <div className="bg-app-surface border border-app-border rounded-xl shadow-sm p-6 mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-app-muted bg-app-surface border border-app-border rounded-lg hover:bg-app-surface hover:border-app-border-strong disabled:opacity-40 disabled:cursor-not-allowed"
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
                          <div key={`ellipsis-${index}`} className="flex items-center justify-center w-10 h-10">
                            <MoreHorizontal className="w-4 h-4 text-app-faint" />
                          </div>
                        );
                      }
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          className={`w-10 h-10 text-sm font-medium rounded-lg ${
                            currentPage === page
                              ? 'border border-blue-600 bg-blue-600 text-white'
                              : 'text-app-muted bg-app-surface border border-app-border hover:bg-app-surface hover:border-app-border-strong'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-app-muted bg-app-surface border border-app-border rounded-lg hover:bg-app-surface hover:border-app-border-strong disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {/* Page info */}
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-app-border bg-app-bg-subtle px-4 py-2 text-app-text">
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
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-red-800">Recently Deleted</h3>
            <button
              onClick={() => {
                if (confirm('Clear all deleted templates?')) {
                  setTemplates([]);
                  localStorage.removeItem('deletedTemplates');
                }
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear Trash
            </button>
          </div>
          <div className="space-y-2">
            {deletedTemplates.map((template) => (
              <div key={template.id} className="flex justify-between items-center p-3 bg-app-surface rounded border border-app-border">
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
                    onClick={() => onRestoreTemplate?.(template)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
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
