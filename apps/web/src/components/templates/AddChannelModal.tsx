import { useState, useEffect } from 'react';
import { X, Plus, Loader2, AlertCircle, Check } from 'lucide-react';
import {
  channelService,
  type Channel,
  type CreateBindingRequest,
  type Binding,
} from '../../services';
import { formInputClass, formSelectClass, formLabelClass } from '../ui';

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-[520px] flex-col overflow-hidden rounded-app-xl border border-white/[0.12] bg-app-bg/85 shadow-app-glow backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/40 to-transparent"
        />
        <div className="relative flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-app-md bg-gradient-to-br from-app-accent/30 to-app-accent-2/20 text-app-accent ring-1 ring-white/10">
                <Plus size={18} />
              </span>
              <h2 className="m-0 text-base font-bold text-app-text">
                {editingBinding ? 'Edit Channel' : 'Add Channel'}
              </h2>
            </div>
            <p className="m-0 max-w-[350px] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-app-faint">
              {templateName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-app-md border border-white/10 bg-white/[0.05] p-2 text-app-muted transition-colors hover:bg-white/10 hover:text-app-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={24} className="animate-spin text-app-accent" />
            </div>
          ) : channels.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-app-faint">
              {existingChannelIds.length > 0
                ? 'All available channels are already bound to this template'
                : 'No channels available'}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={formLabelClass}>Select Channel</label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className={`${formSelectClass} mt-1.5 text-sm`}
                >
                  <option value="">Choose a channel...</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} - {channel.description}
                    </option>
                  ))}
                </select>
              </div>

              {selectedChannel && (
                <div className="rounded-app-lg border border-app-accent/30 bg-app-accent/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-app-accent-2 shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                    <span className="text-sm font-medium text-app-text">
                      {selectedChannel.name}
                    </span>
                    <span className="text-xs text-app-accent">({selectedChannel.key})</span>
                  </div>
                  <p className="text-xs text-app-muted">{selectedChannel.description}</p>
                </div>
              )}

              <div>
                <label className={formLabelClass}>Layout Configuration (JSON)</label>
                <textarea
                  value={layoutConfig}
                  onChange={(e) => handleConfigChange(e.target.value)}
                  rows={8}
                  className={`${formInputClass} mt-1.5 resize-none font-mono text-sm`}
                  placeholder="Enter layout configuration as JSON..."
                />
                {configError && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-red-300">
                    <AlertCircle size={12} />
                    <span>{configError}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-4">
          <span className="text-xs text-app-faint">
            Configure channel-specific rendering settings
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-app-md border border-white/10 bg-white/[0.05] px-[18px] py-2.5 text-[13px] text-app-muted transition-colors hover:bg-white/10 hover:text-app-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !selectedChannelId ||
                !!configError ||
                submitting ||
                success ||
                channels.length === 0
              }
              className={`flex items-center gap-1.5 rounded-app-md border-none px-5 py-2.5 text-[13px] font-semibold text-app-bg transition-[transform,opacity,filter] duration-(--duration-app) ease-app-out active:scale-[0.98] ${
                success
                  ? 'cursor-not-allowed bg-emerald-600'
                  : !selectedChannelId || !!configError || channels.length === 0
                    ? 'cursor-not-allowed bg-app-accent/35 opacity-50'
                    : 'cursor-pointer bg-gradient-to-r from-app-accent to-app-accent-2 shadow-[0_0_24px_-8px_rgba(147,124,248,0.5)] hover:brightness-105'
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

        {error && (
          <div className="border-t border-red-400/25 bg-red-500/10 px-6 py-2.5 text-center text-xs text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
