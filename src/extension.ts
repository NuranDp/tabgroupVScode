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
	return context.globalState.get<TabGroup[]>(TAB_GROUPS_KEY) || [];
}

function saveGroups(context: vscode.ExtensionContext, groups: TabGroup[]) {
	context.globalState.update(TAB_GROUPS_KEY, groups);
}

function loadSortMode(context: vscode.ExtensionContext): SortMode {
	return (context.globalState.get<SortMode>(SORT_MODE_KEY) || SortMode.MANUAL);
}

function saveSortMode(context: vscode.ExtensionContext, mode: SortMode) {
	context.globalState.update(SORT_MODE_KEY, mode);
}

let treeView: vscode.TreeView<TreeItem> | undefined;
let treeDataProvider: TabGroupTreeProvider | undefined;
let expandedGroups = new Set<string>();

export function activate(context: vscode.ExtensionContext) {
	let groups: TabGroup[] = loadGroups(context);
	let sortMode: SortMode = loadSortMode(context);

	treeDataProvider = new TabGroupTreeProvider(groups, context, () => sortMode);
	treeView = vscode.window.createTreeView('tabGroupsView', {
		treeDataProvider,
		dragAndDropController: treeDataProvider.dragAndDropController
	});

	treeView.onDidExpandElement(e => {
		if (e.element.id) expandedGroups.add(e.element.id);
	});
	treeView.onDidCollapseElement(e => {
		if (e.element.id) expandedGroups.delete(e.element.id);
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
				treeDataProvider?.refresh();
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
					treeDataProvider?.refresh();
					break;
				}

			}
		}),

		// Delete group
		vscode.commands.registerCommand('tabgroupview.deleteGroup', async (item: TreeItem) => {
			if (item.contextValue !== 'group' && item.contextValue !== 'groupPinned') return;

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
					treeDataProvider?.refresh();
				}
			}
		}),

		// Rename group
		vscode.commands.registerCommand('tabgroupview.renameGroup', async (item: TreeItem) => {
			if (item.contextValue !== 'group' && item.contextValue !== 'groupPinned') return;

			const oldLabel = item.label;
			const newLabel = await vscode.window.showInputBox({
				prompt: 'Enter new group name',
				value: typeof oldLabel === 'string' ? oldLabel : '',
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
				treeDataProvider?.refresh();
				vscode.window.showInformationMessage(`Group renamed to '${newLabel}'`);
			}
		}),

		// Switch sorting mode
		vscode.commands.registerCommand('tabgroupview.switchSortMode', async () => {
			const options = [
				{ label: 'Manual (draggable)', mode: SortMode.MANUAL },
				{ label: 'Name Ascending (A-Z)', mode: SortMode.NAME_ASC },
				{ label: 'Name Descending (Z-A)', mode: SortMode.NAME_DESC }
			];
			const picked = await vscode.window.showQuickPick(options, {
				placeHolder: 'Select global sorting mode for files in groups'
			});
			if (!picked) return;
			sortMode = picked.mode;
			saveSortMode(context, sortMode);
			treeDataProvider?.refresh();
		}),

		// Switch sorting mode for a group
		vscode.commands.registerCommand('tabgroupview.switchGroupSortMode', async (item: TreeItem) => {
			if (item.contextValue !== 'group' && item.contextValue !== 'groupPinned') return;
			const group = groups.find(g => g.label === item.label);
			if (!group) return;

			const options = [
				{ label: 'Manual (draggable)', mode: SortMode.MANUAL },
				{ label: 'Name Ascending (A-Z)', mode: SortMode.NAME_ASC },
				{ label: 'Name Descending (Z-A)', mode: SortMode.NAME_DESC },
				{ label: 'Use Global', mode: undefined }
			];
			const picked = await vscode.window.showQuickPick(options, {
				placeHolder: `Select sorting mode for group "${group.label}"`
			});
			if (!picked) return;
			group.sortMode = picked.mode;
			saveGroups(context, groups);
			treeDataProvider?.refresh();
		}),

		vscode.commands.registerCommand('tabgroupview.pinGroup', async (item: TreeItem) => {
			if (item.contextValue !== 'group') return;
			const group = groups.find(g => g.label === item.label);
			if (!group) return;
			group.pinned = true;
			saveGroups(context, groups);
			treeDataProvider?.refresh();
		}),

		vscode.commands.registerCommand('tabgroupview.unpinGroup', async (item: TreeItem) => {
			if (item.contextValue !== 'groupPinned') return;
			const group = groups.find(g => g.label === item.label);
			if (!group) return;
			group.pinned = false;
			saveGroups(context, groups);
			treeDataProvider?.refresh();
		}),

		vscode.commands.registerCommand('tabgroupview.expandAll', async () => {
			if (!treeView || !treeDataProvider) return;
			const roots = await treeDataProvider.getChildren(undefined);
			if (roots && roots.length) {
				for (const group of roots) {
					await treeView.reveal(group, { expand: true, focus: false, select: false });
				}
			}
		})
	);
}

// Custom TreeItem class to ensure contextValue and id are set
class TreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		public readonly id?: string
	) {
		super(label, collapsibleState);
		this.contextValue = contextValue;
		if (id) this.id = id;
	}
}

class TabGroupTreeProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

	public readonly dragAndDropController: vscode.TreeDragAndDropController<TreeItem>;

	constructor(
		private groups: TabGroup[],
		private context: vscode.ExtensionContext,
		private getSortMode: () => SortMode
	) {
		this.dragAndDropController = new TabGroupDragAndDropController(groups, context, this.refresh.bind(this), this.getSortMode);
	}
	getTreeItem(element: TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TreeItem): Thenable<TreeItem[]> {
		if (!element) {
			// Top level: group nodes, pinned first
			const sortedGroups = [
				...this.groups.filter(g => g.pinned),
				...this.groups.filter(g => !g.pinned)
			];
			return Promise.resolve(sortedGroups.map(
				group => {
					const contextValue = group.pinned ? 'groupPinned' : 'group';
					const item = new TreeItem(
						group.label,
						vscode.TreeItemCollapsibleState.Collapsed,
						contextValue,
						`group:${group.label}` // Stable id
					);
					if (group.pinned) item.description = 'Pinned';
					return item;
				}
			));
		} else if (element.contextValue === 'group' || element.contextValue === 'groupPinned') {
			const group = this.groups.find(g => g.label === element.label);
			if (!group) return Promise.resolve([]);

			let files = [...group.files];
			const sortMode = group.sortMode ?? this.getSortMode();

			if (sortMode === SortMode.NAME_ASC) {
				files.sort((a, b) => {
					const aName = vscode.workspace.asRelativePath(a, false).split(/[\\/]/).pop() || a;
					const bName = vscode.workspace.asRelativePath(b, false).split(/[\\/]/).pop() || b;
					return aName.localeCompare(bName);
				});
			} else if (sortMode === SortMode.NAME_DESC) {
				files.sort((a, b) => {
					const aName = vscode.workspace.asRelativePath(a, false).split(/[\\/]/).pop() || a;
					const bName = vscode.workspace.asRelativePath(b, false).split(/[\\/]/).pop() || b;
					return bName.localeCompare(aName);
				});
			}
			// Manual: keep order as in group.files

			const fileItems = files.map(filePath => {
				const fileName = vscode.workspace.asRelativePath(filePath, false).split(/[\\/]/).pop() || filePath;
				const item = new TreeItem(
					fileName,
					vscode.TreeItemCollapsibleState.None,
					'file',
					`file:${group.label}:${filePath}` // Stable id for files
				);
				item.resourceUri = vscode.Uri.file(filePath);
				item.command = {
					command: 'vscode.open',
					title: 'Open File',
					arguments: [vscode.Uri.file(filePath)]
				};
				item.tooltip = filePath;
				item.description = vscode.workspace.asRelativePath(filePath, false);
				return item;
			});

			return Promise.resolve(fileItems);
		}
		return Promise.resolve([]);
	}

	getParent(element: TreeItem): TreeItem | undefined {
		// All groups are root, so they have no parent
		// Files' parent is the group
		if (element.contextValue === 'file') {
			// Find the group this file belongs to
			for (const group of this.groups) {
				if (group.files.includes(element.resourceUri?.fsPath || '')) {
					return new TreeItem(
						group.label,
						vscode.TreeItemCollapsibleState.Collapsed,
						group.pinned ? 'groupPinned' : 'group',
						`group:${group.label}`
					);
				}
			}
		}
		// Root groups have no parent
		return undefined;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}
}

class TabGroupDragAndDropController implements vscode.TreeDragAndDropController<TreeItem> {
	public readonly dragMimeTypes = ['application/vnd.code.tree.tabGroupsView'];
	public readonly dropMimeTypes = ['application/vnd.code.tree.tabGroupsView'];

	constructor(
		private groups: TabGroup[],
		private context: vscode.ExtensionContext,
		private refresh: () => void,
		private getSortMode: () => SortMode
	) { }

	handleDrag(source: TreeItem[], dataTransfer: vscode.DataTransfer): void | Thenable<void> {
		const files = source.filter(s => s.contextValue === 'file').map(s => s.resourceUri?.fsPath || '');
		dataTransfer.set('application/vnd.code.tree.tabGroupsView', new vscode.DataTransferItem(JSON.stringify(files)));
	}

	async handleDrop(target: TreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		const transferItem = dataTransfer.get('application/vnd.code.tree.tabGroupsView');
		if (!transferItem) return;

		const fileList: string[] = JSON.parse(await transferItem.asString());

		// Find the target group and file
		let targetGroup: TabGroup | undefined;
		let targetIndex = -1;

		if (target && target.contextValue === 'file') {
			targetGroup = this.groups.find(g => g.files.includes(target.resourceUri?.fsPath || ''));
			targetIndex = targetGroup?.files.indexOf(target.resourceUri?.fsPath || '') ?? -1;
		} else if (target && target.contextValue === 'group') {
			targetGroup = this.groups.find(g => g.label === target.label);
			targetIndex = targetGroup?.files.length ?? -1;
		}

		// Only allow manual sorting
		const sortMode = targetGroup?.sortMode ?? this.getSortMode();
		if (sortMode !== SortMode.MANUAL) return;

		if (!targetGroup) return;

		// Remove files from all groups first
		for (const file of fileList) {
			for (const group of this.groups) {
				const idx = group.files.indexOf(file);
				if (idx !== -1) group.files.splice(idx, 1);
			}
		}

		// Insert files at the target index
		if (targetIndex === -1) {
			targetGroup.files.push(...fileList);
		} else {
			targetGroup.files.splice(targetIndex, 0, ...fileList);
		}

		saveGroups(this.context, this.groups);
		this.refresh();
	}
}
