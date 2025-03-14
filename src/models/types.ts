import { TFile, TFolder } from 'obsidian';

// Define the view type for our file tree view
export const FILE_TREE_VIEW_TYPE = 'dendron-tree-view';

export interface PluginSettings {
    mySetting: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    mySetting: 'default'
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
