// @ts-nocheck
// Tab Groups Webview JS (TypeScript)
(function () {
    // @ts-ignore: acquireVsCodeApi is injected by VS Code webview
    var vscode = acquireVsCodeApi();
    // @ts-ignore: 'document' is available in the webview context
    var groups = [];
    var sortMode = 'Manual';
    var searchTerm = '';
    var dragFile = null;
    var dragGroup = null;
    function escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function render() {
        // @ts-ignore: 'document' is available in the webview context
        var container = document.getElementById('groupsContainer');
        container.innerHTML = '';
        var filteredGroups = groups;
        var _loop_1 = function (group) {
            var groupDiv = document.createElement('div');
            groupDiv.className = 'group';
            groupDiv.dataset.label = group.label;
            // Group header
            var header = document.createElement('div');
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
            var filesDiv = document.createElement('div');
            filesDiv.className = 'group-files';
            var files = group.files;
            if (searchTerm) {
                files = files.filter(function (f) { return f.toLowerCase().includes(searchTerm.toLowerCase()); });
            }
            var _loop_2 = function (file) {
                var fileDiv = document.createElement('div');
                fileDiv.className = 'file';
                fileDiv.draggable = true;
                fileDiv.innerHTML =
                    '<span title="' + escapeHtml(file) + '">' + escapeHtml(file.split(/[/\\]/).pop()) + '</span>' +
                        '<span>' +
                        '<button class="icon-btn remove-btn" data-group="' + escapeHtml(group.label) + '" data-file="' + escapeHtml(file) + '" title="Remove">❌</button>' +
                        '</span>';
                fileDiv.addEventListener('dragstart', function (e) { dragFile = { group: group.label, file: file }; e.dataTransfer.setData('text/plain', file); });
                fileDiv.addEventListener('dragover', function (e) { e.preventDefault(); fileDiv.classList.add('drag-over'); });
                fileDiv.addEventListener('dragleave', function () { fileDiv.classList.remove('drag-over'); });
                fileDiv.addEventListener('drop', function (e) { e.preventDefault(); fileDiv.classList.remove('drag-over'); onDropFile(group.label, file); });
                fileDiv.addEventListener('click', function (e) { if (e.target.tagName !== 'BUTTON')
                    vscode.postMessage({ type: 'openFile', file: file }); });
                filesDiv.appendChild(fileDiv);
            };
            for (var _a = 0, files_1 = files; _a < files_1.length; _a++) {
                var file = files_1[_a];
                _loop_2(file);
            }
            // Add file/folder button
            var addBtn = document.createElement('button');
            addBtn.className = 'icon-btn add-btn';
            addBtn.textContent = '➕';
            addBtn.title = 'Add File/Folder';
            addBtn.dataset.label = group.label;
            filesDiv.appendChild(addBtn);
            groupDiv.appendChild(filesDiv);
            // Drag-and-drop for group
            groupDiv.addEventListener('dragover', function (e) { e.preventDefault(); groupDiv.classList.add('drag-over'); });
            groupDiv.addEventListener('dragleave', function () { groupDiv.classList.remove('drag-over'); });
            groupDiv.addEventListener('drop', function (e) { e.preventDefault(); groupDiv.classList.remove('drag-over'); onDropGroup(group.label); });
            container.appendChild(groupDiv);
        };
        for (var _i = 0, filteredGroups_1 = filteredGroups; _i < filteredGroups_1.length; _i++) {
            var group = filteredGroups_1[_i];
            _loop_1(group);
        }
        // Attach event listeners for dynamic buttons
        container.querySelectorAll('.pin-btn').forEach(function (btn) { return btn.addEventListener('click', function (e) { return onPinGroup(btn.dataset.label); }); });
        container.querySelectorAll('.rename-btn').forEach(function (btn) { return btn.addEventListener('click', function (e) { return onRenameGroup(btn.dataset.label); }); });
        container.querySelectorAll('.delete-btn').forEach(function (btn) { return btn.addEventListener('click', function (e) { return onDeleteGroup(btn.dataset.label); }); });
        container.querySelectorAll('.sort-btn').forEach(function (btn) { return btn.addEventListener('click', function (e) { return onGroupSort(btn.dataset.label); }); });
        container.querySelectorAll('.remove-btn').forEach(function (btn) { return btn.addEventListener('click', function (e) { return onRemoveFile(btn.dataset.group, btn.dataset.file); }); });
        container.querySelectorAll('.add-btn').forEach(function (btn) { return btn.addEventListener('click', function (e) { return onAddToGroup(btn.dataset.label); }); });
    }
    document.getElementById('createGroupBtn').onclick = function () {
        var name = prompt('Enter new group name:');
        if (name)
            vscode.postMessage({ type: 'createGroup', name: name });
    };
    document.getElementById('sortBtn').onclick = function () {
        vscode.postMessage({ type: 'switchSortMode' });
    };
    document.getElementById('exportBtn').onclick = function () {
        vscode.postMessage({ type: 'exportGroups' });
    };
    document.getElementById('importBtn').onclick = function () {
        document.getElementById('importFileInput').click();
    };
    document.getElementById('importFileInput').onchange = function (e) {
        var file = e.target.files[0];
        if (!file)
            return;
        var reader = new FileReader();
        reader.onload = function () {
            vscode.postMessage({ type: 'importGroups', data: reader.result });
        };
        reader.readAsText(file);
    };
    document.getElementById('searchInput').oninput = function (e) {
        searchTerm = e.target.value;
        render();
    };
    // @ts-ignore: 'window' is available in the webview context
    window.addEventListener('message', function (event) {
        var msg = event.data;
        if (msg.type === 'updateState') {
            groups = msg.groups;
            sortMode = msg.sortMode;
            render();
        }
    });
    function onPinGroup(label) {
        vscode.postMessage({ type: 'togglePinGroup', label: label });
    }
    // @ts-ignore: 'prompt' and 'confirm' are available in the webview context
    function onRenameGroup(label) {
        var newName = prompt('Rename group:', label);
        if (newName && newName !== label) {
            vscode.postMessage({ type: 'renameGroup', oldLabel: label, newLabel: newName });
        }
    }
    // @ts-ignore: 'prompt' and 'confirm' are available in the webview context
    function onDeleteGroup(label) {
        if (confirm('Delete group "' + label + '"?')) {
            vscode.postMessage({ type: 'deleteGroup', label: label });
        }
    }
    function onGroupSort(label) {
        vscode.postMessage({ type: 'switchGroupSortMode', label: label });
    }
    function onRemoveFile(group, file) {
        vscode.postMessage({ type: 'removeFromGroup', group: group, file: file });
    }
    function onAddToGroup(label) {
        vscode.postMessage({ type: 'addToGroup', label: label });
    }
    function onDropFile(group, file) {
        if (dragFile) {
            vscode.postMessage({ type: 'moveFile', fromGroup: dragFile.group, toGroup: group, file: dragFile.file, after: file });
            dragFile = null;
        }
    }
    function onDropGroup(group) {
        if (dragFile) {
            vscode.postMessage({ type: 'moveFile', fromGroup: dragFile.group, toGroup: group, file: dragFile.file });
            dragFile = null;
        }
    }
    // Initial state request
    vscode.postMessage({ type: 'getState' });
})();
