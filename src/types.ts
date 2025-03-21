import { TFile, TFolder } from 'obsidian';

// Define the view type for our tree view
export const FILE_TREE_VIEW_TYPE = 'tree-mapper-view';
export const TREE_VIEW_ICON = 'folder-git-2';

export interface PluginSettings {
    mySetting: string;
    expandedNodes?: Set<string> | string[] | any; // Set of paths that are expanded, may come in different formats when loaded
}

export const DEFAULT_SETTINGS: PluginSettings = {
    mySetting: 'default',
    expandedNodes: new Set()
}

export enum NodeType {
    FILE = 'file',
    FOLDER = 'folder',
    VIRTUAL = 'virtual'
}
export interface Node {
    path: string;
    nodeType: NodeType;
    obsidianResource?: TFile | TFolder;
    children: Map<string, Node>;
    isActive: boolean;
    isExpanded?: boolean;
}
