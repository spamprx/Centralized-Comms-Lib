import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { tagService, type Tag, type TemplateTag } from '../../services';

interface TagEditorProps {
  templateId: string;
  isEditing: boolean;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  templateTags?: Tag[]; // Add this to get current template tags
}

export default function TagEditor({ templateId, isEditing, tags, onTagsChange, templateTags: _initialTemplateTags }: TagEditorProps) {
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

  // Filter suggestions based on input
  useEffect(() => {
    if (newTagName.trim()) {
      const filtered = availableTags.filter(tag => 
        !tags.some(t => t.id === tag.id) && // Exclude already added tags
        tag.name.toLowerCase().includes(newTagName.trim().toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      // Show all available tags when input is empty
      const filtered = availableTags.filter(tag => 
        !tags.some(t => t.id === tag.id)
      );
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
      let tag = availableTags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase());
      
      // Create new tag if it doesn't exist
      if (!tag) {
        try {
          tag = await tagService.create({ name: newTagName.trim() });
          setAvailableTags(prev => [...prev, tag!]);
        } catch (createErr) {
          console.error('Failed to create tag:', createErr);
          // Create a temporary tag object for localStorage fallback
          tag = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: newTagName.trim(),
            slug: newTagName.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
          };
        }
      }

      // Add tag to template
      try {
        const templateTag = await tagService.addTagToTemplate(templateId, tag.id, tag);
        setTemplateTags(prev => [...prev, templateTag]);
      } catch (addErr) {
        console.error('Failed to add tag to template:', addErr);
        // Create a temporary template tag for localStorage fallback
        const templateTag = {
          id: `temp_tt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          templateId,
          tagId: tag.id,
          tag,
        };
        setTemplateTags(prev => [...prev, templateTag]);
      }
      
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

      try {
        await tagService.removeTagFromTemplate(templateId, tagId);
        
        // Update template tags
        const updatedTemplateTags = templateTags.filter(tt => tt.tagId !== tagId);
        setTemplateTags(updatedTemplateTags);
      } catch (removeErr) {
        console.error('Failed to remove tag from template:', removeErr);
        // Fallback: just update local state
        const updatedTemplateTags = templateTags.filter(tt => tt.tagId !== tagId);
        setTemplateTags(updatedTemplateTags);
      }
      
      // Update tags list
      const updatedTags = tags.filter(t => t.id !== tagId);
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <span className="text-gray-500 text-sm">No tags</span>
          ) : (
            tags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
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
      <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
      
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {/* Existing Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.length === 0 ? (
          <span className="text-gray-500 text-sm">No tags</span>
        ) : (
          tags.map((tag, index) => (
            <span
              key={tag.id || `tag-${index}`}
              className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                disabled={loading}
                className="ml-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                title="Remove tag"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>
      
      {/* Add New Tag */}
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
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddTag}
            disabled={loading || !newTagName.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        
        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.slice(0, 10).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setNewTagName(tag.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                >
                  <span className="text-sm">{tag.name}</span>
                  <span className="text-xs text-gray-500">{tag.slug}</span>
                </button>
              ))
            ) : newTagName.trim() ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching tags. Press "Add" to create "{newTagName.trim()}"
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No available tags to add
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
