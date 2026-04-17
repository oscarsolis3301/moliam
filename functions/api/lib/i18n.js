/**
 * Error Message Localization System (i18n)
 * 
 * Provides internationalization support for API error messages.
 * Supports multiple languages with English as default.
 * 
 * Usage:
 * - Import getErrorMessage(code, locale) from this file
 * - Use error codes instead of hardcoded messages in API responses
 * - Accept-Language header or ?lang= query parameter determines language
 */

// Supported locales (RFC 3066 format)
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'pt'];

// Default language if locale not supported
const DEFAULT_LOCALE = 'en';

/**
 * Error message translations by locale
 * Each error code maps to messages in each supported language
 */
const ERROR_MESSAGES = {
  // General errors
  'BAD_REQUEST': {
    en: 'Bad request. Please check your input.',
    es: 'Solicitud inválida. Por favor verifique sus datos.',
    fr: 'Mauvaise demande. Veuillez vérifier vos entrées.',
    de: 'Ungültige Anfrage. Bitte überprüfen Sie Ihre Eingabe.',
    pt: 'Requisita inválida. Por favor verifique seus dados.'
  },
  'INVALID_JSON': {
    en: 'Invalid JSON in request body.',
    es: 'JSON inválido en el cuerpo de la solicitud.',
    fr: 'JSON invalide dans le corps de la demande.',
    de: 'Ungültiges JSON im Anfragekörper.',
    pt: 'JSON inválido no corpo da requisição.'
  },
  'DATABASE_ERROR': {
    en: 'Database operation failed. Please try again later.',
    es: 'Operación de base de datos fallida. Por favor intente más tarde.',
    fr: 'Échec de l\'opération de base de données. Veuillez réessayer plus tard.',
    de: 'Datenbankbetrieb fehlgeschlagen. Bitte versuchen Sie es später erneut.',
    pt: 'Falha na operação do banco de dados. Por favor tente novamente mais tarde.'
  },
  'DATABASE_UNAVAILABLE': {
    en: 'Database unavailable. Please try again later.',
    es: 'Base de datos no disponible. Por favor intente más tarde.',
    fr: 'Base de données indisponible. Veuillez réessayer plus tard.',
    de: 'Datenbank nicht verfügbar. Bitte versuchen Sie es später erneut.',
    pt: 'Banco de dados indisponível. Por favor tente novamente mais tarde.'
  },
  'QUERY_FAILED': {
    en: 'Database query failed. Please try again later.',
    es: 'Consulta de base de datos fallida. Por favor intente más tarde.',
    fr: 'Échec de la requête de base de données. Veuillez réessayer plus tard.',
    de: 'Datenbankabfrage fehlgeschlagen. Bitte versuchen Sie es später erneut.',
    pt: 'Consulta do banco de dados falhou. Por favor tente novamente mais tarde.'
  },
  
  // Authentication/Authorization errors
  'UNAUTHORIZED': {
    en: 'Unauthorized access. Please log in or provide valid credentials.',
    es: 'Acceso no autorizado. Por favor inicie sesión o proporcione credenciales válidas.',
    fr: 'Accès non autorisé. Veuillez vous connecter ou fournir des identifiants valides.',
    de: 'Unbefugter Zugriff. Bitte melden Sie sich an oder geben gültige Anmeldedaten an.',
    pt: 'Acesso não autorizado. Por favor faça login ou forneça credenciais válidas.'
  },
  'INVALID_CREDENTIALS': {
    en: 'Invalid credentials. Please check your username and password.',
    es: 'Credenciales inválidas. Por favor verifique su nombre de usuario y contraseña.',
    fr: 'Identifiants invalides. Veuillez vérifier votre nom d\'utilisateur et votre mot de passe.',
    de: 'Ungültige Anmeldeinformationen. Bitte überprüfen Sie Benutzername und Passwort.',
    pt: 'Credenciais inválidas. Por favor verifique seu nome de usuário e senha.'
  },
  'SESSION_EXPIRED': {
    en: 'Session expired. Please log in again.',
    es: 'Sesión expirada. Por favor inicie sesión nuevamente.',
    fr: 'Session expirée. Veuillez vous reconnecter.',
    de: 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.',
    pt: 'Sessão expirada. Por favor faça login novamente.'
  },
  'AUTH_REQUIRED': {
    en: 'Authentication required. Please provide valid credentials.',
    es: 'Autenticación requerida. Por favor proporcione credenciales válidas.',
    fr: 'Authentification requise. Veuillez fournir des identifiants valides.',
    de: 'Authentifizierung erforderlich. Bitte gültige Anmeldeinformationen angeben.',
    pt: 'Autenticação necessária. Por favor forneça credenciais válidas.'
  },
  
  // Rate limiting errors
  'RATE_LIMIT_EXCEEDED': {
    en: 'Too many requests. Please wait before trying again.',
    es: 'Demasiadas solicitudes. Por favor espere antes de intentar nuevamente.',
    fr: 'Trop de demandes. Veuillez attendre avant de réessayer.',
    de: 'Zu viele Anfragen. Bitte warten Sie, bevor Sie es erneut versuchen.',
    pt: 'Muitas solicitações. Por favor espere antes de tentar novamente.'
  },
  'RETRY_AFTER': {
    en: 'Rate limit exceeded. Retry after {{seconds}} seconds.',
    es: 'Límite de tasa excedido. Reintente después de {{seconds}} segundos.',
    fr: 'Limite de vitesse dépassée. Réessayez après {{seconds}} secondes.',
    de: 'Begrenzungsrate überschritten. Bitte erneut versuchen nach {{seconds}} Sekunden.',
    pt: 'Limite de taxa excedido. Tente novamente após {{seconds}} segundos.'
  },
  
  // Validation errors
  'INVALID_INPUT': {
    en: 'Invalid input. Please check your data and try again.',
    es: 'Entrada inválida. Por favor verifique sus datos e intente nuevamente.',
    fr: 'Données invalides. Veuillez vérifier vos entrées et réessayer.',
    de: 'Ungültige Eingabe. Bitte überprüfen Sie Ihre Daten und versuchen Sie es erneut.',
    pt: 'Entrada inválida. Por favor verifique seus dados e tente novamente.'
  },
  'FIELD_REQUIRED': {
    en: '{{field}} is required.',
    es: '{{field}} es requerido.',
    fr: '{{field}} est requis.',
    de: '{{field}} ist erforderlich.',
    pt: '{{field}} é obrigatório.'
  },
  'EMAIL_INVALID': {
    en: 'Invalid email address format.',
    es: 'Formato de correo electrónico inválido.',
    fr: 'Format d\'adresse e-mail invalide.',
    de: 'Ungültiges E-Mail-Adressformat.',
    pt: 'Formato de endereço de email inválido.'
  },
  'NAME_TOO_LONG': {
    en: 'Name cannot exceed 254 characters.',
    es: 'El nombre no puede exceder 254 caracteres.',
    fr: 'Le nom ne peut pas dépasser 254 caractères.',
    de: 'Name darf nicht mehr als 254 Zeichen enthalten.',
    pt: 'Nome não pode exceder 254 caracteres.'
  },
  'CALENDAR_LINK_TOO_LONG': {
    en: 'Calendar link cannot exceed 254 characters.',
    es: 'El enlace de calendario no puede exceder 254 caracteres.',
    fr: 'Le lien du calendrier ne peut pas dépasser 254 caractères.',
    de: 'Kalenderlink darf nicht mehr als 254 Zeichen enthalten.',
    pt: 'Link do calendário não pode exceder 254 caracteres.'
  },
  
  // Resource errors
  'NOT_FOUND': {
    en: 'Resource not found.',
    es: 'Recurso no encontrado.',
    fr: 'Ressource non trouvée.',
    de: 'Ressource nicht gefunden.',
    pt: 'Recurso não encontrado.'
  },
  'RESOURCE_ALREADY_EXISTS': {
    en: 'Resource already exists. Please use a different value.',
    es: 'El recurso ya existe. Por favor use un valor diferente.',
    fr: 'La ressource existe déjà. Veuillez utiliser une valeur différente.',
    de: 'Ressource existiert bereits. Bitte verwenden Sie einen anderen Wert.',
    pt: 'Recurso já existe. Por favor use um valor diferente.'
  },
  
  // Booking errors
  'APPOINTMENT_NOT_FOUND': {
    en: 'Appointment not found or invalid appointment ID.',
    es: 'Cita no encontrada o ID de cita inválido.',
    fr: 'Rendez-vous non trouvé ou identifiant de rendez-vous invalide.',
    de: 'Termin nicht gefunden oder ungültige Termin-ID.',
    pt: 'Agendamento não encontrado ou ID de agendamento inválido.'
  },
  'BOOKING_FAILED': {
    en: 'Booking failed. Please check your details and try again.',
    es: 'Falló la reserva. Por favor verifique sus datos e intente nuevamente.',
    fr: 'Échec de la réservation. Veuillez vérifier vos détails et réessayer.',
    de: 'Buchung fehlgeschlagen. Bitte überprüfen Sie Ihre Details und versuchen Sie es erneut.',
    pt: 'Reserva falhou. Por favor verifique seus dados e tente novamente.'
  },
  'SCHEDULED_DATE_REQUIRED': {
    en: 'Scheduled date required for {{action}}.',
    es: 'Fecha programada requerida para {{action}}.',
    fr: 'Date planifiée requise pour {{action}}.',
    de: 'Geplanter Termin erforderlich für {{action}}.',
    pt: 'Data agendada necessária para {{action}}.'
  },
  'RESCHEDULE_DATE_REQUIRED': {
    en: 'New scheduled date required for rescheduling.',
    es: 'Nueva fecha programada requerida para reprogramar.',
    fr: 'Nouvelle date planifiée requise pour le report.',
    de: 'Neuer geplanter Termin erforderlich zur Umplanung.',
    pt: 'Nova data agendada necessária para reagendamento.'
  },
  
  // System errors
  'INTERNAL_ERROR': {
    en: 'Internal server error. Please contact support if this persists.',
    es: 'Error interno del servidor. Por favor contacte soporte si esto persiste.',
    fr: 'Erreur interne de serveur. Veuillez contacter le support si cela persiste.',
    de: 'Interner Serverfehler. Bitte kontaktieren Sie den Support, wenn dies andauert.',
    pt: 'Erro interno do servidor. Por favor contate o suporte se isso persistir.'
  },
  'UNEXPECTED_ERROR': {
    en: 'An unexpected error occurred. Please try again later.',
    es: 'Ocurrió un error inesperado. Por favor intente más tarde.',
    fr: 'Une erreur inattendue s\'est produite. Veuillez réessayer plus tard.',
    de: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
    pt: 'Ocorreu um erro inesperado. Por favor tente novamente mais tarde.'
  },
  
  // Success messages (for success responses)
  'SUCCESS': {
    en: 'Operation successful.',
    es: 'Operación exitosa.',
    fr: 'Opération réussie.',
    de: 'Vorgang erfolgreich.',
    pt: 'Operação bem-sucedida.'
  },
  
  // Email and notification errors
  'EMAIL_SEND_FAILED': {
    en: 'Failed to send email notification. Please try again later.',
    es: 'Falló al enviar notificación por correo electrónico. Por favor intente más tarde.',
    fr: 'Échec de l\'envoi du courriel de notification. Veuillez réessayer plus tard.',
    de: 'Fehler beimSenden der E-Mail-Benachrichtigung. Bitte versuchen Sie es später erneut.',
    pt: 'Falha ao enviar notificação por email. Por favor tente novamente mais tarde.'
  },
  
  // Rate limit specific
  'RATE_LIMITED': {
    en: 'You are sending too many requests. Please slow down.',
    es: 'Está enviando demasiadas solicitudes. Por favor reduzca el ritmo.',
    fr: 'Vous envoyez trop de demandes. Veuillez ralentir.',
    de: 'Sie senden zu viele Anfragen. Bitte langsamer werden.',
    pt: 'Você está enviando muitas solicitações. Por favor diminua o ritmo.'
  },
  
  // Dashboard errors
  'DASHBOARD_ACCESS_DENIED': {
    en: 'You do not have permission to access this dashboard.',
    es: 'No tiene permiso para acceder a este panel de control.',
    fr: 'Vous n\'avez pas la permission d\'accéder à ce tableau de bord.',
    de: 'Sie haben keine Berechtigung, auf dieses Dashboard zuzugreifen.',
    pt: 'Você não tem permissão para acessar este painel.'
  },
  
  // Booking helper errors
  'UNKNOWN_ACTION': {
    en: 'Unknown action. Please use a valid action type.',
    es: 'Acción desconocida. Por favor use un tipo de acción válido.',
    fr: 'Action inconnue. Veuillez utiliser un type d\'action valide.',
    de: 'Unbekannte Aktion. Bitte verwenden Sie einen gültigen Aktionstyp.',
    pt: 'Ação desconhecida. Por favor use um tipo de ação válido.'
  },
  
  // Webhook errors
  'WEBHOOK_SEND_FAILED': {
    en: 'Failed to send webhook notification.',
    es: 'Falló al enviar notificación por webhook.',
    fr: 'Échec de l\'envoi de la notification webhook.',
    de: 'Senten der Webhook-Benachrichtigung fehlgeschlagen.',
    pt: 'Falha ao enviar notificação por webhook.'
  },
  
  // Contact errors
  'CONTACT_FAILED': {
    en: 'Failed to process your contact request. Please try again later.',
    es: 'Falló al procesar su solicitud de contacto. Por favor intente más tarde.',
    fr: 'Échec du traitement de votre demande de contact. Veuillez réessayer plus tard.',
    de: 'Verarbeitung Ihrer Kontaktanfrage fehlgeschlagen. Bitte versuchen Sie es später erneut.',
    pt: 'Falha ao processar sua solicitação de contato. Por favor tente novamente mais tarde.'
  },
  
  // Validation field errors
  'CALENDAR_LINK_REQUIRED': {
    en: 'Calendar link required for booking.',
    es: 'Enlace de calendario requerido para reserva.',
    fr: 'Lien du calendrier requis pour la réservation.',
    de: 'Kalenderlink erforderlich zur Buchung.',
    pt: 'Link do calendário necessário para agendamento.'
  }
};

