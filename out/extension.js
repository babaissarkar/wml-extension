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
exports.optionalSetting = optionalSetting;
exports.activate = activate;
const vscode = require("vscode");
const fs = require("fs");
const fsp = require("fs/promises");
const https = require("https");
const path = require("path");
const promises_1 = require("stream/promises");
const util_1 = require("util");
const child_process_1 = require("child_process");
const node_1 = require("vscode-languageclient/node");
let client;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const STANDALONE_LSP_URLS = {
    win32: 'https://github.com/babaissarkar/wml-parser-lsp/releases/download/latest/WML.exe',
    linux: 'https://github.com/babaissarkar/wml-parser-lsp/releases/download/latest/WML.AppImage'
};
function hasJavaRuntime() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const config = vscode.workspace.getConfiguration('wml');
            let path = config.get('javapath', '');
            yield execFileAsync(path == '' ? 'java' : path, ['-version']);
            return true;
        }
        catch (_a) {
            vscode.window.showErrorMessage(`Invalid Java path: ${path}`);
            return false;
        }
    });
}
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            if (response.statusCode &&
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location) {
                const redirectedUrl = new URL(response.headers.location, url).toString();
                response.resume();
                downloadFile(redirectedUrl, destination).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`Failed to download LSP binary. HTTP ${response.statusCode}`));
                return;
            }
            const output = fs.createWriteStream(destination);
            (0, promises_1.pipeline)(response, output).then(resolve).catch(reject);
        });
        request.on('error', reject);
    });
}
function downloadFileAtomic(url, destination) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempPath = `${destination}.tmp`;
        yield fsp.rm(tempPath, { force: true });
        try {
            yield downloadFile(url, tempPath);
            yield fsp.rename(tempPath, destination);
        }
        catch (error) {
            yield fsp.rm(tempPath, { force: true });
            throw error;
        }
    });
}
function ensureStandaloneServerBinary(serverDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const downloadUrl = STANDALONE_LSP_URLS[process.platform];
        if (!downloadUrl) {
            return undefined;
        }
        const outputName = process.platform === 'win32' ? 'WML.exe' : 'WML.AppImage';
        const outputPath = path.join(serverDir, outputName);
        yield fsp.mkdir(serverDir, { recursive: true });
        if (!fs.existsSync(outputPath)) {
            yield vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                cancellable: false,
                title: 'WML: Downloading language server binary'
            }, (progress) => __awaiter(this, void 0, void 0, function* () {
                progress.report({ message: `Fetching ${outputName}...` });
                yield downloadFileAtomic(downloadUrl, outputPath);
            }));
        }
        if (process.platform !== 'win32') {
            yield fsp.chmod(outputPath, 0o755);
        }
        return outputPath;
    });
}
/**
* Ensures a string setting is set. If empty/undefined, asks the user for input.
* Optionally saves the user’s input back into settings.
*/
function requireSetting(section, // e.g. "myExtension"
key, // e.g. "coreIncludeDir"
prompt, // input box prompt
placeHolder) {
    return __awaiter(this, void 0, void 0, function* () {
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
                yield config.update(key, value, vscode.ConfigurationTarget.Workspace);
            }
            else {
                vscode.window.showErrorMessage(`Required setting "${section}.${key}" is missing.`);
                return undefined;
            }
        }
        return value;
    });
}
/**
* Optional setting. If empty/undefined, asks the user for input.
* Optionally saves the user’s input back into settings.
* FIXME: this will keep prompting the user if not set on every launch.
* but this is optional setting so should be shown once maybe?
*/
function optionalSetting(section, // e.g. "myExtension"
key, // e.g. "coreIncludeDir"
prompt, // input box prompt
placeHolder) {
    return __awaiter(this, void 0, void 0, function* () {
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
                yield config.update(key, value, vscode.ConfigurationTarget.Workspace);
            }
        }
        return undefined;
    });
}
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Start LSP client
        const serverDir = context.asAbsolutePath('server');
        const serverJar = path.join(serverDir, 'wml.jar');
        // Ensure workspace root exists
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace folder open. Please open a folder before starting the WML language server.");
            throw new Error("Workspace root not found");
        }
        let javaInstalled = yield hasJavaRuntime();
        if (!javaInstalled) {
            yield requireSetting('wml', 'javapath', 'Please enter Java Runtime path. (Could be set later via Settings)');
        }
        const dataDir = yield requireSetting('wml', 'dataDir', 'Please enter the Wesnoth gamedata directory. (Could be set later via Settings)');
        const userDataDir = yield requireSetting('wml', 'userDataDir', 'Please enter the Wesnoth userdata directory. (Could be set later via Settings)');
        let shown_once = context.workspaceState.get('wml.define_prompt_shown_once', false);
        let defines = undefined;
        if (!shown_once) {
            defines = yield optionalSetting('wml', 'defines', 'Any additional defines, like CAMPAIGN_MY_CAMPAIGN or EDITOR. (This prompt will be shown once, but Defines could be set later via Settings)');
            yield context.workspaceState.update('wml.define_prompt_shown_once', true);
        }
        else {
            const config = vscode.workspace.getConfiguration('wml');
            defines = config.get('defines', '');
            if (defines == '') {
                defines = undefined;
            }
        }
        if (!dataDir || !userDataDir) {
            return; // bail out if user canceled
        }
        const coreIncludeDir = path.join(dataDir, 'core', 'macros');
        const coreUnitsDir = path.join(dataDir, 'core', 'units.cfg');
        const macroArgs = defines
            ? defines
                .split(",")
                .map(pair => pair.split("="))
                .filter(([key, value]) => key && value) // ignore malformed ones
                .flatMap(([key, value]) => ["-d", key.trim(), value.trim()])
            : [];
        const sharedArgs = [
            '-s',
            '-datadir', dataDir,
            '-userdatadir', userDataDir,
            '-include', coreIncludeDir,
            '-include', coreUnitsDir,
            ...macroArgs
        ];
        // javaInstalled = await hasJavaRuntime();
        let serverOptions;
        // if(javaInstalled) {
        const args = ['-jar', serverJar, ...sharedArgs];
        const config = vscode.workspace.getConfiguration('wml');
        const raw = (config.get('javapath', '') || '').trim();
        const javacmd = raw === '' ? 'java' : raw;
        vscode.window.showInformationMessage(`Running: ${javacmd} ${args.join(' ')}`);
        serverOptions = {
            run: { command: javacmd, args },
            debug: { command: javacmd, args }
        };
        // } else {
        //     const standaloneBinary = await ensureStandaloneServerBinary(serverDir);
        //     if (!standaloneBinary) {
        //         vscode.window.showErrorMessage(
        //             `Java is not installed and no standalone WML language server is available for ${os.platform()}.`
        //         );
        //         return;
        //     }
        //     vscode.window.showInformationMessage(`Running: ${standaloneBinary} ${sharedArgs.join(' ')}`);
        //     serverOptions = {
        //         run: { command: standaloneBinary, args: sharedArgs },
        //         debug: { command: standaloneBinary, args: sharedArgs }
        //     };
        // }
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
        client = new node_1.LanguageClient('wmlLanguageServer', 'WML Language Server', serverOptions, clientOptions);
        client.start();
    });
}
//# sourceMappingURL=extension.js.map