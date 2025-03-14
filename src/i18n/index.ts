import { moment } from 'obsidian';
import en from './en';
import fr from './fr';

// Define the structure of our translations
export interface Translations {
    [key: string]: string;
}

// Available translations
const translations: Record<string, Translations> = {
    en,
    fr
};

/**
 * Get the current locale from Obsidian
 */
export function getCurrentLocale(): string {
    // Get the locale from moment.js which is used by Obsidian
    const locale = moment.locale();
    
    // Check if we have a translation for this locale
    if (translations[locale]) {
        return locale;
    }
    
    // Fall back to English if the locale is not supported
    return 'en';
}

/**
 * Translate a key with optional variable replacements
 * @param key The translation key
 * @param variables Optional variables to replace in the translation
 */
export function t(key: string, variables?: Record<string, string>): string {
    const locale = getCurrentLocale();
    const translation = translations[locale] || translations.en;
    
    let text = translation[key] || translations.en[key] || key;
    
    // Replace variables if provided
    if (variables) {
        Object.entries(variables).forEach(([varName, value]) => {
            text = text.replace(new RegExp(`{{${varName}}}`, 'g'), value);
        });
    }
    
    return text;
}

/**
 * Add a new translation
 * @param locale The locale code
 * @param translationData The translation data
 */
export function addTranslation(locale: string, translationData: Translations): void {
    translations[locale] = translationData;
}

// Export all translations for reference
export { translations }; 