import { TFile, TFolder } from 'obsidian';

// Define the view type for our file tree view
export const FILE_TREE_VIEW_TYPE = 'dendron-tree-view';
export const TREE_VIEW_ICON = 'folder-git-2';

export interface PluginSettings {
    mySetting: string;
    expandedNodes?: string[]; // Array of node paths that are expanded
}

export const DEFAULT_SETTINGS: PluginSettings = {
    mySetting: 'default',
    expandedNodes: []
}

export enum DendronNodeType {
    FILE = 'file',
    FOLDER = 'folder',
    VIRTUAL = 'virtual'
}

export interface DendronNode {
    dendronPath: string;
    filePath: string;
    folderPath: string;
    nodeType: DendronNodeType;
    obsidianResource?: TFile | TFolder;
    children: Map<string, DendronNode>;
}
