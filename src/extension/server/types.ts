/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

type BaseMessage<T extends string, B = {}> = {
    type: T;
    requestId: string;
} & B;

export type CodeObject = {
    code: string;
    textDocumentVersion: number;
    sourceFilename: string;
    sourceTsFilename: string;
    friendlyName: string;
    sourceMapFilename: string;
};

export type RequestType = RunCellRequest | PingRequest | InitializeRequest | ReadLineQuestionResponse;

export type RunCellRequest = BaseMessage<'cellExec', { code: CodeObject }>;
export type PingRequest = BaseMessage<'ping'>;
export type InitializeRequest = BaseMessage<'initialize'>;
export type ReadLineQuestionResponse = BaseMessage<
    'readlineResponse',
    {
        answer?: string;
        requestId: string;
    }
>;

export type ResponseType =
    | RunCellResponse
    | PingResponse
    | LogMessage
    | ReplRestarted
    | Initialized
    | OutputResponse
    | ReadLineQuestionRequest;

export type LogMessage = BaseMessage<
    'logMessage',
    {
        message: string;
        category: 'info' | 'error';
    }
>;

export type RunCellResponse = BaseMessage<
    'cellExec',
    | { result?: DisplayData; success: true; start: number; end: number }
    | { ex: Error | { name?: string; message?: string; stack?: string }; success: false; start: number; end: number }
>;

export type OutputResponse = BaseMessage<
    'output',
    {
        data?: DisplayData;
        ex?: Error | { name?: string; message?: string; stack?: string };
    }
>;

export type PingResponse = BaseMessage<'pong'>;
export type ReplRestarted = BaseMessage<'replRestarted'>;
export type Initialized = BaseMessage<'initialized'>;

export type ReadLineQuestionRequest = BaseMessage<
    'readlineRequest',
    {
        question: string;
        requestId: string;
    }
>;

export type DisplayData =
    | BaseMessage<'text', { value: string }>
    | BaseMessage<'html', { value: string }>
    | BaseMessage<'json', { value: unknown }>
    | BaseMessage<'markdown', { value: string }>
    | BaseMessage<'multi-mime', { value: DisplayData[] }>;
