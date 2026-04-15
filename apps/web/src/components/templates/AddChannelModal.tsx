import { useState, useEffect } from 'react';
import { X, Plus, Loader2, AlertCircle, Check } from 'lucide-react';
import {
  channelService,
  type Channel,
  type CreateBindingRequest,
  type Binding,
} from '../../services';

interface AddChannelModalProps {
  templateId: string;
  templateName: string;
  existingChannelIds: string[];
  editingBinding?: Binding | null;
  onClose: () => void;
  onBindingCreated: () => void;
}

export default function AddChannelModal({
  templateId,
  templateName,
  existingChannelIds,
  editingBinding,
  onClose,
  onBindingCreated,
}: AddChannelModalProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [layoutConfig, setLayoutConfig] = useState(
    '{\n  "layout": "responsive",\n  "fields": ["title", "content", "image"],\n  "mediaHandling": "optimized"\n}',
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const availableChannels = await channelService.listChannels();

        if (editingBinding) {
          // Edit mode: include the current channel
          setChannels(availableChannels);
          setSelectedChannelId(editingBinding.channelId);
          setLayoutConfig(JSON.stringify(editingBinding.layoutConfig, null, 2));
        } else {
          // Add mode: filter out already bound channels
          const unboundChannels = availableChannels.filter(
            (channel) => !existingChannelIds.includes(channel.id),
          );
          setChannels(unboundChannels);

          // Auto-select first channel if available
          if (unboundChannels.length > 0) {
            setSelectedChannelId(unboundChannels[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load channels');
      } finally {
        setLoading(false);
      }
    })();
  }, [existingChannelIds, editingBinding]);

  const validateConfig = (config: string): boolean => {
    try {
      JSON.parse(config);
      setConfigError(null);
      return true;
    } catch (err) {
      setConfigError('Invalid JSON format');
      return false;
    }
  };

  const handleConfigChange = (value: string) => {
    setLayoutConfig(value);
    validateConfig(value);
  };

  const handleSubmit = async () => {
    if (!selectedChannelId) {
      setError('Please select a channel');
      return;
    }

    if (!validateConfig(layoutConfig)) {
      setError('Please fix JSON configuration');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const bindingRequest: CreateBindingRequest = {
        channelId: selectedChannelId,
        layoutConfig: JSON.parse(layoutConfig),
      };

      if (editingBinding) {
        // Update existing binding (delete old and create new)
        await channelService.deleteBinding(templateId, editingBinding.id);
      }

      await channelService.createBinding(templateId, bindingRequest);

      setSuccess(true);
      setTimeout(() => {
        onBindingCreated();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save binding');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-[80vh] bg-[#1a1d2e] border border-app-border rounded-2xl flex flex-col overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-app-border flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Plus size={18} color="#0f766e" />
              <h2 className="text-base font-bold text-app-text m-0">
                {editingBinding ? 'Edit Channel' : 'Add Channel'}
              </h2>
            </div>
            <p className="text-xs text-app-faint m-0 max-w-[350px] overflow-hidden text-ellipsis whitespace-nowrap">
              {templateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-app-surface border-none rounded-lg p-2 text-app-muted cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={24} color="#0f766e" className="animate-spin" />
            </div>
          ) : channels.length === 0 ? (
            <div className="p-8 text-center text-app-faint text-[13px]">
              {existingChannelIds.length > 0
                ? 'All available channels are already bound to this template'
                : 'No channels available'}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  Select Channel
                </label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text text-sm outline-none focus:border-app-accent/50"
                >
                  <option value="">Choose a channel...</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} - {channel.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Channel Info */}
              {selectedChannel && (
                <div className="p-3 bg-app-accent-muted border border-app-accent/25 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-app-accent rounded-full"></div>
                    <span className="text-sm font-medium text-app-accent">
                      {selectedChannel.name}
                    </span>
                    <span className="text-xs text-app-accent">({selectedChannel.key})</span>
                  </div>
                  <p className="text-xs text-app-accent">{selectedChannel.description}</p>
                </div>
              )}

              {/* Layout Configuration */}
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  Layout Configuration (JSON)
                </label>
                <textarea
                  value={layoutConfig}
                  onChange={(e) => handleConfigChange(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text text-sm font-mono outline-none focus:border-app-accent/50 resize-none"
                  placeholder="Enter layout configuration as JSON..."
                />
                {configError && (
                  <div className="mt-2 flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={12} />
                    <span>{configError}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border flex justify-between items-center">
          <span className="text-xs text-app-faint">
            Configure channel-specific rendering settings
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-[18px] py-2.5 bg-app-surface border border-app-border rounded-lg text-app-muted text-[13px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                !selectedChannelId ||
                !!configError ||
                submitting ||
                success ||
                channels.length === 0
              }
              className={`flex items-center gap-1.5 px-5 py-2.5 border-none rounded-lg text-white text-[13px] font-semibold ${
                success
                  ? 'bg-emerald-600 cursor-not-allowed'
                  : !selectedChannelId || !!configError || channels.length === 0
                    ? 'bg-app-accent/30 cursor-not-allowed opacity-50'
                    : 'bg-app-accent cursor-pointer'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />{' '}
                  {editingBinding ? 'Updating...' : 'Creating...'}
                </>
              ) : success ? (
                <>
                  <Check size={14} /> {editingBinding ? 'Updated!' : 'Added!'}
                </>
              ) : (
                <>
                  <Plus size={14} /> {editingBinding ? 'Update Channel' : 'Add Channel'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="px-6 py-2.5 bg-red-400/10 border-t border-red-400/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
