/**
 * Standard CLI exit codes for signet commands.
 */
export const ExitCode = {
    SUCCESS: 0,
    GENERAL_ERROR: 1,
    PROVIDER_NOT_FOUND: 2,
    CREDENTIAL_NOT_FOUND: 3,
    REMOTE_NOT_FOUND: 4,
} as const;
