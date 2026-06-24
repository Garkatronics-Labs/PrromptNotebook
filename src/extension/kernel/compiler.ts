import { ExtensionContext, NotebookCell, NotebookDocument, Uri, workspace } from 'vscode';
import { MappingItem, RawSourceMap } from 'source-map';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CodeObject } from '../server/types';

const mapOfSourceFilesToNotebookUri = new Map<string, Uri>();
const mapFromCellToPath = new WeakMap<NotebookCell, CodeObject>();
const codeObjectToSourceMaps = new WeakMap<
    CodeObject,
    {
        raw: RawSourceMap;
        originalToGenerated: Map<number, Map<number, MappingItem>>;
        generatedToOriginal: Map<number, Map<number, MappingItem>>;
        originalToGeneratedCache: Map<string, { line?: number; column?: number }>;
        generatedToOriginalCache: Map<string, { line?: number; column?: number }>;
    }
>();

let tmpDirectory: string | undefined;

export namespace Compiler {
    export function register(_context: ExtensionContext) {
        // Bun transpila nativamente — no necesita cargar typescript
    }

    export function getCellFromTemporaryPath(sourceFilename: string): NotebookCell | undefined {
        if (mapOfSourceFilesToNotebookUri.has(sourceFilename)) {
            return getNotebookCellfromUri(mapOfSourceFilesToNotebookUri.get(sourceFilename));
        }
        if (sourceFilename.toLowerCase().endsWith('.nnb') || sourceFilename.toLowerCase().endsWith('.ipynb')) {
            const key = Array.from(mapOfSourceFilesToNotebookUri.keys()).find((item) => sourceFilename.includes(item));
            return getNotebookCellfromUri(key ? mapOfSourceFilesToNotebookUri.get(key) : undefined);
        }
    }

    export function fixCellPathsInStackTrace(
        document: NotebookDocument,
        error?: Error | string,
        replaceWithRealCellUri = false
    ): string {
        let stackTrace = (typeof error === 'string' ? error : error?.stack) || '';
        let lineFound = false;
        if (stackTrace.includes('at Script.runInContext (vm.js')) {
            stackTrace = stackTrace.substring(0, stackTrace.indexOf('at Script.runInContext (vm.js')).trimEnd();
        }
        if (
            stackTrace.includes('extension/server/codeExecution.ts') ||
            stackTrace.includes('extension/server/codeExecution.js')
        ) {
            stackTrace = stackTrace.split(/\r?\n/).reduce((newStack, line, i) => {
                const separator = i > 0 ? '\n' : '';
                if (!lineFound) {
                    lineFound =
                        line.includes('extension/server/codeExecution.ts') ||
                        line.includes('extension/server/codeExecution.js');
                    if (!lineFound) {
                        newStack += `${separator}${line}`;
                    }
                }
                return newStack;
            }, '');
        }
        if (!stackTrace.includes('vscode-notebook-') || !stackTrace.includes('notebook_cell_')) {
            return stackTrace;
        }
        document.getCells().forEach((cell) => {
            const tempPath = mapFromCellToPath.get(cell);
            if (!tempPath) return;
            if (stackTrace.includes(tempPath.sourceFilename)) {
                const codeObject = Compiler.getCodeObject(cell);
                if (!codeObject) return;
                const sourceMap = Compiler.getSourceMapsInfo(codeObject);
                if (!sourceMap) return;
                const regex = new RegExp(tempPath.sourceFilename, 'g');
                const lines = stackTrace.split(tempPath.sourceFilename);
                lines
                    .filter((line) => line.startsWith(':'))
                    .forEach((stack) => {
                        const parts = stack.split(':').slice(1);
                        const line = parseInt(parts[0]);
                        const column = parseInt(parts[1]);
                        if (!isNaN(line) && !isNaN(column)) {
                            const mappedLocation = Compiler.getMappedLocation(
                                codeObject,
                                { line, column },
                                'DAPToVSCode'
                            );
                            if (typeof mappedLocation.line === 'number' && typeof mappedLocation.column === 'number') {
                                const textToReplace = `${tempPath.sourceFilename}:${line}:${column}`;
                                const textToReplaceWith = replaceWithRealCellUri
                                    ? `${cell.document.uri.toString()}:${mappedLocation.line}:${mappedLocation.column}`
                                    : `<Cell ${cell.index + 1}> [${mappedLocation.line}, ${mappedLocation.column}]`;
                                stackTrace = stackTrace.replace(textToReplace, textToReplaceWith);
                            }
                        }
                    });
                stackTrace = stackTrace.replace(regex, `<Cell ${cell.index + 1}> `);
            }
        });
        return stackTrace;
    }

