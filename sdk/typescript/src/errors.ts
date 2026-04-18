export class SignetSdkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SignetSdkError';
    }
}

export class CredentialNotFoundError extends SignetSdkError {
    constructor(public readonly providerId: string) {
        super(`No credential found for provider "${providerId}"`);
        this.name = 'CredentialNotFoundError';
    }
}

export class CredentialParseError extends SignetSdkError {
    constructor(
        public readonly filePath: string,
        cause?: Error,
    ) {
        super(`Failed to parse credential file: ${filePath}`);
        this.name = 'CredentialParseError';
        if (cause) this.cause = cause;
    }
}
