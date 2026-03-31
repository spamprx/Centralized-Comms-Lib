import { useState } from 'react';
import TemplatesList from './TemplatesList';
import TemplateDetail from './TemplateDetail';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
}

const TemplatesPage = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [deletedTemplates, setDeletedTemplates] = useState<Template[]>(() => {
    const deleted = localStorage.getItem('deletedTemplates');
    return deleted ? JSON.parse(deleted) : [];
  });

  const updateTemplate = (updatedTemplate: Template) => {
    const templateWithCurrentTime = {
      ...updatedTemplate,
      updatedAt: new Date().toISOString(),
    };
    
    setTemplates(prev => {
      const updated = prev.map(t => 
        t.id === updatedTemplate.id ? templateWithCurrentTime : t
      );
      localStorage.setItem('templates', JSON.stringify(updated));
      return updated;
    });
  };

  const restoreTemplate = (template: Template) => {
    const restoredTemplate = {
      ...template,
      updatedAt: new Date().toISOString(),
    };
    
    setTemplates(prev => [...prev, restoredTemplate]);
    setDeletedTemplates(prev => {
      const updated = prev.filter(t => t.id !== template.id);
      localStorage.setItem('deletedTemplates', JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem('templates', JSON.stringify([...templates, restoredTemplate]));
  };

  if (selectedTemplateId) {
    return (
      <TemplateDetail
        templateId={selectedTemplateId}
        onBack={() => setSelectedTemplateId(null)}
        templates={templates}
        onUpdateTemplate={updateTemplate}
      />
    );
  }

  return <TemplatesList 
    templates={templates}
    setTemplates={setTemplates}
    deletedTemplates={deletedTemplates}
    onViewTemplate={setSelectedTemplateId}
    onEditTemplate={setSelectedTemplateId}
    onDeleteTemplate={(id) => {
      if (confirm('Are you sure you want to delete this template?')) {
        const templateToDelete = templates.find(t => t.id === id);
        if (templateToDelete) {
          const deletedTemplate = {
            ...templateToDelete,
            updatedAt: new Date().toISOString(),
          };
          
          setTemplates(prev => prev.filter(t => t.id !== id));
          setDeletedTemplates(prev => [...prev, deletedTemplate]);
          localStorage.setItem('deletedTemplates', JSON.stringify([...deletedTemplates, deletedTemplate]));
        }
        localStorage.setItem('templates', JSON.stringify(templates.filter(t => t.id !== id)));
      }
    }}
    onRestoreTemplate={restoreTemplate}
  />;
};

export { TemplatesList, TemplateDetail, TemplatesPage };
