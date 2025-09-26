import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    // Start LSP client
    const serverJar = context.asAbsolutePath('server/wml.jar');
    const serverOptions: ServerOptions = {
        run: { command: 'java', args: ['-jar', serverJar, '-s'] },
        debug: { command: 'java', args: ['-jar', serverJar, '-s'] }
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'wml' }]
    };

    const client = new LanguageClient(
        'wmlLanguageServer',
        'WML Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}