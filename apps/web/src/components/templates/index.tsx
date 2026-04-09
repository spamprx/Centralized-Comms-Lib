import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import TemplatesList from './TemplatesList';
import TemplateDetail from './TemplateDetail';
import { templateService, type Template } from '../../services';


const TemplatesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [cloneInfo, setCloneInfo] = useState<{ originalName: string } | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deletedTemplates, setDeletedTemplates] = useState<Template[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Handle URL parameters and navigation state
  useEffect(() => {
    const templateId = params.templateId;
    const isEditRoute = location.pathname.includes('/edit');
    const stateCloneInfo = location.state?.cloneInfo;

    if (templateId) {
      setSelectedTemplateId(templateId);
      setEditMode(isEditRoute);
      setCloneInfo(stateCloneInfo || null);
    } else {
      setSelectedTemplateId(null);
      setEditMode(false);
      setCloneInfo(null);
    }
  }, [params.templateId, location.pathname, location.state]);

  // Load templates from API or localStorage on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const loadedTemplates = await templateService.list();
        setTemplates(loadedTemplates);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };
    
    loadTemplates();
  }, []);

  const updateTemplate = async (updatedTemplate: Template) => {
    try {
      const saved = await templateService.update(updatedTemplate.id, updatedTemplate);
      if (saved) {
        // API succeeded, use the returned template
        setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? saved : t));
      } else {
        // API returned null, use the local updated template
        setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
      }
    } catch (error) {
      console.error('Failed to update template:', error);
      // Even on error, update local state with the changes
      setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
    }
  };

  const handleClone = async (templateId: string) => {
    try {
      const originalTemplate = templates.find(t => t.id === templateId);
      if (!originalTemplate) return;
      
      const clonedTemplate = await templateService.clone(templateId);
      if (clonedTemplate) {
        // Add to templates list
        setTemplates(prev => [...prev, clonedTemplate]);
        
        // Navigate to edit page with clone info
        navigate(`/templates/${clonedTemplate.id}/edit`, {
          state: { cloneInfo: { originalName: originalTemplate.name } }
        });
      }
    } catch (error) {
      console.error('Failed to clone template:', error);
    }
  };

  const restoreTemplate = async (template: Template) => {
    try {
      // Create template again (restore)
      const restoredTemplate = await templateService.create({
        name: template.name,
        description: template.description,
        content: template.content,
        status: template.status,
      });
      
      // Add to templates list
      setTemplates(prev => [...prev, restoredTemplate]);
      
      // Remove from deleted templates
      setDeletedTemplates(prev => prev.filter(t => t.id !== template.id));
      
    } catch (error) {
      console.error('Failed to restore template:', error);
      alert('Failed to restore template');
    }
  };

  if (selectedTemplateId) {
    return (
      <TemplateDetail
        templateId={selectedTemplateId}
        onBack={() => navigate('/templates')}
        templates={templates}
        onUpdateTemplate={updateTemplate}
        onCloneTemplate={handleClone}
        editMode={editMode}
        cloneInfo={cloneInfo}
      />
    );
  }

  return <TemplatesList 
    templates={templates}
    setTemplates={setTemplates}
    deletedTemplates={deletedTemplates}
    onViewTemplate={(id) => navigate(`/templates/${id}`)}
    onEditTemplate={(id) => navigate(`/templates/${id}/edit`)}
    onCloneTemplate={handleClone}
    onDeleteTemplate={async (id) => {
      if (confirm('Are you sure you want to delete this template?')) {
        try {
          setDeletingId(id);
          const success = await templateService.delete(id);
          if (success) {
            // Remove from templates list
            setTemplates(prev => prev.filter(t => t.id !== id));
          } else {
            alert('Failed to delete template');
          }
        } catch (error) {
          console.error('Failed to delete template:', error);
          alert('Failed to delete template');
        } finally {
          setDeletingId(null);
        }
      }
    }}
    deletingId={deletingId}
    onRestoreTemplate={restoreTemplate}
  />;
};

export { TemplatesList, TemplateDetail, TemplatesPage };
export { default as AddChannelModal } from './AddChannelModal';
export { default as ChannelBindings } from './ChannelBindings';
