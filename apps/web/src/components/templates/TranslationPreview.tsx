import { useState, useEffect } from 'react';
import { Globe, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getTranslations, applyTranslations } from '../../services/translationService.js';
import type { TranslationData } from '../../types/translation.js';

interface TranslationPreviewProps {
  templateId: string;
  templateName: string;
  templateContent: string;
  onClose: () => void;
}

// Supported languages configuration
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: 'English' },
  { code: 'es', name: 'Español', flag: 'Español' },
  { code: 'fr', name: 'Français', flag: 'Français' },
  { code: 'de', name: 'Deutsch', flag: 'Deutsch' },
  { code: 'it', name: 'Italiano', flag: 'Italiano' },
  { code: 'pt', name: 'Português', flag: 'Português' },
];

export default function TranslationPreview({ 
  templateId, 
  templateName, 
  templateContent,
  onClose
}: TranslationPreviewProps) {
  const [translations, setTranslations] = useState<TranslationData | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string>('en');
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  
  // Load translations from API on mount
  useEffect(() => {
    loadTranslations();
  }, [templateId]);

  // Update preview when translations or selected locale changes
  useEffect(() => {
    if (translations) {
      // This will trigger re-render with new translations
    }
  }, [translations, selectedLocale]);

  const loadTranslations = async () => {
    try {
      setLoading(true);
      setApiStatus('loading');
      
      console.log('Loading translations from API...');
      const data = await getTranslations(templateId);
      
      setTranslations(data);
      setApiStatus('success');
      setSelectedLocale('en'); // Default to English
      console.log('API successful, using remote translations');
    } catch (err) {
      console.log('API failed, using local translations');
      setApiStatus('failed');
      
      // Use local static translations
      const localTranslations: TranslationData = {
        en: {
          '{{title}}': '{{title}}',
          '{{author}}': '{{author}}',
          '{{content}}': '{{content}}',
          '{{date}}': '{{date}}',
          '{{tags}}': '{{tags}}'
        },
        es: {
          '{{title}}': 'Título del Blog',
          '{{author}}': 'Autor del Blog',
          '{{content}}': 'Contenido del Blog',
          '{{date}}': 'Fecha del Blog',
          '{{tags}}': 'Etiquetas del Blog'
        },
        fr: {
          '{{title}}': 'Titre du Blog',
          '{{author}}': 'Auteur du Blog',
          '{{content}}': 'Contenu du Blog',
          '{{date}}': 'Date du Blog',
          '{{tags}}': 'Étiquettes du Blog'
        },
        de: {
          '{{title}}': 'Blog-Titel',
          '{{author}}': 'Blog-Autor',
          '{{content}}': 'Blog-Inhalt',
          '{{date}}': 'Blog-Datum',
          '{{tags}}': 'Blog-Tags'
        },
        it: {
          '{{title}}': 'Titolo del Blog',
          '{{author}}': 'Autore del Blog',
          '{{content}}': 'Contenuto del Blog',
          '{{date}}': 'Data del Blog',
          '{{tags}}': 'Tag del Blog'
        },
        pt: {
          '{{title}}': 'Título do Blog',
          '{{author}}': 'Autor do Blog',
          '{{content}}': 'Conteúdo do Blog',
          '{{date}}': 'Data do Blog',
          '{{tags}}': 'Tags do Blog'
        }
      };
      
      setTranslations(localTranslations);
    } finally {
      setLoading(false);
    }
  };

  const handleLocaleChange = (locale: string) => {
    setSelectedLocale(locale);
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLocale);
  
  // Handle empty template content
  if (!templateContent || templateContent.trim() === '') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          <div className="text-center">
            <Globe className="text-blue-600 mx-auto mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Translation Preview</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                <strong>Template Content is Empty</strong>
              </p>
              <p className="text-sm text-yellow-700 mt-2">
                Add template content with placeholders like <code className="bg-yellow-100 px-1 py-1 rounded">{"{{title}}"}</code>, <code className="bg-yellow-100 px-1 py-1 rounded">{"{{content}}"}</code> to see translations.
              </p>
            </div>
            <div className="mt-6">
              <button
                onClick={onClose}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const translatedContent = translations ? applyTranslations(templateContent, selectedLocale, translations) : templateContent;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-blue-600" size={24} />
            <span className="ml-3 text-gray-600">Loading translations from API...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Globe className="text-blue-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">Translation Preview</h3>
            <span className="text-sm text-gray-500">({templateName})</span>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {/* API Status */}
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${
          apiStatus === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : apiStatus === 'failed'
            ? 'bg-orange-50 border border-orange-200'
            : 'bg-blue-50 border border-blue-200'
        }`}>
          {apiStatus === 'success' && (
            <>
              <CheckCircle className="text-green-600" size={20} />
              <div className="text-green-800">
                <div className="font-medium">API Connected Successfully</div>
                <div className="text-sm">Using remote translations from backend</div>
              </div>
            </>
          )}
          {apiStatus === 'failed' && (
            <>
              <AlertCircle className="text-orange-600" size={20} />
              <div className="text-orange-800">
                <div className="font-medium">Using Local Translations</div>
                <div className="text-sm">Unable to connect to backend API - showing static translations</div>
              </div>
            </>
          )}
          {apiStatus === 'loading' && (
            <>
              <Loader2 className="animate-spin text-blue-600" size={20} />
              <div className="text-blue-800">
                <div className="font-medium">Connecting to API...</div>
                <div className="text-sm">Loading translations from backend</div>
              </div>
            </>
          )}
        </div>

        {/* Language Selector */}
        <div className="p-4 bg-gray-50 rounded-lg mb-6">
          <h4 className="font-medium text-gray-900 mb-4">Select Preview Language</h4>
          <div className="max-w-md">
            <select
              value={selectedLocale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-lg bg-white"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} - {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Template Preview */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">
            Template Preview in {currentLanguage?.flag} ({currentLanguage?.name})
          </h4>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {translatedContent}
            </pre>
          </div>
          
          {/* Translation Status */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-2">Translation Status</h5>
            <div className="text-sm text-blue-800">
              <div className="mb-2">
                <strong>API Status:</strong> 
                {apiStatus === 'success' ? (
                  <span className="text-green-700"> Connected to backend</span>
                ) : (
                  <span className="text-orange-700"> Using local translations</span>
                )}
              </div>
              <div className="mb-2">
                <strong>Current Language:</strong> {currentLanguage?.flag} - {currentLanguage?.name}
              </div>
              <div>
                <strong>Translation Source:</strong> 
                {apiStatus === 'success' ? (
                  <span className="text-green-700"> Remote API</span>
                ) : (
                  <span className="text-orange-700"> Local Static</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