    export function getSourceMapsInfo(codeObject: CodeObject) {
        return codeObjectToSourceMaps.get(codeObject);
    }

    export function getMappedLocation(
        codeObject: CodeObject,
        location: { line?: number; column?: number },
        direction: 'VSCodeToDAP' | 'DAPToVSCode'
    ): { line?: number; column?: number } {
        if (typeof location.line !== 'number' && typeof location.column !== 'number') {
            return location;
        }
        const sourceMap = getSourceMapsInfo(codeObject);
        if (!sourceMap) return location;
        if (typeof location.line !== 'number') return location;

        const cacheKey = `${location.line || ''},${location.column || ''}`;
        const cache =
            direction === 'VSCodeToDAP' ? sourceMap.originalToGeneratedCache : sourceMap.generatedToOriginalCache;
        const cachedData = cache.get(cacheKey);
        if (cachedData) return cachedData;

        const mappedLocation = { ...location };
        const map =
            direction === 'DAPToVSCode'
                ? sourceMap.generatedToOriginal.get(location.line)
                : sourceMap.originalToGenerated.get(location.line);

        if (!map) return location;

        const matchingItem =
            typeof location.column === 'number'
                ? map.get(location.column) || map.get(location.column - 1) || map.get(location.column + 1)
                : map.get(0);

        if (matchingItem) {
            mappedLocation.line = direction === 'DAPToVSCode' ? matchingItem.originalLine : matchingItem.generatedLine;
            mappedLocation.column =
                direction === 'DAPToVSCode' ? matchingItem.originalColumn : matchingItem.generatedColumn;
        } else {
            const column = Array.from(map.keys()).sort()[0];
            const item = map.get(column)!;
            mappedLocation.line = direction === 'DAPToVSCode' ? item.originalLine : item.generatedLine;
            mappedLocation.column = direction === 'DAPToVSCode' ? item.originalColumn : item.generatedColumn;
        }

        cache.set(cacheKey, mappedLocation);
        return mappedLocation;
    }

    export function getCodeObject(cell: NotebookCell) {
        return mapFromCellToPath.get(cell);
    }

    export function getOrCreateCodeObject(cell: NotebookCell): CodeObject {
        if (!tmpDirectory) {
            tmpDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-notebook-'));
        }
        const existing = mapFromCellToPath.get(cell);
        if (existing && existing.textDocumentVersion === cell.document.version) {
            return existing;
        }

        const notebookFSPath = cell.notebook.isUntitled ? cell.notebook.uri.toString() : cell.notebook.uri.fsPath;
        const cwd = cell.notebook.isUntitled
            ? workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.tmpdir()
            : path.dirname(cell.notebook.uri.fsPath);

        const sourceFilename = path.join(tmpDirectory, `notebook_cell_${cell.document.uri.fragment}.ts`);
        const code = cell.document.getText();

        fs.writeFileSync(sourceFilename, code);

        mapOfSourceFilesToNotebookUri.set(sourceFilename, cell.document.uri);
        mapOfSourceFilesToNotebookUri.set(cell.document.uri.toString(), cell.document.uri);

        const codeObject: CodeObject = {
            code,
            sourceFilename,
            sourceTsFilename: sourceFilename,
            sourceMapFilename: `${sourceFilename}.map`,
            friendlyName: `${path.relative(cwd, notebookFSPath)}?cell=${cell.index + 1}`,
            textDocumentVersion: cell.document.version
        };

        mapFromCellToPath.set(cell, codeObject);
        return codeObject;
    }
}

function getNotebookCellfromUri(uri?: Uri) {
    if (!uri) return;
    const notebookUri = uri.fsPath.toLowerCase();
    const notebook = workspace.notebookDocuments.find((item) => item.uri.fsPath.toLowerCase() === notebookUri);
    return notebook?.getCells().find((cell) => cell.document.uri.toString() === uri.toString());
}
