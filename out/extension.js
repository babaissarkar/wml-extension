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
const os = require("os");
const path = require("path");
const net = require("net");
const child_process = require("child_process");
const promises_1 = require("stream/promises");
const util_1 = require("util");
const child_process_1 = require("child_process");
const AdmZip = require("adm-zip");
const node_1 = require("vscode-languageclient/node");
let client;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
// ZIP must contain: jre/bin/java (linux) or jre/bin/java.exe (win32), plus wml.jar at root
const BUNDLED_JRE_URLS = {
    win32: 'https://github.com/babaissarkar/wml-parser-lsp/releases/download/latest/WML-win.zip',
    linux: 'https://github.com/babaissarkar/wml-parser-lsp/releases/download/latest/WML-linux.zip'
};
// ----------------------------------------------------------------------------
// Java detection
// ----------------------------------------------------------------------------
function findSystemJava() {
    return __awaiter(this, void 0, void 0, function* () {
        const config = vscode.workspace.getConfiguration('wml');
        const configured = (config.get('javaPath', '') || '').trim();
        const candidate = configured !== '' ? configured : 'java';
        try {
            yield execFileAsync(candidate, ['-version']);
            return candidate;
        }
        catch (_a) {
            return undefined;
        }
    });
}
// ----------------------------------------------------------------------------
// Download helpers
// ----------------------------------------------------------------------------
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
                reject(new Error(`Failed to download. HTTP ${response.statusCode}`));
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
// ----------------------------------------------------------------------------
// Bundled JRE: download ZIP, extract with adm-zip, return java path
// ----------------------------------------------------------------------------
function ensureBundledJre(serverDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const downloadUrl = BUNDLED_JRE_URLS[process.platform];
        if (!downloadUrl) {
            vscode.window.showErrorMessage(`No bundled JRE available for platform: ${os.platform()}`);
            return undefined;
        }
        const extractDir = path.join(serverDir, 'wml-bundled');
        const javaExe = process.platform === 'win32'
            ? path.join(extractDir, 'jre', 'bin', 'java.exe')
            : path.join(extractDir, 'jre', 'bin', 'java');
        // Already extracted — skip download
        if (fs.existsSync(javaExe)) {
            return javaExe;
        }
        const zipPath = path.join(serverDir, 'wml-bundled.zip');
        yield fsp.mkdir(serverDir, { recursive: true });
        yield vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: 'WML: Downloading bundled Java runtime'
        }, (progress) => __awaiter(this, void 0, void 0, function* () {
            progress.report({ message: 'Downloading ZIP...' });
            yield downloadFileAtomic(downloadUrl, zipPath);
            progress.report({ message: 'Extracting...' });
            yield fsp.rm(extractDir, { recursive: true, force: true });
            yield fsp.mkdir(extractDir, { recursive: true });
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractDir, /* overwrite */ true);
            yield fsp.rm(zipPath, { force: true });
        }));
        if (!fs.existsSync(javaExe)) {
            vscode.window.showErrorMessage('WML: Bundled JRE extraction failed — java binary not found at expected path.');
            return undefined;
        }
        if (process.platform !== 'win32') {
            yield fsp.chmod(javaExe, 0o755);
        }
        return javaExe;
    });
}
// ----------------------------------------------------------------------------
// Settings helpers
// ----------------------------------------------------------------------------
/**
 * Ensures a string setting is set. If empty/undefined, asks the user for input.
 * Saves to **Global** scope.
 */
