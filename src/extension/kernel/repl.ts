import { commands, ExtensionContext, ViewColumn } from 'vscode';
import { Controller } from '.';

export class PrromptRepl {
    public static register(context: ExtensionContext) {
        context.subscriptions.push(
            commands.registerCommand('prrompt.newREPL', async () => {
                await commands.executeCommand(
                    'interactive.open',
                    { viewColumn: ViewColumn.Active, preserveFocus: false },
                    undefined,
                    Controller.interactiveController.id,
                    'Prrompt REPL'
                );
                await commands.executeCommand('notebook.selectKernel', {
                    id: Controller.interactiveController.id,
                    extension: 'prrompt'
                });
            })
        );
    }
    constructor() {}
}
