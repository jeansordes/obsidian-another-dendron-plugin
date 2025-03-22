import { Plugin, TFile, ViewState, WorkspaceLeaf } from 'obsidian';
import { t } from './i18n';
import { DEFAULT_SETTINGS, FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON } from './types';
import { FileUtils } from './utils/FileUtils';
import PluginMainPanel from './views/PluginMainPanel';
export default class TreeMapperPlugin extends Plugin {
    settings: PluginSettings;
    private viewRegistered = false;
    private isInitializing = false;
    private pluginMainPanel: PluginMainPanel | null = null;

    async onload() {
        if (process.env.NODE_ENV === 'development') {
            console.clear();
        }

        await this.loadSettings();

        // Always unregister the view type first to ensure clean registration
        try {
            this.app.workspace.detachLeavesOfType(FILE_TREE_VIEW_TYPE);
        } catch (e) {
            // This is normal if it's the first load
        }

        // Register the file tree view
        this.registerView(
            FILE_TREE_VIEW_TYPE,
            (leaf) => {
                this.pluginMainPanel = new PluginMainPanel(leaf, this.settings);
                return this.pluginMainPanel;
            }
        );
        this.viewRegistered = true;

        this.addRibbonIcon(TREE_VIEW_ICON, t('ribbonTooltip'), (evt: MouseEvent) => {
            this.activateView();
        });

        this.registerCommands();

        // Use Obsidian's workspace.onLayoutReady for proper initialization
        this.app.workspace.onLayoutReady(() => {
            this.activateView();
        });
    }

    private registerCommands() {
        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'open-file-tree-view',
            name: t('commandOpenTree'),
            callback: () => {
                this.activateView();
            }
        });

        // Add a command to show the current file in the Dendron Tree View
        this.addCommand({
            id: 'show-file-in-dendron-tree',
            name: t('commandShowFile'),
            checkCallback: (checking: boolean) => {
                // Only enable the command if there's an active file
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;

                if (!checking) {
                    this.showFileInDendronTree(activeFile);
                }

                return true;
            }
        });

        // Add a command to collapse all nodes
        this.addCommand({
            id: 'collapse-all-dendron-tree',
            name: t('commandCollapseAll'),
            callback: () => {
                if (this.pluginMainPanel) {
                    this.pluginMainPanel.collapseAllNodes();
                }
            }
        });

        // Add a command to expand all nodes
        this.addCommand({
            id: 'expand-all-dendron-tree',
            name: t('commandExpandAll'),
            callback: () => {
                if (this.pluginMainPanel) {
                    this.pluginMainPanel.expandAllNodes();
                }
            }
        });

        // Add a command to create a child note to the current note
        this.addCommand({
            id: 'create-child-note',
            name: t('commandCreateChildNote'),
            checkCallback: (checking: boolean) => {
                // Only enable the command if there's an active file
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;

                if (!checking) {
                    FileUtils.createChildNote(this.app, activeFile.path);
                }

                return true;
            }
        });
    }


    async initLeaf(): Promise<WorkspaceLeaf | null> {
        // Set flag to indicate we're initializing
        this.isInitializing = true;

        try {
            // Always create the view in the left panel
            const leaf = this.app.workspace.getLeftLeaf(false);
            if (!leaf) return null;

            // Set the view state
            await leaf.setViewState({
                type: FILE_TREE_VIEW_TYPE,
                active: false // Set to false to avoid automatically focusing the view
            } as ViewState);

            return leaf;
        } finally {
            // Reset the flag
            this.isInitializing = false;
        }
    }

    async activateView() {
        this.app.workspace.onLayoutReady(async () => {
            // If the view is already open, reveal it
            const existing = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);

            if (existing.length > 0) {
                this.app.workspace.revealLeaf(existing[0]);
                return;
            }

            // Otherwise, create a new leaf in the left sidebar
            const leaf = this.app.workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: FILE_TREE_VIEW_TYPE,
                    active: true
                } as ViewState);
                this.app.workspace.revealLeaf(leaf);
            }
        });
    }

    /**
     * Show the current file in the Dendron Tree View
     */
    private async showFileInDendronTree(file: TFile): Promise<void> {
        // First, make sure the view is open
        await this.activateView();

        // Get the Dendron Tree View instance
        const leaves = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
        if (leaves.length === 0) return;

        const dendronView = leaves[0].view as PluginMainPanel;

        // Trigger file highlighting
        if (dendronView && typeof dendronView.highlightFile === 'function') {
            dendronView.highlightFile(file);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Restore expanded nodes if available
        if (this.pluginMainPanel && this.settings.expandedNodes) {
            this.pluginMainPanel.restoreExpandedNodesFromSettings(this.settings.expandedNodes);
        }
    }

    async saveSettings() {
        // Save expanded nodes state if available
        if (this.pluginMainPanel) {
            this.settings.expandedNodes = this.pluginMainPanel.getExpandedNodesForSettings();
        }

        await this.saveData(this.settings);
    }

    onunload() {
        // Save settings before unloading
        this.saveSettings();
    }
}