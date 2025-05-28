// @ts-nocheck
// Tab Groups Webview JS (TypeScript)
(function(){
// @ts-ignore: acquireVsCodeApi is injected by VS Code webview
const vscode = acquireVsCodeApi();
// @ts-ignore: 'document' is available in the webview context
let groups: any[] = [];
let sortMode = 'Manual';
let searchTerm = '';
let dragFile: any = null;
let dragGroup: any = null;

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function render() {
    // @ts-ignore: 'document' is available in the webview context
    const container = document.getElementById('groupsContainer')!;
    container.innerHTML = '';
    let filteredGroups = groups;
    for (const group of filteredGroups) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group';
        groupDiv.dataset.label = group.label;
        // Group header
        const header = document.createElement('div');
        header.className = 'group-header';
        header.innerHTML =
            '<span>' + (group.pinned ? '📌 ' : '') + '<b>' + escapeHtml(group.label) + '</b></span>' +
            '<span>' +
                '<button class="icon-btn pin-btn" data-label="' + escapeHtml(group.label) + '" title="Pin/Unpin">' + (group.pinned ? '📌' : '📍') + '</button>' +
                '<button class="icon-btn rename-btn" data-label="' + escapeHtml(group.label) + '" title="Rename">✏️</button>' +
                '<button class="icon-btn delete-btn" data-label="' + escapeHtml(group.label) + '" title="Delete">🗑️</button>' +
                '<button class="icon-btn sort-btn" data-label="' + escapeHtml(group.label) + '" title="Sort">🔀</button>' +
            '</span>';
        groupDiv.appendChild(header);
        // Files
        const filesDiv = document.createElement('div');
        filesDiv.className = 'group-files';
        let files = group.files;
        if (searchTerm) {
            files = files.filter((f: string) => f.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        for (const file of files) {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file';
            fileDiv.draggable = true;
            fileDiv.innerHTML =
                '<span title="' + escapeHtml(file) + '">' + escapeHtml(file.split(/[/\\]/).pop()) + '</span>' +
                '<span>' +
                    '<button class="icon-btn remove-btn" data-group="' + escapeHtml(group.label) + '" data-file="' + escapeHtml(file) + '" title="Remove">❌</button>' +
                '</span>';
            fileDiv.addEventListener('dragstart', (e: DragEvent) => { dragFile = { group: group.label, file }; e.dataTransfer!.setData('text/plain', file); });
            fileDiv.addEventListener('dragover', (e: DragEvent) => { e.preventDefault(); fileDiv.classList.add('drag-over'); });
            fileDiv.addEventListener('dragleave', () => { fileDiv.classList.remove('drag-over'); });
            fileDiv.addEventListener('drop', (e: DragEvent) => { e.preventDefault(); fileDiv.classList.remove('drag-over'); onDropFile(group.label, file); });
            fileDiv.addEventListener('click', (e: MouseEvent) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') vscode.postMessage({ type: 'openFile', file }); });
            filesDiv.appendChild(fileDiv);
        }
        // Add file/folder button
        const addBtn = document.createElement('button');
        addBtn.className = 'icon-btn add-btn';
        addBtn.textContent = '➕';
        addBtn.title = 'Add File/Folder';
        addBtn.dataset.label = group.label;
        filesDiv.appendChild(addBtn);
        groupDiv.appendChild(filesDiv);
        // Drag-and-drop for group
        groupDiv.addEventListener('dragover', (e: DragEvent) => { e.preventDefault(); groupDiv.classList.add('drag-over'); });
        groupDiv.addEventListener('dragleave', () => { groupDiv.classList.remove('drag-over'); });
        groupDiv.addEventListener('drop', (e: DragEvent) => { e.preventDefault(); groupDiv.classList.remove('drag-over'); onDropGroup(group.label); });
        container.appendChild(groupDiv);
    }
    // Attach event listeners for dynamic buttons
    container.querySelectorAll('.pin-btn').forEach(btn => btn.addEventListener('click', e => onPinGroup((btn as HTMLElement).dataset.label!)));
    container.querySelectorAll('.rename-btn').forEach(btn => btn.addEventListener('click', e => onRenameGroup((btn as HTMLElement).dataset.label!)));
    container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', e => onDeleteGroup((btn as HTMLElement).dataset.label!)));
    container.querySelectorAll('.sort-btn').forEach(btn => btn.addEventListener('click', e => onGroupSort((btn as HTMLElement).dataset.label!)));
    container.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', e => onRemoveFile((btn as HTMLElement).dataset.group!, (btn as HTMLElement).dataset.file!)));
    container.querySelectorAll('.add-btn').forEach(btn => btn.addEventListener('click', e => onAddToGroup((btn as HTMLElement).dataset.label!)));
}

(document.getElementById('createGroupBtn') as HTMLButtonElement).onclick = () => {
    const name = prompt('Enter new group name:');
    if (name) vscode.postMessage({ type: 'createGroup', name });
};
(document.getElementById('sortBtn') as HTMLButtonElement).onclick = () => {
    vscode.postMessage({ type: 'switchSortMode' });
};
(document.getElementById('exportBtn') as HTMLButtonElement).onclick = () => {
    vscode.postMessage({ type: 'exportGroups' });
};
(document.getElementById('importBtn') as HTMLButtonElement).onclick = () => {
    (document.getElementById('importFileInput') as HTMLInputElement).click();
};
(document.getElementById('importFileInput') as HTMLInputElement).onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files![0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        vscode.postMessage({ type: 'importGroups', data: reader.result });
    };
    reader.readAsText(file);
};
(document.getElementById('searchInput') as HTMLInputElement).oninput = (e: Event) => {
    searchTerm = (e.target as HTMLInputElement).value;
    render();
};

// @ts-ignore: 'window' is available in the webview context
window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.type === 'updateState') {
        groups = msg.groups;
        sortMode = msg.sortMode;
        render();
    }
});

function onPinGroup(label: string) {
    vscode.postMessage({ type: 'togglePinGroup', label });
}
// @ts-ignore: 'prompt' and 'confirm' are available in the webview context
function onRenameGroup(label: string) {
    const newName = prompt('Rename group:', label);
    if (newName && newName !== label) {
        vscode.postMessage({ type: 'renameGroup', oldLabel: label, newLabel: newName });
    }
}
// @ts-ignore: 'prompt' and 'confirm' are available in the webview context
function onDeleteGroup(label: string) {
    if (confirm('Delete group "' + label + '"?')) {
        vscode.postMessage({ type: 'deleteGroup', label });
    }
}
function onGroupSort(label: string) {
    vscode.postMessage({ type: 'switchGroupSortMode', label });
}
function onRemoveFile(group: string, file: string) {
    vscode.postMessage({ type: 'removeFromGroup', group, file });
}
function onAddToGroup(label: string) {
    vscode.postMessage({ type: 'addToGroup', label });
}
function onDropFile(group: string, file: string) {
    if (dragFile) {
        vscode.postMessage({ type: 'moveFile', fromGroup: dragFile.group, toGroup: group, file: dragFile.file, after: file });
        dragFile = null;
    }
}
function onDropGroup(group: string) {
    if (dragFile) {
        vscode.postMessage({ type: 'moveFile', fromGroup: dragFile.group, toGroup: group, file: dragFile.file });
        dragFile = null;
    }
}

// Initial state request
vscode.postMessage({ type: 'getState' });
})();