function requireSetting(section, key, prompt, placeHolder) {
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
                yield config.update(key, value, vscode.ConfigurationTarget.Global);
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
 * Optional setting. If empty/undefined, asks the user for input once.
 * Saves to **Workspace** scope.
 */
function optionalSetting(section, key, prompt, placeHolder) {
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
                return value;
            }
        }
        return value || undefined;
    });
}
function connectWithRetry(port, retries = 10, delay = 500) {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            const socket = new net.Socket();
            socket.connect(port, '127.0.0.1', () => {
                resolve(socket);
            });
            socket.on('error', () => {
                socket.destroy();
                if (n <= 0)
                    return reject(new Error('LSP server did not start in time'));
                setTimeout(() => attempt(n - 1), delay);
            });
        };
        attempt(retries);
    });
}
// ----------------------------------------------------------------------------
// activate
// ----------------------------------------------------------------------------
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const serverDir = context.asAbsolutePath('server');
        // The .jar bundled with the extension (always present in the packaged vsix)
        const serverJar = path.join(serverDir, 'wml.jar');
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder before starting the WML language server.');
            throw new Error('Workspace root not found');
        }
        const config = vscode.workspace.getConfiguration('wml');
        const exeOverride = (config.get('exePath', '') || '').trim();
        // ------------------------------------------------------------------
        // Resolve java command + jar to run
        // ------------------------------------------------------------------
        let javacmd;
        let jarPath = serverJar; // always use the extension-bundled jar
        if (exeOverride !== '') {
            // User specified a custom command (could be `java -Xmx512m` etc.)
            // Split on whitespace; first token is the executable, rest prepended to args.
            // NOTE: paths with spaces in exeOverride are not supported.
            const parts = exeOverride.split(/\s+/);
            javacmd = parts[0];
            // parts.slice(1) will be prepended to args below
        }
        else {
            // Try system java first
            const systemJava = yield findSystemJava();
            if (systemJava) {
                javacmd = systemJava;
            }
            else {
                // No system java — try bundled JRE (downloads if needed)
                vscode.window.showInformationMessage('WML: Java not found on PATH. Attempting to download a bundled JRE...');
                const bundledJava = yield ensureBundledJre(context.globalStorageUri.fsPath);
                if (!bundledJava) {
                    vscode.window.showErrorMessage('WML: Could not find or download a Java runtime. ' +
                        'Please install Java or set wml.javaPath in settings.');
                    return;
                }
                javacmd = bundledJava;
            }
        }
        // ------------------------------------------------------------------
        // Required settings
        // ------------------------------------------------------------------
        const dataDir = yield requireSetting('wml', 'dataDir', 'Please enter the Wesnoth gamedata directory. (Can be changed later in Settings)');
        const userDataDir = yield requireSetting('wml', 'userDataDir', 'Please enter the Wesnoth userdata directory. (Can be changed later in Settings)');
        if (!dataDir || !userDataDir) {
            return; // user cancelled
        }
        // ------------------------------------------------------------------
        // Optional defines (shown only once per workspace)
        // ------------------------------------------------------------------
        let defines;
        const shownOnce = context.workspaceState.get('wml.define_prompt_shown_once', false);
        if (!shownOnce) {
            defines = yield optionalSetting('wml', 'defines', 'Any additional defines, e.g. CAMPAIGN_MY_CAMPAIGN or EDITOR. ' +
                '(This prompt shows once; change via Settings later)');
            yield context.workspaceState.update('wml.define_prompt_shown_once', true);
        }
        else {
            const raw = config.get('defines', '').trim();
            defines = raw !== '' ? raw : undefined;
        }
        // ------------------------------------------------------------------
        // Build argument list
        // ------------------------------------------------------------------
        const coreIncludeDir = path.join(dataDir, 'core', 'macros');
        const coreUnitsDir = path.join(dataDir, 'core', 'units.cfg');
        const macroArgs = defines
            ? defines
                .split(',')
                .map(pair => pair.split('='))
                .filter(([key, value]) => key && value)
                .flatMap(([key, value]) => ['-d', key.trim(), value.trim()])
            : [];
        const sharedArgs = [
            '-s',
            '-datadir', dataDir,
            '-userdatadir', userDataDir,
            '-include', coreIncludeDir,
            '-include', coreUnitsDir,
            ...macroArgs
        ];
        let args;
        if (exeOverride !== '') {
            const parts = exeOverride.split(/\s+/);
            args = [...parts.slice(1), ...sharedArgs];
        }
        else {
            args = ['-jar', jarPath, ...sharedArgs];
        }
        // ------------------------------------------------------------------
        // Start LSP
        // ------------------------------------------------------------------
        const serverOptions = () => new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const port = 9007;
            try {
                // 1. Try connecting to existing server
                const socket = yield connectWithRetry(port, 1, 200);
                return resolve({ reader: socket, writer: socket });
            }
            catch (_a) {
                // 2. Not running → start server
                vscode.window.showInformationMessage(`WML LSP: Starting server...`);
                child_process.spawn(javacmd, args, { stdio: 'ignore' });
                try {
                    // 3. Now retry properly
                    const socket = yield connectWithRetry(port, 10, 500);
                    resolve({ reader: socket, writer: socket });
                }
                catch (err) {
                    reject(err);
                }
            }
        }));
        const clientOptions = {
            documentSelector: [{ scheme: 'file', language: 'wml' }],
            errorHandler: {
                error: () => ({ action: node_1.ErrorAction.Shutdown }),
                closed: () => ({ action: node_1.CloseAction.DoNotRestart })
            }
        };
        client = new node_1.LanguageClient('wmlLanguageServer', 'WML Language Server', serverOptions, clientOptions);
        client.start();
    });
}
//# sourceMappingURL=extension.js.map