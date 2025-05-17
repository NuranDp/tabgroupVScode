import * as vscode from 'vscode';

interface TabGroup {
	label: string;
	files: string[];
}

const TAB_GROUPS_KEY = 'tabGroups';

function loadGroups(context: vscode.ExtensionContext): TabGroup[] {
	return context.globalState.get<TabGroup[]>(TAB_GROUPS_KEY) || [];
}

function saveGroups(context: vscode.ExtensionContext, groups: TabGroup[]) {
	context.globalState.update(TAB_GROUPS_KEY, groups);
}

export function activate(context: vscode.ExtensionContext) {
	let groups: TabGroup[] = loadGroups(context);

	const treeDataProvider = new TabGroupTreeProvider(groups, context);
	vscode.window.createTreeView('tabGroupsView', {
		treeDataProvider,
		dragAndDropController: treeDataProvider.dragAndDropController
	});

	context.subscriptions.push(

		// Add to group
		vscode.commands.registerCommand('tabgroupview.addToGroup', async (uri: vscode.Uri) => {
			const filePath = uri.fsPath;
			const groupNames = groups.map(g => g.label);
			const selected = await vscode.window.showQuickPick(
				[...groupNames, '$(plus) Create new group'],
				{ placeHolder: 'Select a tab group to add this file' }
			);

			if (!selected) return;

			let targetGroup: TabGroup;

			if (selected === '$(plus) Create new group') {
				const newGroup = await vscode.window.showInputBox({ prompt: 'Enter new group name' });
				if (!newGroup) return;
				targetGroup = { label: newGroup, files: [] };
				groups.push(targetGroup);
			} else {
				targetGroup = groups.find(g => g.label === selected)!;
			}

			if (!targetGroup.files.includes(filePath)) {
				targetGroup.files.push(filePath);
				saveGroups(context, groups);
				vscode.window.showInformationMessage(`Added to group: ${targetGroup.label}`);
				treeDataProvider.refresh();
			}
		}),

		// Remove file from group
		vscode.commands.registerCommand('tabgroupview.removeFromGroup', async (item: TreeItem) => {
			if (item.contextValue !== 'file') return;

			for (const group of groups) {
				const filePath = item.resourceUri?.fsPath;
				if (!filePath) return;

				const idx = group.files.indexOf(filePath);
				if (idx !== -1) {
					group.files.splice(idx, 1);
					saveGroups(context, groups);
					vscode.window.showInformationMessage(`Removed from group: ${group.label}`);
					treeDataProvider.refresh();
					break;
				}

			}
		}),

		// Delete group
		vscode.commands.registerCommand('tabgroupview.deleteGroup', async (item: TreeItem) => {
			if (item.contextValue !== 'group') return;

			const confirm = await vscode.window.showWarningMessage(
				`Delete group "${item.label}"?`,
				{ modal: true },
				'Delete'
			);
			if (confirm === 'Delete') {
				const idx = groups.findIndex(g => g.label === item.label);
				if (idx !== -1) {
					groups.splice(idx, 1);
					saveGroups(context, groups);
					vscode.window.showInformationMessage(`Deleted group: ${item.label}`);
					treeDataProvider.refresh();
				}
			}
		}),

		// Rename group
		vscode.commands.registerCommand('tabgroupview.renameGroup', async (item: TreeItem) => {
			if (item.contextValue !== 'group') return;

			const oldLabel = item.label;
			const newLabel = await vscode.window.showInputBox({
				prompt: 'Enter new group name',
				value: oldLabel,
				validateInput: (value) => {
					if (!value.trim()) return 'Group name cannot be empty';
					if (groups.some(g => g.label === value && value !== oldLabel)) return 'Group name already exists';
					return null;
				}
			});

			if (!newLabel || newLabel === oldLabel) return;

			const group = groups.find(g => g.label === oldLabel);
			if (group) {
				group.label = newLabel;
				saveGroups(context, groups);
				treeDataProvider.refresh();
				vscode.window.showInformationMessage(`Group renamed to '${newLabel}'`);
			}
		})
	);
}

class TabGroupTreeProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

	public readonly dragAndDropController: vscode.TreeDragAndDropController<TreeItem>;

	constructor(private groups: TabGroup[], private context: vscode.ExtensionContext) {
		this.dragAndDropController = new TabGroupDragAndDropController(groups, context, this.refresh.bind(this));
	}
	getTreeItem(element: TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TreeItem): Thenable<TreeItem[]> {
		if (!element) {
			// Top level: group nodes
			return Promise.resolve(this.groups.map(
				group => new TreeItem(group.label, vscode.TreeItemCollapsibleState.Collapsed, 'group')
			));
		} else if (element.contextValue === 'group') {
			// Find group by label
			const group = this.groups.find(g => g.label === element.label);
			if (!group) return Promise.resolve([]);

			// Map to TreeItems
			const fileItems = group.files.map(filePath => {
				const fileName = vscode.workspace.asRelativePath(filePath, false).split(/[\\/]/).pop() || filePath;
				const item = new TreeItem(fileName, vscode.TreeItemCollapsibleState.None, 'file');
				item.resourceUri = vscode.Uri.file(filePath); // preserves VSCode icons
				item.command = {
					command: 'vscode.open',
					title: 'Open File',
					arguments: [vscode.Uri.file(filePath)]
				};
				item.tooltip = filePath;
				item.description = vscode.workspace.asRelativePath(filePath, false);
				return item;
			});

			// Sort alphabetically by label
			fileItems.sort((a, b) => a.label.localeCompare(b.label));

			return Promise.resolve(fileItems);
		}
		return Promise.resolve([]);
	}


	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}
}

class TabGroupDragAndDropController implements vscode.TreeDragAndDropController<TreeItem> {
	public readonly dragMimeTypes = ['application/vnd.code.tree.tabGroupsView'];
	public readonly dropMimeTypes = ['application/vnd.code.tree.tabGroupsView'];

	constructor(private groups: TabGroup[], private context: vscode.ExtensionContext, private refresh: () => void) { }

	handleDrag(source: TreeItem[], dataTransfer: vscode.DataTransfer): void | Thenable<void> {
		const files = source.filter(s => s.contextValue === 'file').map(s => s.label);
		dataTransfer.set('application/vnd.code.tree.tabGroupsView', new vscode.DataTransferItem(files.join(',')));
	}

	async handleDrop(target: TreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
		const transferItem = dataTransfer.get('application/vnd.code.tree.tabGroupsView');
		if (!transferItem) return;

		const fileList = (await transferItem.asString()).split(',');

		if (!target || target.contextValue !== 'group') return;

		const targetGroup = this.groups.find(g => g.label === target.label);
		if (!targetGroup) return;

		for (const file of fileList) {
			// Remove from all groups first
			for (const group of this.groups) {
				const idx = group.files.indexOf(file);
				if (idx !== -1) group.files.splice(idx, 1);
			}
			// Then add to target group
			if (!targetGroup.files.includes(file)) {
				targetGroup.files.push(file);
			}
		}

		saveGroups(this.context, this.groups);
		this.refresh();
		vscode.window.showInformationMessage(`Moved file(s) to group "${targetGroup.label}"`);
	}
}


class TreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: 'group' | 'file' = 'group'
	) {
		super(label, collapsibleState);
		this.contextValue = contextValue;
		if (contextValue === 'file') {
			this.resourceUri = vscode.Uri.file(label); // Enable icon + DnD support
		}
	}
}
