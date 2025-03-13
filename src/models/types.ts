import { TFile } from 'obsidian';

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

export interface DendronNode {
    name: string;
    children: Map<string, DendronNode>;
    file?: TFile;
    isRealFile: boolean;
    isRealFolder: boolean;
    folderPath: string;
}