/**
 * Get the current locale from request
 * Checks Accept-Language header and ?lang= query parameter
 * @param {Request} request - Cloudflare Pages Function Request object
 * @returns {string} Locale code (en, es, fr, de, pt) or 'en' if not specified/supported
 */
export function getCurrentLocale(request) {
  const url = new URL(request.url);
  
  // Check query parameter first (?lang=es)
  const langParam = url.searchParams.get('lang');
  if (langParam && SUPPORTED_LOCALES.includes(langParam)) {
    return langParam;
  }
  
  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
  const acceptLanguage = request.headers.get('Accept-Language');
  if (acceptLanguage) {
    const locales = acceptLanguage.split(',').map(locale => {
      return locale.split('-')[0].toLowerCase(); // Extract primary language tag
    });
    
    for (const locale of locales) {
      if (SUPPORTED_LOCALES.includes(locale)) {
        return locale;
      }
    }
  }
  
  return DEFAULT_LOCALE;
}

/**
 * Get localized error message
 * @param {string} code - Error code identifier
 * @param {string} locale - Locale code (optional, uses getCurrentLocale() if not provided)
 * @param {Object} params - Optional parameters to interpolate into message (e.g., {{field}})
 * @returns {string} Localized error message
 */
export function getErrorMessage(code, locale = DEFAULT_LOCALE, params = {}) {
  const messages = ERROR_MESSAGES[code];
  
  if (!messages) {
    console.warn(`Missing error translation for code: "${code}"`);
    return `[Error ${code}] - Please check API documentation.`;
  }
  
  // If locale not in supported list, fall back to English
  const effectiveLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  let message = messages[effectiveLocale];
  if (!message) {
    console.warn(`No translation available for ${code} in ${effectiveLocale}. Defaulting to English.`);
    message = messages.en;
  }
  
  // Interpolate parameters: {{variable}} pattern
  Object.keys(params).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = params[key].toString();
    message = message.split(placeholder).join(value);
  });
  
  return message;
}

