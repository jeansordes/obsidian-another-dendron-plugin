import { TFile, TFolder } from 'obsidian';

// Define the view type for our file tree view
export const FILE_TREE_VIEW_TYPE = 'dendron-tree-view';

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
    name: string;
    realPath: string;
    nodeType: DendronNodeType;
    obsidianResource?: TFile | TFolder;
    children: Map<string, DendronNode>;
}
