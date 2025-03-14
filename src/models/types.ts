import { TFile, TFolder } from 'obsidian';

// Define the view type for our file tree view
export const FILE_TREE_VIEW_TYPE = 'dendron-tree-view';

export interface MyPluginSettings {
    mySetting: string;
    position: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    mySetting: 'default',
    position: 'left'
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
