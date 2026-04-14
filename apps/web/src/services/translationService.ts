import type { TranslationData } from '../types/translation.js';

const API_BASE = "http://168.144.22.124:8000";

// API request helper
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

// Get translations for a template
export async function getTranslations(templateId: string): Promise<TranslationData> {
  console.log('Loading translations from API for template:', templateId);
  
  try {
    // Try API first with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('API request timeout after 5 seconds')), 5000);
    });
    
    const apiData = await Promise.race([
      request<TranslationData>(`api/v1/templates/${templateId}/i18n`),
      timeoutPromise
    ]);
    
    console.log('API successful, using remote translations');
    return apiData;
  } catch (error) {
    console.log('API failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error; // Let the component handle the fallback
  }
}

// Apply translations to template content using placeholder keys
export function applyTranslations(
  content: string, 
  locale: string,
  translations: TranslationData
): string {
  // Early return for empty content to prevent getting stuck
  if (!content || content.trim() === '') {
    console.log('Template content is empty, returning as-is');
    return content;
  }
  
  let translatedContent = content;
  const localeTranslations = translations[locale] || {};
  
  // Debug: Log what we're working with
  console.log('Applying translations for locale:', locale);
  console.log('Available translations:', localeTranslations);
  
  // Apply translations by replacing placeholder keys only if they exist in template
  Object.entries(localeTranslations).forEach(([placeholderKey, translation]) => {
    if (translation && content.includes(placeholderKey)) {
      console.log(`Replacing "${placeholderKey}" with "${translation}"`);
      // Replace all instances of the placeholder with the translation
      translatedContent = translatedContent.replaceAll(placeholderKey, translation as string);
    } else if (!translation) {
      console.log(`No translation available for "${placeholderKey}" in locale "${locale}"`);
    }
  });
  
  console.log('Final translated content:', translatedContent);
  return translatedContent;
}
