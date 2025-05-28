"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
var vscode = require("vscode");
var SortMode;
(function (SortMode) {
    SortMode["MANUAL"] = "Manual";
    SortMode["NAME_ASC"] = "Name Ascending";
    SortMode["NAME_DESC"] = "Name Descending";
})(SortMode || (SortMode = {}));
var TAB_GROUPS_KEY = 'tabGroups';
var SORT_MODE_KEY = 'tabGroupSortMode';
function loadGroups(context) {
    return context.workspaceState.get(TAB_GROUPS_KEY) || [];
}
function saveGroups(context, groups) {
    context.workspaceState.update(TAB_GROUPS_KEY, groups);
}
function loadSortMode(context) {
    return (context.workspaceState.get(SORT_MODE_KEY) || SortMode.MANUAL);
}
function saveSortMode(context, mode) {
    context.workspaceState.update(SORT_MODE_KEY, mode);
}
// Remove TreeView and related variables, as migration to Webview is complete
// let treeView: vscode.TreeView<TreeItem> | undefined;
// let treeDataProvider: TabGroupTreeProvider | undefined;
// let expandedGroups = new Set<string>();
// let searchTerm: string | undefined = undefined;
// let isSearchActive: boolean = false;
// --- Webview View Provider for Tab Groups ---
var TabGroupsWebviewProvider = /** @class */ (function () {
    function TabGroupsWebviewProvider(context) {
        this._searchTerm = undefined;
        this._context = context;
        this._groups = loadGroups(context);
        this._sortMode = loadSortMode(context);
    }
    TabGroupsWebviewProvider.prototype.resolveWebviewView = function (webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'media')]
        };
        this._setHtmlForWebview(webviewView.webview);
        this._setWebviewMessageListener(webviewView.webview);
    };
    TabGroupsWebviewProvider.prototype._setHtmlForWebview = function (webview) {
        // Load HTML from external file and inject CSS/JS as webview URIs
        var htmlPath = vscode.Uri.joinPath(this._context.extensionUri, 'src', 'tabGroupsWebview.html');
        var cssPath = vscode.Uri.joinPath(this._context.extensionUri, 'src', 'tabGroupsWebview.css');
        var jsPath = vscode.Uri.joinPath(this._context.extensionUri, 'src', 'tabGroupsWebview.js');
        var html = require('fs').readFileSync(htmlPath.fsPath, 'utf8');
        var cssUri = webview.asWebviewUri(cssPath);
        var jsUri = webview.asWebviewUri(jsPath);
        // Replace relative links with webview URIs
        webview.html = html
            .replace('./tabGroupsWebview.css', cssUri.toString())
            .replace('./tabGroupsWebview.js', jsUri.toString());
    };
    TabGroupsWebviewProvider.prototype._setWebviewMessageListener = function (webview) {
        var _this = this;
        webview.onDidReceiveMessage(function (msg) { return __awaiter(_this, void 0, void 0, function () {
            var _a, group, group, options, idx, group, options, idx, group, uris, group, _i, uris_1, uri, stat, files, _b, files_1, f, fromGroup_1, toGroup_1, file_1, after_1, src, dst, idx, workspaceFolder, exportGroups, json, uri, groupsFromFile, workspaceFolder_1, resolvedGroups, mergedGroups, _loop_1, _c, resolvedGroups_1, importedGroup, importLabels_1;
            var _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _a = msg.type;
                        switch (_a) {
                            case 'getState': return [3 /*break*/, 1];
                            case 'createGroup': return [3 /*break*/, 2];
                            case 'renameGroup': return [3 /*break*/, 3];
                            case 'deleteGroup': return [3 /*break*/, 4];
                            case 'togglePinGroup': return [3 /*break*/, 5];
                            case 'switchSortMode': return [3 /*break*/, 6];
                            case 'switchGroupSortMode': return [3 /*break*/, 7];
                            case 'removeFromGroup': return [3 /*break*/, 8];
                            case 'addToGroup': return [3 /*break*/, 9];
                            case 'moveFile': return [3 /*break*/, 17];
                            case 'openFile': return [3 /*break*/, 18];
                            case 'exportGroups': return [3 /*break*/, 19];
                            case 'importGroups': return [3 /*break*/, 22];
                        }
                        return [3 /*break*/, 23];
                    case 1:
                        this._postState();
                        return [3 /*break*/, 23];
                    case 2:
                        if (!msg.name || this._groups.some(function (g) { return g.label === msg.name; }))
                            return [2 /*return*/];
                        this._groups.push({ label: msg.name, files: [] });
                        saveGroups(this._context, this._groups);
                        this._postState();
                        return [3 /*break*/, 23];
                    case 3:
                        {
                            group = this._groups.find(function (g) { return g.label === msg.oldLabel; });
                            if (group && !this._groups.some(function (g) { return g.label === msg.newLabel; })) {
                                group.label = msg.newLabel;
                                saveGroups(this._context, this._groups);
                                this._postState();
                            }
                        }
                        return [3 /*break*/, 23];
                    case 4:
                        this._groups = this._groups.filter(function (g) { return g.label !== msg.label; });
                        saveGroups(this._context, this._groups);
                        this._postState();
                        return [3 /*break*/, 23];
                    case 5:
                        {
                            group = this._groups.find(function (g) { return g.label === msg.label; });
                            if (group) {
                                group.pinned = !group.pinned;
                                saveGroups(this._context, this._groups);
                                this._postState();
                            }
                        }
                        return [3 /*break*/, 23];
                    case 6:
                        {
                            options = [SortMode.MANUAL, SortMode.NAME_ASC, SortMode.NAME_DESC];
                            idx = options.indexOf(this._sortMode);
                            this._sortMode = options[(idx + 1) % options.length];
                            saveSortMode(this._context, this._sortMode);
                            this._postState();
                        }
                        return [3 /*break*/, 23];
                    case 7:
                        {
                            group = this._groups.find(function (g) { return g.label === msg.label; });
                            if (group) {
                                options = [SortMode.MANUAL, SortMode.NAME_ASC, SortMode.NAME_DESC, undefined];
                                idx = options.indexOf(group.sortMode);
                                group.sortMode = options[(idx + 1) % options.length];
                                saveGroups(this._context, this._groups);
                                this._postState();
                            }
                        }
                        return [3 /*break*/, 23];
                    case 8:
                        {
                            group = this._groups.find(function (g) { return g.label === msg.group; });
                            if (group) {
                                group.files = group.files.filter(function (f) { return f !== msg.file; });
                                saveGroups(this._context, this._groups);
                                this._postState();
                            }
                        }
                        return [3 /*break*/, 23];
                    case 9: return [4 /*yield*/, vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: true, canSelectMany: true })];
                    case 10:
                        uris = _h.sent();
                        if (!uris)
                            return [2 /*return*/];
                        group = this._groups.find(function (g) { return g.label === msg.label; });
                        if (!group)
                            return [2 /*return*/];
                        _i = 0, uris_1 = uris;
                        _h.label = 11;
                    case 11:
                        if (!(_i < uris_1.length)) return [3 /*break*/, 16];
                        uri = uris_1[_i];
                        return [4 /*yield*/, vscode.workspace.fs.stat(uri)];
                    case 12:
                        stat = _h.sent();
                        if (!(stat.type === vscode.FileType.Directory)) return [3 /*break*/, 14];
                        return [4 /*yield*/, getAllFilesInFolder(uri)];
                    case 13:
                        files = _h.sent();
                        for (_b = 0, files_1 = files; _b < files_1.length; _b++) {
                            f = files_1[_b];
                            if (!group.files.includes(f))
                                group.files.push(f);
                        }
                        return [3 /*break*/, 15];
                    case 14:
                        if (!group.files.includes(uri.fsPath))
                            group.files.push(uri.fsPath);
                        _h.label = 15;
                    case 15:
                        _i++;
                        return [3 /*break*/, 11];
                    case 16:
                        saveGroups(this._context, this._groups);
                        this._postState();
                        return [3 /*break*/, 23];
                    case 17:
                        {
                            fromGroup_1 = msg.fromGroup, toGroup_1 = msg.toGroup, file_1 = msg.file, after_1 = msg.after;
                            src = this._groups.find(function (g) { return g.label === fromGroup_1; });
                            dst = this._groups.find(function (g) { return g.label === toGroup_1; });
                            if (!src || !dst)
                                return [2 /*return*/];
                            src.files = src.files.filter(function (f) { return f !== file_1; });
                            if (after_1) {
                                idx = dst.files.indexOf(after_1);
                                dst.files.splice(idx + 1, 0, file_1);
                            }
                            else {
                                dst.files.push(file_1);
                            }
                            saveGroups(this._context, this._groups);
                            this._postState();
                        }
                        return [3 /*break*/, 23];
                    case 18:
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(msg.file));
                        return [3 /*break*/, 23];
                    case 19:
                        workspaceFolder = ((_e = (_d = vscode.workspace.workspaceFolders) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.uri.fsPath) || '';
                        exportGroups = this._groups.map(function (g) { return (__assign(__assign({}, g), { files: g.files.map(function (f) { return vscode.workspace.asRelativePath(f, false); }) })); });
                        json = JSON.stringify(exportGroups, null, 2);
                        return [4 /*yield*/, vscode.window.showSaveDialog({
                                saveLabel: 'Export Tab Groups',
                                filters: { 'JSON': ['json'] },
                                defaultUri: vscode.Uri.file('tab-groups.json')
                            })];
                    case 20:
                        uri = _h.sent();
                        if (!uri)
                            return [2 /*return*/];
                        return [4 /*yield*/, vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'))];
                    case 21:
                        _h.sent();
                        vscode.window.showInformationMessage('Tab groups exported successfully.');
                        return [3 /*break*/, 23];
                    case 22:
                        {
                            try {
                                groupsFromFile = JSON.parse(msg.data);
                                if (!Array.isArray(groupsFromFile))
                                    throw new Error('Invalid format');
                                workspaceFolder_1 = ((_g = (_f = vscode.workspace.workspaceFolders) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.uri.fsPath) || '';
                                resolvedGroups = groupsFromFile.map(function (g) { return (__assign(__assign({}, g), { files: g.files.map(function (f) { return vscode.Uri.file(workspaceFolder_1 ? require('path').join(workspaceFolder_1, f) : f).fsPath; }) })); });
                                mergedGroups = __spreadArray([], this._groups, true);
                                _loop_1 = function (importedGroup) {
                                    var idx = mergedGroups.findIndex(function (g) { return g.label === importedGroup.label; });
                                    if (idx !== -1) {
                                        for (var _j = 0, _k = importedGroup.files; _j < _k.length; _j++) {
                                            var file = _k[_j];
                                            if (!mergedGroups[idx].files.includes(file)) {
                                                mergedGroups[idx].files.push(file);
                                            }
                                        }
                                    }
                                    else {
                                        mergedGroups.push(importedGroup);
                                    }
                                };
                                for (_c = 0, resolvedGroups_1 = resolvedGroups; _c < resolvedGroups_1.length; _c++) {
                                    importedGroup = resolvedGroups_1[_c];
                                    _loop_1(importedGroup);
                                }
                                importLabels_1 = resolvedGroups.map(function (g) { return g.label; });
                                mergedGroups.sort(function (a, b) {
                                    var aIdx = importLabels_1.indexOf(a.label);
                                    var bIdx = importLabels_1.indexOf(b.label);
                                    if (aIdx === -1 && bIdx === -1)
                                        return 0;
                                    if (aIdx === -1)
                                        return 1;
                                    if (bIdx === -1)
                                        return -1;
                                    return aIdx - bIdx;
                                });
                                this._groups = mergedGroups;
                                saveGroups(this._context, this._groups);
                                this._postState();
                                vscode.window.showInformationMessage('Tab groups imported and merged successfully.');
                            }
                            catch (e) {
                                vscode.window.showErrorMessage('Failed to import tab groups: ' + (e instanceof Error ? e.message : e));
                            }
                        }
                        return [3 /*break*/, 23];
                    case 23: return [2 /*return*/];
                }
            });
        }); });
    };
    TabGroupsWebviewProvider.prototype._postState = function () {
        if (this._view) {
            // Only show file names in UI, not full paths
            var groupsForUI = this._groups.map(function (g) { return (__assign(__assign({}, g), { files: g.files.map(function (f) { return vscode.workspace.asRelativePath(f, false); }) })); });
            this._view.webview.postMessage({
                type: 'updateState',
                groups: groupsForUI,
                sortMode: this._sortMode
            });
        }
    };
    TabGroupsWebviewProvider.viewType = 'tabGroupsView';
    return TabGroupsWebviewProvider;
}());
// Helper for recursive folder file collection
function getAllFilesInFolder(folderUri) {
    return __awaiter(this, void 0, void 0, function () {
        var files, entries, _i, entries_1, _a, name_1, type, entryUri, subFiles;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    files = [];
                    return [4 /*yield*/, vscode.workspace.fs.readDirectory(folderUri)];
                case 1:
                    entries = _b.sent();
                    _i = 0, entries_1 = entries;
                    _b.label = 2;
                case 2:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 6];
                    _a = entries_1[_i], name_1 = _a[0], type = _a[1];
                    entryUri = vscode.Uri.joinPath(folderUri, name_1);
                    if (!(type === vscode.FileType.File)) return [3 /*break*/, 3];
                    files.push(entryUri.fsPath);
                    return [3 /*break*/, 5];
                case 3:
                    if (!(type === vscode.FileType.Directory)) return [3 /*break*/, 5];
                    return [4 /*yield*/, getAllFilesInFolder(entryUri)];
                case 4:
                    subFiles = _b.sent();
                    files = files.concat(subFiles);
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [2 /*return*/, files];
            }
        });
    });
}
// --- Extension Activation (Webview Only) ---
function activate(context) {
    // Register the webview view provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(TabGroupsWebviewProvider.viewType, new TabGroupsWebviewProvider(context)));
}
