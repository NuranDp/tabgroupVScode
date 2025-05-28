import * as vscode from 'vscode';

interface TabGroup {
	label: string;
	files: string[];
	sortMode?: SortMode; // Per-group sorting mode
	pinned?: boolean; // Add this property
}

enum SortMode {
	MANUAL = 'Manual',
	NAME_ASC = 'Name Ascending',
	NAME_DESC = 'Name Descending'
}

const TAB_GROUPS_KEY = 'tabGroups';
const SORT_MODE_KEY = 'tabGroupSortMode';

function loadGroups(context: vscode.ExtensionContext): TabGroup[] {
	return context.workspaceState.get<TabGroup[]>(TAB_GROUPS_KEY) || [];
}

function saveGroups(context: vscode.ExtensionContext, groups: TabGroup[]) {
	context.workspaceState.update(TAB_GROUPS_KEY, groups);
}

function loadSortMode(context: vscode.ExtensionContext): SortMode {
	return (context.workspaceState.get<SortMode>(SORT_MODE_KEY) || SortMode.MANUAL);
}

function saveSortMode(context: vscode.ExtensionContext, mode: SortMode) {
	context.workspaceState.update(SORT_MODE_KEY, mode);
}

// Remove TreeView and related variables, as migration to Webview is complete
// let treeView: vscode.TreeView<TreeItem> | undefined;
// let treeDataProvider: TabGroupTreeProvider | undefined;
// let expandedGroups = new Set<string>();
// let searchTerm: string | undefined = undefined;
// let isSearchActive: boolean = false;

