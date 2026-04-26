import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { tagService, type Tag, type TemplateTag } from '../../services';
import { formInputClass } from '../ui';

interface TagEditorProps {
  templateId: string;
  isEditing: boolean;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  templateTags?: Tag[]; // Add this to get current template tags
}

export default function TagEditor({
  templateId,
  isEditing,
  tags,
  onTagsChange,
  templateTags: _initialTemplateTags,
}: TagEditorProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [templateTags, setTemplateTags] = useState<TemplateTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoading(true);
        setError(null);

        const allTags = await tagService.list();
        setAvailableTags(allTags);
        setFilteredSuggestions(allTags); // Initially show all tags

        console.log('Loaded tags:', allTags);
      } catch (err) {
        console.error('Failed to load tags:', err);
        setError('Failed to load tags');
        setAvailableTags([]);
        setFilteredSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadTags();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadTemplateTags = async () => {
      try {
        const linked = await tagService.getTemplateTags(templateId);
        if (!cancelled) setTemplateTags(linked);
      } catch {
        if (!cancelled) setTemplateTags([]);
      }
    };
    void loadTemplateTags();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Filter suggestions based on input
  useEffect(() => {
    if (newTagName.trim()) {
      const filtered = availableTags.filter(
        (tag) =>
          !tags.some((t) => t.id === tag.id) && // Exclude already added tags
          tag.name.toLowerCase().includes(newTagName.trim().toLowerCase()),
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      // Show all available tags when input is empty
      const filtered = availableTags.filter((tag) => !tags.some((t) => t.id === tag.id));
      setFilteredSuggestions(filtered);
      setShowSuggestions(false);
    }
  }, [newTagName, availableTags, tags]);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    try {
      setLoading(true);
      setError(null);

      // Check if tag already exists
      let tag = availableTags.find((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase());

      // Create new tag if it doesn't exist
      if (!tag) {
        tag = await tagService.create({ name: newTagName.trim() });
        setAvailableTags((prev) => [...prev, tag!]);
      }

      // Add tag to template
      const templateTag = await tagService.addTagToTemplate(templateId, tag.id, tag);
      setTemplateTags((prev) => [...prev, templateTag]);

      // Update tags list
      const updatedTags = [...tags, tag];
      onTagsChange(updatedTags);

      setNewTagName('');
    } catch (err) {
      console.error('Unexpected error in handleAddTag:', err);
      setError('Failed to add tag');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      setLoading(true);
      setError(null);

      await tagService.removeTagFromTemplate(templateId, tagId);
      const updatedTemplateTags = templateTags.filter((tt) => tt.tagId !== tagId);
      setTemplateTags(updatedTemplateTags);

      // Update tags list
      const updatedTags = tags.filter((t) => t.id !== tagId);
      onTagsChange(updatedTags);
    } catch (err) {
      console.error('Unexpected error in handleRemoveTag:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="mb-6">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-app-faint">
          Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <span className="text-sm text-app-faint">No tags</span>
          ) : (
            tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full border border-app-accent/25 bg-app-accent/12 px-3 py-1 text-sm font-medium text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                {tag.name}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-app-faint">
        Tags
      </label>

      {error && (
        <div className="mb-2 rounded-app-lg border border-red-400/35 bg-red-500/10 p-2 text-sm text-red-200 backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <span className="text-sm text-app-faint">No tags</span>
        ) : (
          tags.map((tag, index) => (
            <span
              key={tag.id || `tag-${index}`}
              className="inline-flex items-center rounded-full border border-app-accent/30 bg-app-accent/15 px-3 py-1 text-sm font-medium text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={loading}
                className="ml-1.5 rounded-full p-0.5 text-app-accent transition-colors hover:bg-white/10 hover:text-app-text disabled:opacity-50"
                title="Remove tag"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Type to search tags or add new..."
            disabled={loading}
            className={`${formInputClass} flex-1 text-sm`}
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={loading || !newTagName.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-app-md bg-gradient-to-r from-app-accent to-app-accent-2 px-3 py-2 text-sm font-semibold text-app-bg shadow-[0_0_20px_-8px_rgba(147,124,248,0.45)] ring-1 ring-white/15 transition-[transform,opacity] duration-(--duration-app) ease-app-out hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {showSuggestions && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-app-lg border border-white/[0.1] bg-app-bg/90 py-1 shadow-app-lift backdrop-blur-xl">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.slice(0, 10).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setNewTagName(tag.name);
                    setShowSuggestions(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06]"
                >
                  <span>{tag.name}</span>
                  <span className="text-xs text-app-faint">{tag.slug}</span>
                </button>
              ))
            ) : newTagName.trim() ? (
              <div className="px-3 py-2 text-sm text-app-faint">
                No matching tags. Press "Add" to create "{newTagName.trim()}"
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-app-faint">No available tags to add</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
