import { ExtensionContext } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";
import * as vscode from "vscode";

const clientName = "ftl languge server";
const clientId = "ftl";
let client: LanguageClient;

export async function activate(context: ExtensionContext) {
  console.log('"ftl" extension activated');

  let restartCmd = vscode.commands.registerCommand(
    `${clientId}.restart`,
    async () => {
      await stopClient();
      startClient(context);
    }
  );

  startClient(context);
  context.subscriptions.push(restartCmd, client);
}

export async function deactivate() {
  await stopClient();
}

function startClient(context: ExtensionContext) {
  console.log("Starting client");
  const ftlConfig = vscode.workspace.getConfiguration("ftl");
  const ftlPath = ftlConfig.get("installationPath") ?? "ftl";

  let workspaceRootPath =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : null;

  if (!workspaceRootPath) {
    vscode.window.showErrorMessage(
      "FTL extension requires an open folder to work correctly."
    );
    return;
  }

  console.log(ftlPath, "dev", workspaceRootPath);

  let serverOptions: ServerOptions = {
    run: {
      command: `${ftlPath}`,
      args: ["dev", `${workspaceRootPath}`],
    },
    debug: {
      command: `${ftlPath}`,
      args: ["dev", `${workspaceRootPath}`],
    },
  };

  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "kotlin" },
      { scheme: "file", language: "go" },
    ],
  };

  client = new LanguageClient(
    clientId,
    clientName,
    serverOptions,
    clientOptions
  );

  console.log("Starting client");
  client.start().then(
    () => {
      console.log(`${clientName} started successfully.`);
      // Any other initialization code that should run after the client has started
    },
    (error) => {
      console.error(`The ${clientName} failed to start:`, error);
    }
  );

  client.onDidChangeState((e) => {
    console.log("Language server state changed", e);
    // Optionally, attempt to restart the server or notify the user
  });
}

async function stopClient() {
  if (!client) {
    return;
  }

  process.kill(client["_serverProcess"].pid, "SIGINT");

  //TODO: not sure why this isn't working well.
  // await client.stop(2000);

  console.log("Disposing client");
  client.outputChannel.dispose();
}
