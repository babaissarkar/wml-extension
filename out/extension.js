"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
function activate(context) {
    // Start LSP client
    const serverJar = context.asAbsolutePath('server/wml.jar');
    const serverOptions = {
        run: { command: 'java', args: ['-jar', serverJar] },
        debug: { command: 'java', args: ['-jar', serverJar] }
    };
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'plaintext' }]
    };
    const client = new node_1.LanguageClient('wmlLanguageServer', 'WML Language Server', serverOptions, clientOptions);
    client.start();
    vscode.window.setStatusBarMessage("WML LSP Ready", 5000);
}
//# sourceMappingURL=extension.js.map