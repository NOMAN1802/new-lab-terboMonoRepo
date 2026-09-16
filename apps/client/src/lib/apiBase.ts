/**
 * A leaf module: the patient entry needs this string and nothing else from the
 * API layer. Importing it from baseApi would pull Redux Toolkit Query and the
 * auth slice into a bundle that has no store at all.
 */
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV
        ? 'http://localhost:5000/api/v1'
        : 'https://api.newlabdiagnostic.com/api/v1');
