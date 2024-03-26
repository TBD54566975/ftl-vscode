import {ExtensionContext} from 'vscode';

import {LanguageClient, LanguageClientOptions, ServerOptions} from 'vscode-languageclient/node';
import * as vscode from "vscode";

const clientName = "ftl languge server";
const clientId = "ftl";
let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    console.log('Extension "ftl" is now active!');

    let restartCmd = vscode.commands.registerCommand(`${clientId}.restart`, async () => {
        await stopClient();
        startClient(context);
    });

    let showLogsCmd = vscode.commands.registerCommand(`${clientId}.showLogs`, () => {
        if (!client) {
            return;
        }
        client.outputChannel.show(true);
    });

    context.subscriptions.push(
        restartCmd,
        showLogsCmd,
    );

    startClient(context);
    context.subscriptions.push(client);
}

export async function deactivate() {
    await stopClient();
}

function startClient(context: ExtensionContext) {
    let serverOptions: ServerOptions = {
        run: {command: "/Users/worstell/Development/ftl/build/release/ftl", args: ["dev", "."]},
        debug: {command: "/Users/worstell/Development/ftl/build/release/ftl", args: ["dev", "."]},
    };

    let clientOptions: LanguageClientOptions = {
        documentSelector: [
            {scheme: 'file', language: 'kotlin'},
            {scheme: 'file', language: 'go'}
        ],
    };

    client = new LanguageClient(clientId, clientName, serverOptions, clientOptions);
    client.start().then(() => {
        console.log(`${clientName} started successfully.`);
        // Any other initialization code that should run after the client has started
    }, (error) => {
        console.error(`The ${clientName} failed to start:`, error);
    });
}

async function stopClient() {
    if (!client) {
        return;
    }

    await client.stop();
    client.outputChannel.dispose();
}