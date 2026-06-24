import { ContentProvider } from './content';
import { registerDisposableRegistry } from './utils';
import { commands, ExtensionContext } from 'vscode';
import { Controller } from './kernel';
import { ServerLogger } from './serverLogger';
import { DebuggerCommands } from './kernel/debugger/commands';
import { DebuggerFactory } from './kernel/debugger/debugFactory';
import { ShellKernel } from './kernel/shellKernel';
import { JavaScriptKernel } from './kernel/jsKernel';
import { Compiler } from './kernel/compiler';
import { Samples } from './content/walkThrough';
import { PrromptRepl } from './kernel/repl';

export async function activate(context: ExtensionContext) {
    registerDisposableRegistry(context);
    Samples.regsiter(context);
    Compiler.register(context);
    ContentProvider.register(context);
    Controller.regsiter();
    ServerLogger.register();
    DebuggerCommands.register(context);
    DebuggerFactory.regsiter(context);
    ShellKernel.register(context);
    JavaScriptKernel.register(context);
    PrromptRepl.register(context);
}
