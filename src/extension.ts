// Build with: npx tsc -p .
// 5 errors are expected from linkedList, ignore them.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { execFile } from 'child_process';
import AdmZip = require('adm-zip');
import { CloseAction, ErrorAction, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

let client: LanguageClient;
const execFileAsync = promisify(execFile);

// ZIP must contain: jre/bin/java (linux) or jre/bin/java.exe (win32), plus wml.jar at root
const BUNDLED_JRE_URLS: Record<string, string> = {
    win32: 'https://github.com/babaissarkar/wml-multitool/releases/download/latest/WML-win.zip',
    linux: 'https://github.com/babaissarkar/wml-multitool/releases/download/latest/WML-linux.zip'
};

// ----------------------------------------------------------------------------
// Java detection
// ----------------------------------------------------------------------------

async function findSystemJava(): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('wml');
    const configured = (config.get<string>('javaPath', '') || '').trim();
    const candidate = configured !== '' ? configured : 'java';
    try {
        await execFileAsync(candidate, ['-version']);
        return candidate;
    } catch {
        return undefined;
    }
}

// ----------------------------------------------------------------------------
// Download helpers
// ----------------------------------------------------------------------------

function downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            if (
                response.statusCode &&
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location
            ) {
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
            pipeline(response, output).then(resolve).catch(reject);
        });

        request.on('error', reject);
    });
}

async function downloadFileAtomic(url: string, destination: string): Promise<void> {
    const tempPath = `${destination}.tmp`;
    await fsp.rm(tempPath, { force: true });
    try {
        await downloadFile(url, tempPath);
        await fsp.rename(tempPath, destination);
    } catch (error) {
        await fsp.rm(tempPath, { force: true });
        throw error;
    }
}

// ----------------------------------------------------------------------------
// Bundled JRE: download ZIP, extract with adm-zip, return java path
// ----------------------------------------------------------------------------

async function ensureBundledJre(serverDir: string): Promise<string | undefined> {
    const downloadUrl = BUNDLED_JRE_URLS[process.platform];
    if (!downloadUrl) {
        vscode.window.showErrorMessage(
            `No bundled JRE available for platform: ${os.platform()}`
        );
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
    await fsp.mkdir(serverDir, { recursive: true });

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: 'WML: Downloading bundled Java runtime'
        },
        async (progress) => {
            progress.report({ message: 'Downloading ZIP...' });
            await downloadFileAtomic(downloadUrl, zipPath);

            progress.report({ message: 'Extracting...' });
            await fsp.rm(extractDir, { recursive: true, force: true });
            await fsp.mkdir(extractDir, { recursive: true });

            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractDir, /* overwrite */ true);

            await fsp.rm(zipPath, { force: true });
        }
    );

    if (!fs.existsSync(javaExe)) {
        vscode.window.showErrorMessage(
            'WML: Bundled JRE extraction failed — java binary not found at expected path.'
        );
        return undefined;
    }

    if (process.platform !== 'win32') {
        await fsp.chmod(javaExe, 0o755);
    }

    return javaExe;
}

// ----------------------------------------------------------------------------
// Settings helpers
// ----------------------------------------------------------------------------

/**
 * Ensures a string setting is set. If empty/undefined, asks the user for input.
 * Saves to **Global** scope.
 */
export async function requireSetting(
    section: string,
    key: string,
    prompt: string,
    placeHolder?: string,
): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration(section);
    let value: string = config.get<string>(key, '');

    if (!value) {
        const input = await vscode.window.showInputBox({
            prompt,
            placeHolder,
            ignoreFocusOut: true
        });

        if (input && input.trim().length > 0) {
            value = input.trim();
            await config.update(key, value, vscode.ConfigurationTarget.Global);
        } else {
            vscode.window.showErrorMessage(`Required setting "${section}.${key}" is missing.`);
            return undefined;
        }
    }

    return value;
}

/**
 * Optional setting. If empty/undefined, asks the user for input once.
 * Saves to **Workspace** scope.
 */
export async function optionalSetting(
    section: string,
    key: string,
    prompt: string,
    placeHolder?: string,
): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration(section);
    let value: string = config.get<string>(key, '');

    if (!value) {
        const input = await vscode.window.showInputBox({
            prompt,
            placeHolder,
            ignoreFocusOut: true
        });

        if (input && input.trim().length > 0) {
            value = input.trim();
            await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            return value;
        }
    }

    return value || undefined;
}

