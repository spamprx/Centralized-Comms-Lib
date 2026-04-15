import { useState } from 'react';
import { Edit, Trash2, Mail, Loader2, AlertCircle, MessageCircle, Radio } from 'lucide-react';
import { channelService, type Binding } from '../../services';

interface ChannelBindingsProps {
  templateId: string;
  bindings: Binding[];
  onBindingUpdated: () => void;
  onEditBinding?: (binding: Binding) => void;
}

export default function ChannelBindings({
  templateId,
  bindings,
  onBindingUpdated,
  onEditBinding,
}: ChannelBindingsProps) {
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteBinding = async (bindingId: string) => {
    if (!confirm('Are you sure you want to remove this channel binding?')) {
      return;
    }

    setDeletingId(bindingId);
    try {
      await channelService.deleteBinding(templateId, bindingId);
      onBindingUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove binding');
    } finally {
      setDeletingId(null);
    }
  };

  const getChannelIcon = (channelKey: string) => {
    switch (channelKey.toLowerCase()) {
      case 'email':
        return <Mail size={16} />;
      case 'whatsapp':
      case 'sms':
        return <MessageCircle size={16} />;
      case 'push':
        return <Radio size={16} />;
      default:
        return <Radio size={16} />;
    }
  };

  const formatConfig = (config: Record<string, any>) => {
    try {
      return JSON.stringify(config, null, 2);
    } catch {
      return JSON.stringify(config);
    }
  };

  if (error) {
    return (
      <div className="rounded-app-xl border border-red-400/35 bg-red-500/10 p-4 shadow-app-soft backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm text-red-300">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (bindings.length === 0) {
    return (
      <div className="rounded-app-xl border border-dashed border-white/15 bg-app-bg/35 p-8 text-center shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/28">
        <Radio size={24} className="mx-auto mb-2 text-app-accent/70" />
        <p className="text-sm text-app-muted">No channels bound to this template yet</p>
        <p className="mt-1 text-xs text-app-faint">
          Click "Add Channel" to configure rendering for different platforms
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bindings.map((binding) => (
        <div
          key={binding.id}
          className="relative overflow-hidden rounded-app-xl border border-white/[0.09] bg-app-bg/40 p-4 shadow-app-lift backdrop-blur-md transition-[border-color,box-shadow] duration-(--duration-app-slow) ease-app-out hover:border-white/14 hover:shadow-app-soft supports-backdrop-filter:bg-app-bg/30"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent-2/30 to-transparent"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-app-md border border-app-accent/30 bg-app-accent-muted/50 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {getChannelIcon(binding.channel.key)}
                </div>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 font-semibold text-app-text">
                    <span className="truncate">{binding.channel.name}</span>
                    <span className="rounded-app-sm border border-white/10 bg-white/[0.05] px-2 py-0.5 text-xs text-app-faint">
                      {binding.channel.key}
                    </span>
                  </h3>
                  <p className="text-sm text-app-muted">{binding.channel.description}</p>
                </div>
              </div>

              <div className="rounded-app-lg border border-white/[0.08] bg-black/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-app-muted">Layout Configuration:</span>
                  <span className="text-xs text-app-faint">
                    Created {new Date(binding.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-app-muted">
                  {formatConfig(binding.layoutConfig)}
                </pre>
              </div>
            </div>

            <div className="ml-2 flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onEditBinding?.(binding)}
                className="rounded-app-md border border-transparent p-2 text-app-accent transition-[background-color,border-color,transform] duration-(--duration-app) ease-app-out hover:border-app-accent/30 hover:bg-app-accent/15 active:scale-95"
                title="Edit binding"
              >
                <Edit size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBinding(binding.id)}
                disabled={deletingId === binding.id}
                className="rounded-app-md border border-transparent p-2 text-red-400/90 transition-[background-color,border-color,transform] duration-(--duration-app) ease-app-out hover:border-red-400/25 hover:bg-red-500/12 disabled:opacity-50"
                title="Remove binding"
              >
                {deletingId === binding.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
