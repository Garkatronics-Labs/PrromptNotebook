import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { sendMessage } from './comms';
import { logErrorMessage } from './logger';
import { RunCellRequest, RunCellResponse } from './types';
import { createConsoleOutputCompletedMarker } from '../const';

// Historia de resultados entre celdas
const cellHistory: unknown[] = [];

export function initialize() {
    // Bun no necesita setup — no-op
}

export async function execCode(request: RunCellRequest): Promise<void> {
    const start = Date.now();

    const prevData = cellHistory.length > 0 ? JSON.stringify(cellHistory[cellHistory.length - 1]) : 'undefined';

    const injectedCode = `
    const context = {
        prev: <T = unknown>(): T => JSON.parse('${prevData.replace(/'/g, "\\'")}') as T,
    };

    ${request.code.code}
    `;

    const tmpFile = path.join(os.tmpdir(), `prrompt_${request.requestId}.ts`);
    fs.writeFileSync(tmpFile, injectedCode);

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        const proc = spawn('bun', ['run', tmpFile], {
            env: process.env,
            cwd: process.cwd()
        });

        proc.stdout.on('data', (d: Buffer) => {
            const text = d.toString();
            stdout += text;
            process.stdout.write(text);
        });

        proc.stderr.on('data', (d: Buffer) => {
            const text = d.toString();
            stderr += text;
            process.stderr.write(text);
        });

        proc.on('close', (code) => {
            try {
                fs.unlinkSync(tmpFile);
            } catch {
                /* ignorar */
            }

            console.log(createConsoleOutputCompletedMarker(request.requestId));

            if (code === 0) {
                // Último valor de stdout como resultado de celda
                const lastLine = stdout.trim().split('\n').pop() ?? '';
                let result: unknown = lastLine;
                try {
                    result = JSON.parse(lastLine);
                } catch {
                    /* no era JSON */
                }

                cellHistory.push(result);

                const response: RunCellResponse = {
                    type: 'cellExec',
                    requestId: request.requestId,
                    success: true,
                    result: { type: 'text', value: stdout, requestId: request.requestId },
                    start,
                    end: Date.now()
                };
                sendMessage(response);
            } else {
                logErrorMessage(`Bun exited with code ${code}: ${stderr}`);
                const response: RunCellResponse = {
                    type: 'cellExec',
                    requestId: request.requestId,
                    success: false,
                    ex: { name: 'ExecutionError', message: stderr, stack: '' },
                    start,
                    end: Date.now()
                };
                sendMessage(response);
            }

            resolve();
        });

        proc.on('error', (err) => {
            logErrorMessage('Failed to spawn bun', err);
            const response: RunCellResponse = {
                type: 'cellExec',
                requestId: request.requestId,
                success: false,
                ex: { name: err.name, message: err.message, stack: err.stack },
                start,
                end: Date.now()
            };
            sendMessage(response);
            resolve();
        });
    });
}