/**
 * Create localized error response (convenience wrapper)
 * @param {number} status - HTTP status code
 * @param {string} errorCode - Error code identifier
 * @param {Request} request - Request object for locale detection
 * @param {Object} params - Optional parameters to interpolate
 * @returns {Response} JSON error response with localized message
 */
export function createErrorResponse(status, errorCode, request, params = {}) {
  const locale = getCurrentLocale(request);
  
  return new Response(JSON.stringify({
    success: false,
    error: true,
    code: errorCode,
    message: getErrorMessage(errorCode, locale, params)
  }), {
    status: status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * List all available locales (for introspection/debugging)
 * @returns {string[]} Array of supported locale codes
 */
export function getSupportedLocales() {
  return [...SUPPORTED_LOCALES];
}

/**
 * Check if a specific error code has translations
 * @param {string} errorCode - Error code to check
 * @returns {boolean} True if translations exist for this error code
 */
export function hasErrorTranslation(errorCode) {
  return ERROR_MESSAGES[errorCode] !== undefined;
}

/**
 * Add or update error translation (for debugging/development)
 * Note: This is NOT persisted to storage. Use config management system for production updates.
 * @param {string} errorCode - Error code identifier
 * @param {Object} translations - Object with locale:message pairs
 */
export function addErrorTranslation(errorCode, translations) {
  ERROR_MESSAGES[errorCode] = translations;
  console.log(`Updated error translation for: ${errorCode}`);
}

// Export all functions for use in other modules
export default {
  getErrorMessage,
  getCurrentLocale,
  createErrorResponse,
  getSupportedLocales,
  hasErrorTranslation,
  addErrorTranslation,
  ERROR_MESSAGES,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE
};
