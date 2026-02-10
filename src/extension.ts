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
import { CloseAction, ErrorAction, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

let client: LanguageClient;
const execFileAsync = promisify(execFile);

const STANDALONE_LSP_URLS: Record<string, string> = {
    win32: 'https://github.com/babaissarkar/wml-parser-lsp/releases/download/latest/WML.exe',
    linux: 'https://github.com/babaissarkar/wml-parser-lsp/releases/download/latest/WML.AppImage'
};

async function hasJavaRuntime(): Promise<boolean> {
    try {
        await execFileAsync('java', ['-version']);
        return true;
    } catch {
        return false;
    }
}

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
                reject(new Error(`Failed to download LSP binary. HTTP ${response.statusCode}`));
                return;
            }

            const output = fs.createWriteStream(destination);
            pipeline(response, output).then(resolve).catch(reject);
        });

        request.on('error', reject);
    });
}

async function ensureStandaloneServerBinary(serverDir: string): Promise<string | undefined> {
    const downloadUrl = STANDALONE_LSP_URLS[process.platform];
    if (!downloadUrl) {
        return undefined;
    }

    const outputName = process.platform === 'win32' ? 'WML.exe' : 'WML.AppImage';
    const outputPath = path.join(serverDir, outputName);

    await fsp.mkdir(serverDir, { recursive: true });

    if (!fs.existsSync(outputPath)) {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                cancellable: false,
                title: 'WML: Downloading language server binary'
            },
            async (progress) => {
                progress.report({ message: `Fetching ${outputName}...` });
                await downloadFile(downloadUrl, outputPath);
            }
        );
    }

    if (process.platform !== 'win32') {
        await fsp.chmod(outputPath, 0o755);
    }

    return outputPath;
}

/**
* Ensures a string setting is set. If empty/undefined, asks the user for input.
* Optionally saves the user’s input back into settings.
*/
export async function requireSetting(
    section: string,              // e.g. "myExtension"
    key: string,                  // e.g. "coreIncludeDir"
    prompt: string,               // input box prompt
    placeHolder?: string,         // optional placeholder
    save: boolean = true          // save user input back to settings.json
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

            if (save) {
                await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            }
        } else {
            vscode.window.showErrorMessage(`Required setting "${section}.${key}" is missing.`);
            return undefined;
        }
    }

    return value;
}

export async function activate(context: vscode.ExtensionContext) {
    // Start LSP client
    const serverDir = context.asAbsolutePath('server');
    const serverJar = path.join(serverDir, 'wml.jar');

    // Ensure workspace root exists
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
            "No workspace folder open. Please open a folder before starting the WML language server."
        );
        throw new Error("Workspace root not found");
    }

    const workspaceRoot: string = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const dataDir = await requireSetting(
        'wml',
        'dataDir',
        'Please enter the Wesnoth gamedata directory. (Could be set later via Settings)'
    );

    const userDataDir = await requireSetting(
        'wml',
        'userDataDir',
        'Please enter the Wesnoth userdata directory. (Could be set later via Settings)'
    );

    const defines = await requireSetting(
        'wml',
        'defines',
        'Any additional defines, like CAMPAIGN_MY_CAMPAIGN or EDITOR. (Could be set later via Settings)'
    );

    if (!dataDir || !userDataDir) {
        return; // bail out if user canceled
    }

    const coreIncludeDir: string = path.join(dataDir, 'core', 'macros');
    const coreUnitsDir: string = path.join(dataDir, 'core', 'units.cfg');
    const macroArgs = defines
        ? defines
        .split(",")
        .map(pair => pair.split("="))
        .filter(([key, value]) => key && value) // ignore malformed ones
        .flatMap(([key, value]) => ["-d", key.trim(), value.trim()])
        : [];

    const sharedArgs: string[] = [
        '-s',
        '-i', workspaceRoot,
        '-datadir', dataDir,
        '-userdatadir', userDataDir,
        '-include', coreIncludeDir,
        '-include', coreUnitsDir,
        ...macroArgs
    ];

    const javaInstalled = await hasJavaRuntime();
    let serverOptions: ServerOptions;

    if (javaInstalled) {
        const args: string[] = ['-jar', serverJar, ...sharedArgs];
        vscode.window.showInformationMessage(`Running: java ${args.join(' ')}`);
        serverOptions = {
            run: { command: 'java', args },
            debug: { command: 'java', args }
        };
    } else {
        const standaloneBinary = await ensureStandaloneServerBinary(serverDir);

        if (!standaloneBinary) {
            vscode.window.showErrorMessage(
                `Java is not installed and no standalone WML language server is available for ${os.platform()}.`
            );
            return;
        }

        vscode.window.showInformationMessage(`Running: ${standaloneBinary} ${sharedArgs.join(' ')}`);
        serverOptions = {
            run: { command: standaloneBinary, args: sharedArgs },
            debug: { command: standaloneBinary, args: sharedArgs }
        };
    }

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'wml' }],
        errorHandler: {
            error: () => {
                return { action: ErrorAction.Shutdown };
            },
            closed: () => {
                return { action: CloseAction.DoNotRestart };
            }
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