// --- Webview View Provider for Tab Groups ---
class TabGroupsWebviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'tabGroupsView';
	private _view?: vscode.WebviewView;
	private _groups: TabGroup[];
	private _sortMode: SortMode;
	private _searchTerm: string | undefined = undefined;
	private _context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this._groups = loadGroups(context);
		this._sortMode = loadSortMode(context);
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this._context.extensionUri, 'media'),
				vscode.Uri.joinPath(this._context.extensionUri, 'src')
			]
		};
		this._setHtmlForWebview(webviewView.webview);
		this._setWebviewMessageListener(webviewView.webview);
	}

	private _setHtmlForWebview(webview: vscode.Webview) {
        // Load HTML from external file and inject CSS/JS as webview URIs
        const htmlPath = vscode.Uri.joinPath(this._context.extensionUri, 'src', 'tabGroupsWebview.html');
        const cssPath = vscode.Uri.joinPath(this._context.extensionUri, 'src', 'tabGroupsWebview.css');
        const jsPath = vscode.Uri.joinPath(this._context.extensionUri, 'src', 'tabGroupsWebview.js');
        const html = require('fs').readFileSync(htmlPath.fsPath, 'utf8');
        const cssUri = webview.asWebviewUri(cssPath);
        const jsUri = webview.asWebviewUri(jsPath);
        // Replace relative links with webview URIs
        webview.html = html
            .replace('./tabGroupsWebview.css', cssUri.toString())
            .replace('./tabGroupsWebview.js', jsUri.toString());
    }

	private _setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case 'getState':
					this._postState();
					break;
				case 'createGroup':
					if (!msg.name || this._groups.some(g => g.label === msg.name)) return;
					this._groups.push({ label: msg.name, files: [] });
					saveGroups(this._context, this._groups);
					this._postState();
					break;
				case 'renameGroup':
					{
						const group = this._groups.find(g => g.label === msg.oldLabel);
						if (group && !this._groups.some(g => g.label === msg.newLabel)) {
							group.label = msg.newLabel;
							saveGroups(this._context, this._groups);
							this._postState();
						}
					}
					break;
				case 'deleteGroup':
					this._groups = this._groups.filter(g => g.label !== msg.label);
					saveGroups(this._context, this._groups);
					this._postState();
					break;
				case 'togglePinGroup':
					{
						const group = this._groups.find(g => g.label === msg.label);
						if (group) {
							group.pinned = !group.pinned;
							saveGroups(this._context, this._groups);
							this._postState();
						}
					}
					break;
				case 'switchSortMode':
					{
						const options = [SortMode.MANUAL, SortMode.NAME_ASC, SortMode.NAME_DESC];
						const idx = options.indexOf(this._sortMode);
						this._sortMode = options[(idx + 1) % options.length];
						saveSortMode(this._context, this._sortMode);
						this._postState();
					}
					break;
				case 'switchGroupSortMode':
					{
						const group = this._groups.find(g => g.label === msg.label);
						if (group) {
							const options = [SortMode.MANUAL, SortMode.NAME_ASC, SortMode.NAME_DESC, undefined];
							const idx = options.indexOf(group.sortMode);
							group.sortMode = options[(idx + 1) % options.length];
							saveGroups(this._context, this._groups);
							this._postState();
						}
					}
					break;
				case 'removeFromGroup':
					{
						const group = this._groups.find(g => g.label === msg.group);
						if (group) {
							group.files = group.files.filter(f => f !== msg.file);
							saveGroups(this._context, this._groups);
							this._postState();
						}
					}
					break;
				case 'addToGroup':
					{
						// Show file/folder picker
						const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: true, canSelectMany: true });
						if (!uris) return;
						const group = this._groups.find(g => g.label === msg.label);
						if (!group) return;
						for (const uri of uris) {
							const stat = await vscode.workspace.fs.stat(uri);
							if (stat.type === vscode.FileType.Directory) {
								const files = await getAllFilesInFolder(uri);
								for (const f of files) if (!group.files.includes(f)) group.files.push(f);
							} else {
								if (!group.files.includes(uri.fsPath)) group.files.push(uri.fsPath);
							}
						}
						saveGroups(this._context, this._groups);
						this._postState();
					}
					break;
				case 'moveFile':
					{
						const { fromGroup, toGroup, file, after } = msg;
						const src = this._groups.find(g => g.label === fromGroup);
						const dst = this._groups.find(g => g.label === toGroup);
						if (!src || !dst) return;
						src.files = src.files.filter(f => f !== file);
						if (after) {
							const idx = dst.files.indexOf(after);
							dst.files.splice(idx + 1, 0, file);
						} else {
							dst.files.push(file);
						}
						saveGroups(this._context, this._groups);
						this._postState();
					}
					break;
				case 'openFile':
					vscode.commands.executeCommand('vscode.open', vscode.Uri.file(msg.file));
					break;
				case 'exportGroups':
					{
						const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
						const exportGroups = this._groups.map(g => ({
							...g,
							files: g.files.map(f => vscode.workspace.asRelativePath(f, false))
						}));
						const json = JSON.stringify(exportGroups, null, 2);
						const uri = await vscode.window.showSaveDialog({
							saveLabel: 'Export Tab Groups',
							filters: { 'JSON': ['json'] },
							defaultUri: vscode.Uri.file('tab-groups.json')
						});
						if (!uri) return;
						await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
						vscode.window.showInformationMessage('Tab groups exported successfully.');
					}
					break;
				case 'importGroups':
					{
						try {
							const groupsFromFile = JSON.parse(msg.data);
							if (!Array.isArray(groupsFromFile)) throw new Error('Invalid format');
							const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
							const resolvedGroups = groupsFromFile.map(g => ({
								...g,
								files: g.files.map((f: string) => vscode.Uri.file(workspaceFolder ? require('path').join(workspaceFolder, f) : f).fsPath)
							}));
							// Merge logic as before
							const mergedGroups = [...this._groups];
							for (const importedGroup of resolvedGroups) {
								const idx = mergedGroups.findIndex(g => g.label === importedGroup.label);
								if (idx !== -1) {
									for (const file of importedGroup.files) {
										if (!mergedGroups[idx].files.includes(file)) {
											mergedGroups[idx].files.push(file);
										}
									}
								} else {
									mergedGroups.push(importedGroup);
								}
							}
							// Reorder mergedGroups to match import order for imported groups
							const importLabels = resolvedGroups.map(g => g.label);
							mergedGroups.sort((a, b) => {
								const aIdx = importLabels.indexOf(a.label);
								const bIdx = importLabels.indexOf(b.label);
								if (aIdx === -1 && bIdx === -1) return 0;
								if (aIdx === -1) return 1;
								if (bIdx === -1) return -1;
								return aIdx - bIdx;
							});
							this._groups = mergedGroups;
							saveGroups(this._context, this._groups);
							this._postState();
							vscode.window.showInformationMessage('Tab groups imported and merged successfully.');
						} catch (e) {
							vscode.window.showErrorMessage('Failed to import tab groups: ' + (e instanceof Error ? e.message : e));
						}
					}
					break;
			}
		});
	}

	private _postState() {
		if (this._view) {
			// Only show file names in UI, not full paths
			const groupsForUI = this._groups.map(g => ({
				...g,
				files: g.files.map(f => vscode.workspace.asRelativePath(f, false))
			}));
			this._view.webview.postMessage({
				type: 'updateState',
				groups: groupsForUI,
				sortMode: this._sortMode
			});
		}
	}
}

// Helper for recursive folder file collection
async function getAllFilesInFolder(folderUri: vscode.Uri): Promise<string[]> {
	let files: string[] = [];
	const entries = await vscode.workspace.fs.readDirectory(folderUri);
	for (const [name, type] of entries) {
		const entryUri = vscode.Uri.joinPath(folderUri, name);
		if (type === vscode.FileType.File) {
			files.push(entryUri.fsPath);
		} else if (type === vscode.FileType.Directory) {
			const subFiles = await getAllFilesInFolder(entryUri);
			files = files.concat(subFiles);
		}
	}
	return files;
}

// --- Extension Activation (Webview Only) ---
export function activate(context: vscode.ExtensionContext) {
	// Register the webview view provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			TabGroupsWebviewProvider.viewType,
			new TabGroupsWebviewProvider(context)
		)
	);
}
