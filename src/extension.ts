// Build with: npx tsc -p .
// 5 errors are expected from linkedList, ignore them.

import * as vscode from 'vscode';
import * as path from 'path';
import { CloseAction, ErrorAction, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

let client: LanguageClient;

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
    const serverJar = context.asAbsolutePath('server/wml.jar');

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

    const args: string[] = [
        '-jar', serverJar,
        '-s',
        '-i', workspaceRoot,
        '-datadir', dataDir,
        '-userdatadir', userDataDir,
        '-include', coreIncludeDir,
        '-include', coreUnitsDir,
        ...macroArgs // safely adds nothing if macros == ""
    ];

    vscode.window.showInformationMessage(`Running: java ${args.join(' ')}`);

    const serverOptions: ServerOptions = {
        run: { command: 'java', args },
        debug: { command: 'java', args }
    };

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

    const client = new LanguageClient(
        'wmlLanguageServer',
        'WML Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}