import { DiagnosticSeverity, Parser, type Diagnostic } from '@asyncapi/parser';

export type AsyncApiValidationIssue = {
    message: string;
    path?: string;
    code?: string | number;
    severity: 'error' | 'warning' | 'info' | 'hint' | 'unknown';
    line?: number;
    character?: number;
};

export type AsyncApiValidationResult = {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    errors: AsyncApiValidationIssue[];
    warnings: AsyncApiValidationIssue[];
};

const parser = new Parser();

const severityLabel = (severity: Diagnostic['severity']): AsyncApiValidationIssue['severity'] => {
    switch (severity) {
        case DiagnosticSeverity.Error:
            return 'error';
        case DiagnosticSeverity.Warning:
            return 'warning';
        case DiagnosticSeverity.Information:
            return 'info';
        case DiagnosticSeverity.Hint:
            return 'hint';
        default:
            return 'unknown';
    }
};

const pathToString = (path: Diagnostic['path']): string | undefined => {
    if (!Array.isArray(path) || path.length === 0) {
        return undefined;
    }

    return path.map(segment => String(segment)).join('.');
};

const diagnosticToIssue = (diagnostic: Diagnostic): AsyncApiValidationIssue => {
    const start = diagnostic.range?.start;

    return {
        message: diagnostic.message,
        path: pathToString(diagnostic.path),
        code: diagnostic.code,
        severity: severityLabel(diagnostic.severity),
        line: typeof start?.line === 'number' ? start.line + 1 : undefined,
        character: typeof start?.character === 'number' ? start.character + 1 : undefined,
    };
};

export const validateAsyncApiSpec = async (spec: string): Promise<AsyncApiValidationResult> => {
    const diagnostics = await parser.validate(spec);
    const issues = diagnostics.map(diagnosticToIssue);
    const errors = issues.filter(issue => issue.severity === 'error');
    const warnings = issues.filter(issue => issue.severity === 'warning' || issue.severity === 'info' || issue.severity === 'hint');

    return {
        valid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length,
        errors,
        warnings,
    };
};
