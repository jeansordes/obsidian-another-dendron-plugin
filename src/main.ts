import { Plugin, ViewState, WorkspaceLeaf } from 'obsidian';
import { t } from './i18n';
import { TreeState } from './store/TreeState';
import { DEFAULT_SETTINGS, FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON } from './types';
import { Csl } from './utils/ConsoleUtils';
import { FileUtils } from './utils/FileUtils';
import { ViewUtils } from './utils/ViewUtils';
import PluginMainPanel from './views/PluginMainPanel';

export default class TreeMapperPlugin extends Plugin {
    private viewRegistered = false;
    private isInitializing = false;
    private dendronView: PluginMainPanel | null = null;
    private fileUtils: FileUtils;
    private settings!: PluginSettings;
    private viewUtils!: ViewUtils;
    private treeStateUtils: TreeState;

    constructor(app: any, manifest: any) {
        super(app, manifest);
        this.fileUtils = new FileUtils(this.app);
        this.treeStateUtils = TreeState.getInstance(this.app);
    }

    async onload() {
        Csl.clear();

        // Reset the stylesheet of the plugin
        const tmStyles = document.getElementById('tm_styles');
        if (tmStyles) document.head.removeChild(tmStyles);
        document.head.appendChild(
            createEl('link', {
                href: this.manifest.dir + '/styles.css',
                type: 'text/css',
                attr: { id: 'tm_styles' }
            })
        );

        await this.loadSettings();
        // Ensure expandedNodes is an iterable object before creating a Set
        const expandedNodes = this.settings.expandedNodes || [];
        
        // Set up callback to save settings when tree state changes
        this.treeStateUtils.setOnStateChangeCallback(() => {
            this.saveSettings();
        });
        
        this.viewUtils = new ViewUtils(this.app, this.treeStateUtils);
        await this._registerView();

        // Add a ribbon icon to open the file tree view
        this.addRibbonIcon(TREE_VIEW_ICON, t('ribbonTooltip'), (evt: MouseEvent) => {
            this.activateView();
        });

        await this.registerCommands();

        // Use Obsidian's workspace.onLayoutReady for proper initialization
        this.app.workspace.onLayoutReady(() => {
            this.activateView();
        });
    }

    async _registerView(): Promise<void> {
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
                this.dendronView = new PluginMainPanel(leaf, this.settings);
                return this.dendronView;
            }
        );
        this.viewRegistered = true;
    }

    async registerCommands(): Promise<void> {
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
                    // First, make sure the view is open
                    (async () => {
                        await this.activateView();
                        this.viewUtils.highlightFile(activeFile);
                    })();
                }

                return true;
            }
        });

        // Add a command to collapse all nodes
        this.addCommand({
            id: 'collapse-all-dendron-tree',
            name: t('commandCollapseAll'),
            callback: () => {
                if (this.dendronView) {
                    this.viewUtils.collapseAllNodes();
                }
            }
        });

        // Add a command to expand all nodes
        this.addCommand({
            id: 'expand-all-dendron-tree',
            name: t('commandExpandAll'),
            callback: () => {
                if (this.dendronView) {
                    this.viewUtils.expandAllNodes();
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
                    this.fileUtils.createChildNote(activeFile.path);
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
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Convert expandedNodes to a Set if it exists
        if (this.settings.expandedNodes) {
            // If it's not already a Set, convert it
            if (!(this.settings.expandedNodes instanceof Set)) {
                try {
                    this.settings.expandedNodes = new Set(Array.from(this.settings.expandedNodes || []));
                } catch (e) {
                    // If conversion fails, reset to empty Set
                    console.warn('Failed to convert expandedNodes to Set, resetting to empty Set');
                    this.settings.expandedNodes = new Set();
                }
            }
            
            // Restore expanded nodes if available
            if (this.treeStateUtils) {
                this.treeStateUtils.restoreExpandedNodesFromSettings(this.settings.expandedNodes);
            }
        } else {
            // Initialize with empty Set if undefined
            this.settings.expandedNodes = new Set();
        }
    }

    async saveSettings() {
        // Save expanded nodes state if available
        if (this.treeStateUtils) {
            const expandedNodesSet = this.treeStateUtils.getExpandedNodesForSettings();
            // Convert Set to Array for JSON serialization
            this.settings.expandedNodes = Array.from(expandedNodesSet);
        }

        await this.saveData(this.settings);
    }

    onunload() {
        // Save settings before unloading
        this.saveSettings();
    }
}