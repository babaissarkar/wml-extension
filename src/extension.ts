import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    // Start LSP client
    const serverJar = context.asAbsolutePath('server/wml.jar');
    const serverOptions: ServerOptions = {
        run: { command: 'java', args: ['-jar', serverJar] },
        debug: { command: 'java', args: ['-jar', serverJar] }
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'plaintext' }]
    };

    const client = new LanguageClient(
        'wmlLanguageServer',
        'WML Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
    console.log("Client started!");
    vscode.window.setStatusBarMessage("WML LSP Ready", 5000);
}