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
  onEditBinding 
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
      <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-lg">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (bindings.length === 0) {
    return (
      <div className="p-6 text-center text-app-faint text-sm border-2 border-dashed border-app-border rounded-lg">
        <Radio size={24} className="mx-auto mb-2 text-app-faint" />
        <p>No channels bound to this template yet</p>
        <p className="text-xs mt-1">Click "Add Channel" to configure rendering for different platforms</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bindings.map((binding) => (
        <div
          key={binding.id}
          className="bg-app-surface border border-app-border rounded-lg p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Channel Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-app-accent-muted text-app-accent rounded-lg">
                  {getChannelIcon(binding.channel.key)}
                </div>
                <div>
                  <h3 className="font-semibold text-app-text flex items-center gap-2">
                    {binding.channel.name}
                    <span className="text-xs text-app-faint bg-app-elevated px-2 py-1 rounded">
                      {binding.channel.key}
                    </span>
                  </h3>
                  <p className="text-sm text-app-muted">{binding.channel.description}</p>
                </div>
              </div>

              {/* Configuration Preview */}
              <div className="bg-app-surface rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-app-muted">Layout Configuration:</span>
                  <span className="text-xs text-app-faint">
                    Created {new Date(binding.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <pre className="text-xs text-app-muted font-mono overflow-x-auto whitespace-pre-wrap">
                  {formatConfig(binding.layoutConfig)}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => onEditBinding?.(binding)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Edit binding"
              >
                <Edit size={14} />
              </button>
              <button
                onClick={() => handleDeleteBinding(binding.id)}
                disabled={deletingId === binding.id}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