// ----------------------------------------------------------------------------
// activate
// ----------------------------------------------------------------------------

export async function activate(context: vscode.ExtensionContext) {
    const serverDir = context.asAbsolutePath('server');
    // The .jar bundled with the extension (always present in the packaged vsix)
    const serverJar = path.join(serverDir, 'wml.jar');

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
            'No workspace folder open. Please open a folder before starting the WML language server.'
        );
        throw new Error('Workspace root not found');
    }

    const config = vscode.workspace.getConfiguration('wml');
    const exeOverride = (config.get<string>('exePath', '') || '').trim();

    // ------------------------------------------------------------------
    // Resolve java command + jar to run
    // ------------------------------------------------------------------
    let javacmd: string;
    let jarPath: string = serverJar; // always use the extension-bundled jar

    if (exeOverride !== '') {
        // User specified a custom command (could be `java -Xmx512m` etc.)
        // Split on whitespace; first token is the executable, rest prepended to args.
        // NOTE: paths with spaces in exeOverride are not supported.
        const parts = exeOverride.split(/\s+/);
        javacmd = parts[0];
        // parts.slice(1) will be prepended to args below
    } else {
        // Try system java first
        const systemJava = await findSystemJava();

        if (systemJava) {
            javacmd = systemJava;
        } else {
            // No system java — try bundled JRE (downloads if needed)
            vscode.window.showInformationMessage(
                'WML: Java not found on PATH. Attempting to download a bundled JRE...'
            );

            const bundledJava = await ensureBundledJre(context.globalStorageUri.fsPath);
            if (!bundledJava) {
                vscode.window.showErrorMessage(
                    'WML: Could not find or download a Java runtime. ' +
                    'Please install Java or set wml.javaPath in settings.'
                );
                return;
            }

            javacmd = bundledJava;
        }
    }

    // ------------------------------------------------------------------
    // Required setting: gamedata directory from wesnoth
    // ------------------------------------------------------------------

    let dataDir = await requireSetting(
        'wml',
        'dataDir',
        'Please enter the Wesnoth gamedata directory. Must be the part before "data", like "/home/myuser/wesnoth". (Can be entered later in Settings if prompt skipped.)'
    );

    if (!dataDir) {
        return; // user cancelled
    } else if (path.basename(dataDir) === "data") {
        // drop "data" folder if user included it
        dataDir = path.dirname(dataDir);
    }

    let userDataDir = config.get<string>('userDataDir', '');
    if (path.basename(userDataDir) === "data") {
        // drop "data" folder if user included it
        userDataDir = path.dirname(userDataDir);
    }

    const coreIncludeDir = path.join(dataDir, 'data', 'core');

    let defines: string | undefined;
    const raw = config.get<string>('defines', '').trim();
    defines = raw !== '' ? raw : undefined;

    // ------------------------------------------------------------------
    // Build LSP argument list
    // ------------------------------------------------------------------

    const defs: string[] = defines
        ? defines
            .split(',')
            .map(pair => pair.split('='))
            .filter(([key, value]) => key && value)
            .flatMap(([key, value]) => ['-d', key.trim(), value.trim()])
        : [];

    let args: string[];

    if (exeOverride !== '') {
        const parts = exeOverride.split(/\s+/);
        args = [...parts.slice(1)];
    } else {
        args = ['-jar', jarPath];
    }

    args = [
        ...args,
        '-s',
        '-datadir',     dataDir,
        '-include',     coreIncludeDir,
        ...defs
    ];

    if (userDataDir) {
        args.push('-userdatadir');
        args.push(userDataDir);
    }

    vscode.window.showInformationMessage(`WML: Running: ${javacmd} ${args.join(' ')}`);

    // ------------------------------------------------------------------
    // Start LSP client
    // ------------------------------------------------------------------

    const serverOptions: ServerOptions = {
        run:   { command: javacmd, args },
        debug: { command: javacmd, args }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'wml' }],
        errorHandler: {
            error: () => ({ action: ErrorAction.Shutdown }),
            closed: () => ({ action: CloseAction.DoNotRestart })
        }
    };

    client = new LanguageClient(
        'wmlLanguageServer',
        'WML Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}
