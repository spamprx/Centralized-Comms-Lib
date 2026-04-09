import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Trash2, Save, X, GitCompare, Copy } from 'lucide-react';
import TagEditor from './TagEditor';
import { type Tag } from '../../services';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
  tags?: Tag[];
}

interface TemplateDetailProps {
  templateId: string;
  onBack: () => void;
  templates?: Template[];
  onUpdateTemplate?: (template: Template) => void;
  onCloneTemplate?: (id: string) => void;
  editMode?: boolean;
  cloneInfo?: { originalName: string } | null;
}

export default function TemplateDetail({ templateId, onBack, templates, onUpdateTemplate, onCloneTemplate, editMode, cloneInfo }: TemplateDetailProps) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(editMode || false);
  const [editedTemplate, setEditedTemplate] = useState<Template | null>(null);
  const [versionHistory, setVersionHistory] = useState<Template[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<[Template, Template] | null>(null);
  const [lastClickedVersion, setLastClickedVersion] = useState<string | null>(null);
  const [showCloneBanner, setShowCloneBanner] = useState(!!cloneInfo);
  const [tags, setTags] = useState<Tag[]>([]);

  const mockTemplate: Template = {
    id: `mock_${templateId}`,
    name: 'Blog Post Template',
    description: 'Standard blog post layout with header, content, and footer sections.',
    category: 'Content',
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
*Published on {{date}} by {{author}}*`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    tags: []
  };

  useEffect(() => {
    const foundTemplate = templates?.find(t => t.id === templateId) || mockTemplate;
    setTemplate(foundTemplate);
    setEditedTemplate(foundTemplate);
    
    // Initialize tags from template
    if (foundTemplate.tags) {
      setTags(foundTemplate.tags);
    } else {
      setTags([]);
    }
    
    const savedHistory = localStorage.getItem(`versionHistory_${templateId}`);
    if (savedHistory) {
      setVersionHistory(JSON.parse(savedHistory));
    }
  }, [templateId, templates]);

  // Update editedTemplate when tags change
  useEffect(() => {
    if (editedTemplate) {
      setEditedTemplate(prev => prev ? {...prev, tags} : null);
    }
  }, [tags]);

  // Auto-dismiss clone banner after 5 seconds
  useEffect(() => {
    if (showCloneBanner && cloneInfo) {
      const timer = setTimeout(() => {
        setShowCloneBanner(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showCloneBanner, cloneInfo]);

  const handleSave = () => {
    if (editedTemplate) {
      // Include tags in the saved template
      const templateToSave = {
        ...editedTemplate,
        tags: tags,
      };
      
      if (template && JSON.stringify(template) !== JSON.stringify(templateToSave)) {
        const newHistory = [...versionHistory, { 
          ...template, 
          id: `${template.id}_${Date.now()}`, // Create unique ID
          updatedAt: new Date().toISOString()
        }];
        setVersionHistory(newHistory);
        localStorage.setItem(`versionHistory_${templateId}`, JSON.stringify(newHistory));
      }
      
      setTemplate(templateToSave);
      setIsEditing(false);
      
      if (onUpdateTemplate) {
        onUpdateTemplate(templateToSave);
      }
    }
  };

  const handleDeleteVersion = (versionToDelete: Template) => {
    const newHistory = versionHistory.filter(v => v.id !== versionToDelete.id);
    setVersionHistory(newHistory);
    localStorage.setItem(`versionHistory_${templateId}`, JSON.stringify(newHistory));
  };

  const handleRevert = (oldVersion: Template) => {
    setEditedTemplate(oldVersion);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedTemplate(template);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (template && confirm('Are you sure you want to delete this template?')) {
      console.log('Deleting template:', template.id);
      onBack();
    }
  };

  const handleClone = () => {
    if (template && onCloneTemplate) {
      onCloneTemplate(template.id);
    }
  };

  const getDiffLines = (content1: string, content2: string) => {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    
    const diffs: Array<{
      line: number; 
      type: 'added' | 'removed' | 'unchanged' | 'modified'; 
      content: string;
      content2?: string;
    }> = [];
    
    // Check if there are any actual differences
    let hasDifferences = false;
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      
      if (line1 === line2) {
        diffs.push({ line: i + 1, type: 'unchanged', content: line1 });
      } else if (line1 && !line2) {
        diffs.push({ line: i + 1, type: 'removed', content: line1 });
        hasDifferences = true;
      } else if (!line1 && line2) {
        diffs.push({ line: i + 1, type: 'added', content: line2 });
        hasDifferences = true;
      } else {
        diffs.push({ line: i + 1, type: 'modified', content: line1, content2: line2 });
        hasDifferences = true;
      }
    }
    
    return { diffs, hasDifferences };
  };

  if (!template) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Clone Banner */}
      {showCloneBanner && cloneInfo && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <Copy className="w-5 h-5 text-green-600 mr-3" />
            <span className="text-green-800 font-medium">
              Cloned from "{cloneInfo.originalName}"
            </span>
          </div>
          <button
            onClick={() => setShowCloneBanner(false)}
            className="text-green-600 hover:text-green-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </button>
        
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Template
              </button>
              <button
                onClick={handleClone}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Clone
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {versionHistory.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Version History ({versionHistory.length} versions)</h3>
            {selectedVersions && (
              <button
                onClick={() => {
                  setSelectedVersions(null);
                  setLastClickedVersion(null);
                }}
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {versionHistory.map((version, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Version {versionHistory.length - index}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(version.updatedAt || Date.now()).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (lastClickedVersion === version.id) {
                        // This version was last clicked - hide diff
                        setSelectedVersions(null);
                        setLastClickedVersion(null);
                      } else {
                        // This version was not last clicked - show diff
                        const previousVersion = template;
                        setSelectedVersions([previousVersion, version]);
                        setLastClickedVersion(version.id);
                      }
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <GitCompare className="w-3 h-3" />
                    {lastClickedVersion === version.id ? 'Hide Diff' : 'Show Diff'}
                  </button>
                  <button
                    onClick={() => handleRevert(version)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                  >
                    Revert
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete version ${versionHistory.length - index}? This action cannot be undone.`)) {
                        handleDeleteVersion(version);
                      }
                    }}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedVersions && (
        <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Version Comparison</h3>
            <button
              onClick={() => {
                setSelectedVersions(null);
                setLastClickedVersion(null);
              }}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="space-y-1">
              {(() => {
                const { diffs, hasDifferences } = getDiffLines(selectedVersions[0].content, selectedVersions[1].content);
                
                if (!hasDifferences) {
                  return (
                    <div className="text-gray-400 text-center py-8">
                      <p>No differences found between these versions</p>
                    </div>
                  );
                }
                
                return diffs.map((diff, index) => (
                  <div key={index} className={`${
                    diff.type === 'added' ? 'text-green-400' : 
                    diff.type === 'removed' ? 'text-red-400' : 
                    diff.type === 'modified' ? 'text-yellow-400' : 
                    'text-gray-400'
                  }`}>
                    <span className="text-xs mr-2">Line {diff.line}:</span>
                    <span className="font-mono">
                      {diff.type === 'modified' ? (
                        <>
                          <span className="line-through text-gray-500">{diff.content}</span>
                          <span className="text-green-400">{diff.content2}</span>
                        </>
                      ) : (
                        diff.content
                      )}
                    </span>
                  </div>
                ));
              })()}
            </div>
            <div className="mt-4 text-center text-sm text-gray-400">
              <p>Comparing: {selectedVersions[0].name || 'Current Version'} vs {selectedVersions[1].name}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedTemplate?.name || ''}
                  onChange={(e) => setEditedTemplate(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <h3 className="text-xl font-semibold text-gray-900">{template?.name}</h3>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              {isEditing ? (
                <select
                  value={editedTemplate?.category || ''}
                  onChange={(e) => setEditedTemplate(prev => prev ? {...prev, category: e.target.value} : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Content">Content</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Documentation">Documentation</option>
                </select>
              ) : (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {template?.category}
                </span>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              {isEditing ? (
                <select
                  value={editedTemplate?.status || 'active'}
                  onChange={(e) => setEditedTemplate(prev => prev ? {...prev, status: e.target.value as 'active' | 'draft' | 'archived'} : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              ) : (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  template?.status === 'active' ? 'bg-green-100 text-green-800' :
                  template?.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {template?.status}
                </span>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              {isEditing ? (
                <textarea
                  value={editedTemplate?.description || ''}
                  onChange={(e) => setEditedTemplate(prev => prev ? {...prev, description: e.target.value} : null)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-600">{template?.description}</p>
              )}
            </div>

            <TagEditor
              templateId={templateId}
              isEditing={isEditing}
              tags={tags}
              onTagsChange={setTags}
            />

            <div className="text-sm text-gray-500">
              <p>Created: {template?.createdAt}</p>
              <p>Updated: {template?.updatedAt}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Template Content</label>
            {isEditing ? (
              <textarea
                value={editedTemplate?.content || ''}
                onChange={(e) => setEditedTemplate(prev => prev ? {...prev, content: e.target.value} : null)}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Enter template content with placeholders like {{title}}, {{content}}, etc."
              />
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {template?.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
