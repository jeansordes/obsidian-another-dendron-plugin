import { TFile, TFolder } from 'obsidian';

// Define the view type for our tree view
export const FILE_TREE_VIEW_TYPE = 'tree-mapper-view';
export const TREE_VIEW_ICON = 'folder-git-2';

export interface PluginSettings {
    mySetting: string;
    expandedNodes?: string[]; // Array of node paths that are expanded
}

export const DEFAULT_SETTINGS: PluginSettings = {
    mySetting: 'default',
    expandedNodes: []
}

export enum TreeNodeType {
    FILE = 'file',
    FOLDER = 'folder',
    VIRTUAL = 'virtual'
}

export interface TreeNode {
    path: string;
    nodeType: TreeNodeType;
    obsidianResource?: TFile | TFolder;
    children: Map<string, TreeNode>;
}
