"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const node_1 = require("vscode-languageclient/node");
let client;
function activate(context) {
    // Start LSP client
    const serverJar = context.asAbsolutePath('server/wml.jar');
    const serverOptions = {
        run: { command: 'java', args: ['-jar', serverJar, '-s'] },
        debug: { command: 'java', args: ['-jar', serverJar, '-s'] }
    };
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'wml' }]
    };
    const client = new node_1.LanguageClient('wmlLanguageServer', 'WML Language Server', serverOptions, clientOptions);
    client.start();
}
//# sourceMappingURL=extension.js.map