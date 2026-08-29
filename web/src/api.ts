export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(path, {
        credentials: 'same-origin',
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
        ...options,
    });

    const body = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
        throw new ApiError(response.status, body.error ?? 'Something went wrong');
    }

    return body as T;
};
