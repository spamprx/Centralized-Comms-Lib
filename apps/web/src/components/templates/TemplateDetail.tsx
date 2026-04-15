import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Trash2, Save, X, GitCompare, Copy, Plus, Globe } from 'lucide-react';
import TagEditor from './TagEditor';
import AddChannelModal from './AddChannelModal';
import ChannelBindings from './ChannelBindings';
import TranslationPreview from './TranslationPreview';
import { templateService, channelService, type Tag, type Binding } from '../../services';

interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
  tags?: Tag[];
  bindings?: Binding[];
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

export default function TemplateDetail({
  templateId,
  onBack,
  templates,
  onUpdateTemplate,
  onCloneTemplate,
  editMode,
  cloneInfo,
}: TemplateDetailProps) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(editMode || false);
  const [editedTemplate, setEditedTemplate] = useState<Template | null>(null);
  const [versionHistory, setVersionHistory] = useState<Template[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<[Template, Template] | null>(null);
  const [lastClickedVersion, setLastClickedVersion] = useState<string | null>(null);
  const [showCloneBanner, setShowCloneBanner] = useState(!!cloneInfo);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [editingBinding, setEditingBinding] = useState<Binding | null>(null);
  const [showTranslationModal, setShowTranslationModal] = useState(false);

  const mockTemplate: Template = {
    id: `mock_${templateId}`,
    name: 'Blog Post Template',
    description: 'Standard blog post layout with header, content, and footer sections.',
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
    tags: [],
  };

  useEffect(() => {
    const foundTemplate = templates?.find((t) => t.id === templateId) || mockTemplate;
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
      setEditedTemplate((prev) => (prev ? { ...prev, tags } : null));
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

  // Load bindings when template changes
  useEffect(() => {
    if (templateId) {
      loadBindings();
    }
  }, [templateId]);

  const loadBindings = async () => {
    try {
      const templateBindings = await channelService.getBindings(templateId);
      // Force re-render by creating new array reference
      setBindings([...templateBindings]);
    } catch (error) {
      console.error('Failed to load bindings:', error);
      setBindings([]);
    }
  };

  const handleBindingUpdated = () => {
    // Add small delay to ensure localStorage operations complete
    setTimeout(() => {
      loadBindings();
    }, 100);
  };

  const handleEditBinding = (binding: Binding) => {
    setEditingBinding(binding);
    setShowAddChannelModal(true);
  };

  const handleSave = async () => {
    if (editedTemplate) {
      try {
        // Include tags in the saved template
        const templateToSave = {
          ...editedTemplate,
          tags: tags,
        };

        // Save to API first
        const updatedTemplate = await templateService.update(template!.id, templateToSave);

        if (updatedTemplate) {
          if (template && JSON.stringify(template) !== JSON.stringify(templateToSave)) {
            const newHistory = [
              ...versionHistory,
              {
                ...template,
                id: `${template.id}_${Date.now()}`, // Create unique ID
                updatedAt: new Date().toISOString(),
              },
            ];
            setVersionHistory(newHistory);
            localStorage.setItem(`versionHistory_${templateId}`, JSON.stringify(newHistory));
          }

          setTemplate(updatedTemplate);
          setIsEditing(false);

          if (onUpdateTemplate) {
            onUpdateTemplate(updatedTemplate);
          }

          console.log('Template updated successfully:', updatedTemplate);
        } else {
          // API returned null, fall back to local update
          if (template && JSON.stringify(template) !== JSON.stringify(templateToSave)) {
            const newHistory = [
              ...versionHistory,
              {
                ...template,
                id: `${template.id}_${Date.now()}`, // Create unique ID
                updatedAt: new Date().toISOString(),
              },
            ];
            setVersionHistory(newHistory);
            localStorage.setItem(`versionHistory_${templateId}`, JSON.stringify(newHistory));
          }

          setTemplate(templateToSave);
          setIsEditing(false);

          if (onUpdateTemplate) {
            onUpdateTemplate(templateToSave);
          }

          console.log('Template updated locally (API returned null):', templateToSave);
        }
      } catch (error) {
        console.error('Failed to update template:', error);
        // Fallback to localStorage if API fails
        const templateToSave = {
          ...editedTemplate,
          tags: tags,
        };

        if (template && JSON.stringify(template) !== JSON.stringify(templateToSave)) {
          const newHistory = [
            ...versionHistory,
            {
              ...template,
              id: `${template.id}_${Date.now()}`, // Create unique ID
              updatedAt: new Date().toISOString(),
            },
          ];
          setVersionHistory(newHistory);
          localStorage.setItem(`versionHistory_${templateId}`, JSON.stringify(newHistory));
        }

        setTemplate(templateToSave);
        setIsEditing(false);

        if (onUpdateTemplate) {
          onUpdateTemplate(templateToSave);
        }
      }
    }
  };

  const handleDeleteVersion = (versionToDelete: Template) => {
    const newHistory = versionHistory.filter((v) => v.id !== versionToDelete.id);
    setVersionHistory(newHistory);
    localStorage.setItem(`versionHistory_${templateId}`, JSON.stringify(newHistory));
  };

  const handleRevert = (oldVersion: Template) => {
    setEditedTemplate(oldVersion);
    setIsEditing(true);
  };

  const showDiffViewer = (version1: Template, version2: Template) => {
    setSelectedVersions([version1, version2]);
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
            <div className="h-8 bg-app-border rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-app-border rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-app-border rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-app-page py-app-page md:px-app-page-lg">
        {/* Clone Banner */}
        {showCloneBanner && cloneInfo && (
          <div className="mb-6 flex items-center justify-between rounded-app-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center">
              <Copy className="mr-3 h-5 w-5 text-emerald-400" />
              <span className="font-medium text-emerald-100">
                Cloned from "{cloneInfo.originalName}"
              </span>
            </div>
            <button
              onClick={() => setShowCloneBanner(false)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-app-muted hover:text-app-text"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </button>

          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 rounded-app-md bg-app-accent px-4 py-2 text-white"
                >
                  <Edit className="w-4 h-4" />
                  Edit Template
                </button>
                <button
                  onClick={handleClone}
                  className="flex items-center gap-2 rounded-app-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
                >
                  <Copy className="w-4 h-4" />
                  Clone
                </button>
                <button
                  onClick={() => setShowAddChannelModal(true)}
                  className="flex items-center gap-2 rounded-app-md border border-app-border bg-app-elevated px-4 py-2 text-app-text hover:bg-app-surface-hover"
                >
                  <Plus className="w-4 h-4" />
                  Add Channel
                </button>
                <button
                  onClick={() => setShowTranslationModal(true)}
                  className="flex items-center gap-2 rounded-app-md border border-app-border bg-app-surface px-4 py-2 text-app-text hover:bg-app-surface-hover"
                >
                  <Globe className="w-4 h-4" />
                  Translation Preview
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 rounded-app-md bg-red-600 px-4 py-2 text-white hover:bg-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 rounded-app-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 rounded-app-md bg-app-elevated px-4 py-2 text-app-text hover:bg-app-surface-hover"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {versionHistory.length > 0 && (
          <div className="mt-6 rounded-app-lg border border-app-border bg-app-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-app-text">
                Version History ({versionHistory.length} versions)
              </h3>
              {selectedVersions && (
                <button
                  onClick={() => {
                    setSelectedVersions(null);
                    setLastClickedVersion(null);
                  }}
                  className="text-sm text-app-muted hover:text-app-text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {versionHistory.map((version, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-app-md border border-app-border bg-app-bg/40 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-app-text">
                      Version {versionHistory.length - index}
                    </p>
                    <p className="text-xs text-app-faint">
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
                          showDiffViewer(previousVersion, version);
                          setLastClickedVersion(version.id);
                        }
                      }}
                      className="flex items-center gap-1 rounded-app-md bg-app-accent px-3 py-1 text-sm text-white"
                    >
                      <GitCompare className="w-3 h-3" />
                      {lastClickedVersion === version.id ? 'Hide Diff' : 'Show Diff'}
                    </button>
                    <button
                      onClick={() => handleRevert(version)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Revert
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete version ${versionHistory.length - index}? This action cannot be undone.`,
                          )
                        ) {
                          handleDeleteVersion(version);
                        }
                      }}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
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
          <div className="mt-6 rounded-app-lg border border-app-border bg-app-bg-subtle p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-app-text">Version Comparison</h3>
              <button
                onClick={() => {
                  setSelectedVersions(null);
                  setLastClickedVersion(null);
                }}
                className="text-app-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-app-bg-subtle rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-1">
                {(() => {
                  const { diffs, hasDifferences } = getDiffLines(
                    selectedVersions[0].content,
                    selectedVersions[1].content,
                  );

                  if (!hasDifferences) {
                    return (
                      <div className="text-app-faint text-center py-8">
                        <p>No differences found between these versions</p>
                      </div>
                    );
                  }

                  return diffs.map((diff, index) => (
                    <div
                      key={index}
                      className={`${
                        diff.type === 'added'
                          ? 'text-green-400'
                          : diff.type === 'removed'
                            ? 'text-red-400'
                            : diff.type === 'modified'
                              ? 'text-yellow-400'
                              : 'text-app-faint'
                      }`}
                    >
                      <span className="text-xs mr-2">Line {diff.line}:</span>
                      <span className="font-mono">
                        {diff.type === 'modified' ? (
                          <>
                            <span className="line-through text-app-faint">{diff.content}</span>
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
              <div className="mt-4 text-center text-sm text-app-faint">
                <p>
                  Comparing: {selectedVersions[0].name || 'Current Version'} vs{' '}
                  {selectedVersions[1].name}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-app-lg border border-app-border bg-app-surface p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-app-text">Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTemplate?.name || ''}
                    onChange={(e) =>
                      setEditedTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null))
                    }
                    className="w-full rounded-lg border border-amber-500/40 bg-app-bg/40 px-3 py-2 text-app-text outline-none focus:ring-2 focus:ring-amber-500/60"
                  />
                ) : (
                  <h3 className="text-xl font-semibold text-app-text">{template?.name}</h3>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-app-muted mb-2">Status</label>
                {isEditing ? (
                  <select
                    value={editedTemplate?.status || 'active'}
                    onChange={(e) =>
                      setEditedTemplate((prev) =>
                        prev
                          ? { ...prev, status: e.target.value as 'active' | 'draft' | 'archived' }
                          : null,
                      )
                    }
                    className="w-full rounded-lg border border-amber-500/40 bg-app-bg/40 px-3 py-2 text-app-text outline-none focus:ring-2 focus:ring-amber-500/60"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                ) : (
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      template?.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : template?.status === 'draft'
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-app-elevated text-app-text'
                    }`}
                  >
                    {template?.status}
                  </span>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-app-muted mb-2">Description</label>
                {isEditing ? (
                  <textarea
                    value={editedTemplate?.description || ''}
                    onChange={(e) =>
                      setEditedTemplate((prev) =>
                        prev ? { ...prev, description: e.target.value } : null,
                      )
                    }
                    rows={4}
                    className="w-full rounded-lg border border-amber-500/40 bg-app-bg/40 px-3 py-2 text-app-text outline-none focus:ring-2 focus:ring-amber-500/60"
                  />
                ) : (
                  <p className="text-app-muted">{template?.description}</p>
                )}
              </div>

              <TagEditor
                templateId={templateId}
                isEditing={isEditing}
                tags={tags}
                onTagsChange={setTags}
              />

              <div className="text-sm text-app-faint">
                <p>Created: {template?.createdAt}</p>
                <p>Updated: {template?.updatedAt}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-muted mb-2">
                Template Content
              </label>
              {isEditing ? (
                <textarea
                  value={editedTemplate?.content || ''}
                  onChange={(e) =>
                    setEditedTemplate((prev) =>
                      prev ? { ...prev, content: e.target.value } : null,
                    )
                  }
                  rows={20}
                  className="w-full rounded-lg border border-app-border bg-app-bg/40 px-3 py-2 font-mono text-sm text-app-text outline-none focus:ring-2 focus:ring-app-accent"
                  placeholder="Enter template content with placeholders like {{title}}, {{content}}, etc."
                />
              ) : (
                <div className="rounded-app-lg border border-app-border bg-app-bg/50 p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-app-muted">
                    {template?.content}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Channel Bindings Section */}
        <div className="mt-6 bg-app-surface rounded-lg border border-app-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-app-text">Channel Bindings</h3>
            <button
              onClick={() => setShowAddChannelModal(true)}
              className="flex items-center gap-2 rounded-app-md border border-app-border bg-app-elevated px-3 py-1.5 text-sm text-app-text hover:bg-app-surface-hover"
            >
              <Plus className="w-4 h-4" />
              Add Channel
            </button>
          </div>
          <ChannelBindings
            templateId={templateId}
            bindings={bindings}
            onBindingUpdated={handleBindingUpdated}
            onEditBinding={handleEditBinding}
          />
        </div>
      </div>

      {/* Add Channel Modal */}
      {showAddChannelModal && (
        <AddChannelModal
          templateId={templateId}
          templateName={template?.name || ''}
          existingChannelIds={bindings.map((b) => b.channelId)}
          editingBinding={editingBinding}
          onClose={() => {
            setShowAddChannelModal(false);
            setEditingBinding(null);
          }}
          onBindingCreated={handleBindingUpdated}
        />
      )}

      {/* Translation Preview Modal */}
      {showTranslationModal && template && (
        <TranslationPreview
          templateId={template.id}
          templateName={template.name}
          templateContent={template.content}
          onClose={() => setShowTranslationModal(false)}
        />
      )}
    </>
  );
}
