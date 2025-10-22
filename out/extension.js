"use strict";
// Build with: npx tsc -p .
// 5 errors are expected from linkedList, ignore them.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSetting = requireSetting;
exports.activate = activate;
const vscode = require("vscode");
const path = require("path");
const node_1 = require("vscode-languageclient/node");
let client;
/**
* Ensures a string setting is set. If empty/undefined, asks the user for input.
* Optionally saves the user’s input back into settings.
*/
function requireSetting(section_1, key_1, prompt_1, placeHolder_1) {
    return __awaiter(this, arguments, void 0, function* (section, // e.g. "myExtension"
    key, // e.g. "coreIncludeDir"
    prompt, // input box prompt
    placeHolder, // optional placeholder
    save = true // save user input back to settings.json
    ) {
        const config = vscode.workspace.getConfiguration(section);
        let value = config.get(key, '');
        if (!value) {
            const input = yield vscode.window.showInputBox({
                prompt,
                placeHolder,
                ignoreFocusOut: true
            });
            if (input && input.trim().length > 0) {
                value = input.trim();
                if (save) {
                    yield config.update(key, value, vscode.ConfigurationTarget.Workspace);
                }
            }
            else {
                vscode.window.showErrorMessage(`Required setting "${section}.${key}" is missing.`);
                return undefined;
            }
        }
        return value;
    });
}
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Start LSP client
        const serverJar = context.asAbsolutePath('server/wml.jar');
        // Ensure workspace root exists
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace folder open. Please open a folder before starting the WML language server.");
            throw new Error("Workspace root not found");
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const dataDir = yield requireSetting('wml', 'dataDir', 'Please enter the Wesnoth gamedata directory. (Could be set later via Settings)');
        const userDataDir = yield requireSetting('wml', 'userDataDir', 'Please enter the Wesnoth userdata directory. (Could be set later via Settings)');
        const defines = yield requireSetting('wml', 'defines', 'Any additional defines, like CAMPAIGN_MY_CAMPAIGN or EDITOR. (Could be set later via Settings)');
        if (!dataDir || !userDataDir) {
            return; // bail out if user canceled
        }
        const coreIncludeDir = path.join(dataDir, 'core', 'macros');
        const macroArgs = defines
            ? defines
                .split(",")
                .map(pair => pair.split("="))
                .filter(([key, value]) => key && value) // ignore malformed ones
                .flatMap(([key, value]) => ["-d", key.trim(), value.trim()])
            : [];
        const args = [
            '-jar', serverJar,
            '-s',
            '-i', workspaceRoot,
            '-datadir', dataDir,
            '-userdatadir', userDataDir,
            '-include', coreIncludeDir,
            ...macroArgs // safely adds nothing if macros == ""
        ];
        const serverOptions = {
            run: { command: 'java', args },
            debug: { command: 'java', args }
        };
        const clientOptions = {
            documentSelector: [{ scheme: 'file', language: 'wml' }],
            errorHandler: {
                error: () => {
                    return { action: node_1.ErrorAction.Shutdown };
                },
                closed: () => {
                    return { action: node_1.CloseAction.DoNotRestart };
                }
            }
        };
        const client = new node_1.LanguageClient('wmlLanguageServer', 'WML Language Server', serverOptions, clientOptions);
        client.start();
    });
}
//# sourceMappingURL=extension.js.map