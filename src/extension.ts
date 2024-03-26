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
let logPanel: vscode.WebviewPanel | undefined;

export async function activate(context: ExtensionContext) {
  console.log('Extension "ftl" is now active!');
  const provider = new ColorsViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ColorsViewProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("calicoColors.addColor", () => {
      provider.addColor();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("calicoColors.clearColors", () => {
      provider.clearColors();
    })
  );

  let disposable = vscode.commands.registerCommand("ftl.showLogs", function () {
    if (logPanel) {
      logPanel.reveal(vscode.ViewColumn.One);
    } else {
      logPanel = vscode.window.createWebviewPanel(
        "logPanel", // Identifies the type of the webview. Used internally
        "FTL Log Panel", // Title of the panel displayed to the user
        vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
        {} // Webview options.
      );

      logPanel.onDidChangeViewState((state) => {
        console.log(state);
      });

      logPanel.onDidDispose(
        () => {
          logPanel = undefined;
        },
        null,
        context.subscriptions
      );

      updateLogPanel();
    }
  });

  // context.subscriptions.push(disposable);

  let restartCmd = vscode.commands.registerCommand(
    `${clientId}.restart`,
    async () => {
      await stopClient();
      startClient(context);
    }
  );

  // let showLogsCmd = vscode.commands.registerCommand(
  //   `${clientId}.showLogs`,
  //   () => {
  //     if (!client) {
  //       return;
  //     }
  //     client.outputChannel.show(true);
  //   }
  // );

  const outputChannel = vscode.window.createOutputChannel("My Extension");

  // Append a line to the output channel and show it
  outputChannel.appendLine("FTL LOGS!");
  outputChannel.show();

  context.subscriptions.push(restartCmd, disposable, outputChannel);

  // startClient(context);
  // context.subscriptions.push(client);
}

export async function deactivate() {
  await stopClient();
}

function startClient(context: ExtensionContext) {
  const ftlConfig = vscode.workspace.getConfiguration("ftl");
  const ftlPath = ftlConfig.get("installationPath") ?? "ftl";

  let serverOptions: ServerOptions = {
    run: {
      command: `${ftlPath}`,
      args: ["dev", "."],
    },
    debug: {
      command: `${ftlPath}`,
      args: ["dev", "."],
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
  client.start().then(
    () => {
      console.log(`${clientName} started successfully.`);
      // Any other initialization code that should run after the client has started
    },
    (error) => {
      console.error(`The ${clientName} failed to start:`, error);
    }
  );
}

async function stopClient() {
  if (!client) {
    return;
  }

  await client.stop();
  client.outputChannel.dispose();
}

function updateLogPanel() {
  if (!logPanel) {
    return;
  }

  console.log("Updating log panel");
  // Example log entries. You would replace this with your actual log data.
  const logs = [
    { timestamp: "2023-01-01 12:00:00", message: "Log entry 1" },
    { timestamp: "2023-01-01 12:01:00", message: "Log entry 2" },
  ];

  // Use a simple table to display the logs. You can style this with CSS as needed.
  let htmlContent = `<table>`;
  for (const log of logs) {
    htmlContent += `<tr><td>${log.timestamp}</td><td>${log.message}</td></tr>`;
  }
  htmlContent += `</table></body></html>`;

  logPanel.webview.html = htmlContent;
}

class ColorsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "calicoColors.colorsView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "colorSelected": {
          vscode.window.activeTextEditor?.insertSnippet(
            new vscode.SnippetString(`#${data.value}`)
          );
          break;
        }
      }
    });
  }

  public addColor() {
    if (this._view) {
      this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
      this._view.webview.postMessage({ type: "addColor" });
    }
  }

  public clearColors() {
    if (this._view) {
      this._view.webview.postMessage({ type: "clearColors" });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    );

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Cat Colors</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>

				<button class="add-color-button">Add Color</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
