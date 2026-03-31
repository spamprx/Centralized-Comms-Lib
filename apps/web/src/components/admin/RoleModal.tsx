import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Role, Permission } from '../../types/admin';

interface RoleModalProps {
  role?: Role | null;
  onClose: () => void;
  onSave: (data: Omit<Role, 'id' | 'userCount' | 'createdAt'>) => Promise<void>;
}

const RESOURCES = ['users', 'roles', 'content', 'reports', 'settings', 'analytics', 'groups'];
const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;

export default function RoleModal({ role, onClose, onSave }: RoleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      });
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (resource: string, action: (typeof ACTIONS)[number]) => {
    setFormData(prev => {
      const exists = prev.permissions.find(p => p.resource === resource && p.action === action);
      if (exists) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => !(p.resource === resource && p.action === action)),
        };
      }
      return {
        ...prev,
        permissions: [...prev.permissions, { id: `${resource}-${action}`, resource, action }],
      };
    });
  };

  const hasPermission = (resource: string, action: (typeof ACTIONS)[number]) => {
    return formData.permissions.some(p => p.resource === resource && p.action === action);
  };

  return (
    <div className="role-modal-overlay" onClick={onClose}>
      <div className="role-modal" onClick={e => e.stopPropagation()}>
        <div className="role-modal-header">
          <h2>{role ? 'Edit Role' : 'Create Role'}</h2>
          <button className="role-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="role-modal-form">
          {error && <div className="role-modal-error">{error}</div>}

          <div className="role-modal-field">
            <label>Role Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Content Manager"
              required
            />
          </div>

          <div className="role-modal-field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role's purpose..."
              rows={3}
              required
            />
          </div>

          <div className="role-modal-field">
            <label>Permissions</label>
            <div className="role-permissions-grid">
              <div className="role-permissions-header">
                <span>Resource</span>
                {ACTIONS.map(action => (
                  <span key={action} className="role-perm-action">{action}</span>
                ))}
              </div>
              {RESOURCES.map(resource => (
                <div key={resource} className="role-permissions-row">
                  <span className="role-perm-resource">{resource}</span>
                  {ACTIONS.map(action => (
                    <label key={action} className="role-perm-checkbox">
                      <input
                        type="checkbox"
                        checked={hasPermission(resource, action)}
                        onChange={() => togglePermission(resource, action)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="role-modal-actions">
            <button type="button" className="role-modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="role-modal-btn-save" disabled={loading}>
              {loading ? 'Saving...' : (role ? 'Update Role' : 'Create Role')}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .role-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .role-modal {
          background: #1a1d29;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        .role-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .role-modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #e2e4f0;
        }
        .role-modal-close {
          background: none;
          border: none;
          color: #555870;
          cursor: pointer;
          padding: 4px;
          display: flex;
          border-radius: 4px;
        }
        .role-modal-close:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #e2e4f0;
        }
        .role-modal-form {
          padding: 24px;
        }
        .role-modal-error {
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 8px;
          padding: 12px;
          color: #f87171;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .role-modal-field {
          margin-bottom: 20px;
        }
        .role-modal-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #c4c7d9;
          margin-bottom: 8px;
        }
        .role-modal-field input[type="text"],
        .role-modal-field textarea {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #e2e4f0;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .role-modal-field input:focus,
        .role-modal-field textarea:focus {
          border-color: rgba(167, 139, 250, 0.5);
        }
        .role-permissions-grid {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          overflow: hidden;
        }
        .role-permissions-header {
          display: grid;
          grid-template-columns: 120px repeat(5, 1fr);
          gap: 1px;
          background: rgba(255, 255, 255, 0.05);
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #555870;
          letter-spacing: 0.05em;
        }
        .role-perm-action {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .role-permissions-row {
          display: grid;
          grid-template-columns: 120px repeat(5, 1fr);
          gap: 1px;
          background: rgba(255, 255, 255, 0.02);
          padding: 8px 12px;
          align-items: center;
        }
        .role-permissions-row:nth-child(odd) {
          background: rgba(255, 255, 255, 0.03);
        }
        .role-perm-resource {
          font-size: 12px;
          font-weight: 500;
          color: #c4c7d9;
          text-transform: capitalize;
        }
        .role-perm-checkbox {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .role-perm-checkbox input {
          accent-color: #a78bfa;
          cursor: pointer;
          width: 16px;
          height: 16px;
        }
        .role-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .role-modal-btn-cancel {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #9094ae;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .role-modal-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #e2e4f0;
        }
        .role-modal-btn-save {
          padding: 10px 20px;
          background: rgba(167, 139, 250, 0.15);
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 8px;
          color: #a78bfa;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .role-modal-btn-save:hover:not(:disabled) {
          background: rgba(167, 139, 250, 0.25);
        }
        .role-modal-btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
