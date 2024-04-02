import { ExtensionContext } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";
import * as vscode from "vscode";
import { started, starting, stopped } from "./status";

const clientName = "ftl languge server";
const clientId = "ftl";
let client: LanguageClient;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export async function activate(context: ExtensionContext) {
  console.log('"ftl" extension activated');

  let restartCmd = vscode.commands.registerCommand(
    `${clientId}.restart`,
    async () => {
      await stopClient();
      startClient(context);
    }
  );

  let stopCmd = vscode.commands.registerCommand(
    `${clientId}.stop`,
    async () => {
      await stopClient();
    }
  );

  let showLogsCommand = vscode.commands.registerCommand("ftl.showLogs", () => {
    outputChannel.show();
  });

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "ftl.showLogs";
  statusBarItem.show();

  // Search for 'ftl-project.toml' or 'ftl.toml' in the workspace
  const tomlFiles = await vscode.workspace.findFiles(
    "**/{ftl-project.toml,ftl.toml}",
    "**/node_modules/**",
    1
  );

  if (tomlFiles.length > 0) {
    startClient(context);
  } else {
    statusBarItem.text = `$(circle-slash) FTL`;
    statusBarItem.tooltip =
      "FTL is disabled because it requires an 'ftl-project.toml' or 'ftl.toml' file in the workspace.";
  }

  context.subscriptions.push(
    restartCmd,
    stopCmd,
    statusBarItem,
    showLogsCommand
  );
}

export async function deactivate() {
  await stopClient();
}

function startClient(context: ExtensionContext) {
  console.log("Starting client");
  starting(statusBarItem);
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

  let serverOptions: ServerOptions = {
    run: {
      command: `${ftlPath}`,
      args: ["dev", `${workspaceRootPath}`, "--run-lsp", "--recreate"],
    },
    debug: {
      command: `${ftlPath}`,
      args: ["dev", `${workspaceRootPath}`, "--run-lsp", "--recreate"],
    },
  };

  outputChannel = vscode.window.createOutputChannel("FTL Logs");
  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "kotlin" },
      { scheme: "file", language: "go" },
    ],
    outputChannel,
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
      started(statusBarItem);
      outputChannel.show();
    },
    (error) => {
      error(statusBarItem, `Error starting ${clientName}: ${error}`);
      outputChannel.appendLine(`Error starting ${clientName}: ${error}`);
      outputChannel.show();
    }
  );

  context.subscriptions.push(client);
}

async function stopClient() {
  if (!client) {
    return;
  }
  console.log("Disposing client");

  if (client["_serverProcess"]) {
    process.kill(client["_serverProcess"].pid, "SIGINT");
  }

  //TODO: not sure why this isn't working well.
  // await client.stop();

  console.log("Client stopped");
  client.outputChannel.dispose();
  console.log("Output channel disposed");
  stopped(statusBarItem);
}
