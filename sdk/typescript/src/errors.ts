export class SigSdkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SigSdkError';
    }
}

export class CredentialNotFoundError extends SigSdkError {
    constructor(public readonly providerId: string) {
        super(`No credential found for provider "${providerId}"`);
        this.name = 'CredentialNotFoundError';
    }
}

export class CredentialParseError extends SigSdkError {
    constructor(
        public readonly filePath: string,
        cause?: Error,
    ) {
        super(`Failed to parse credential file: ${filePath}`);
        this.name = 'CredentialParseError';
        if (cause) this.cause = cause;
    }
}
