/**
 * Sanitize an identifier for use as a filesystem-safe filename.
 * Replaces unsafe characters with underscores.
 */
export function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}
