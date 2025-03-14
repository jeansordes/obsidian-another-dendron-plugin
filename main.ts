import { App, Modal, Notice, Plugin, TFile, ViewState, WorkspaceLeaf } from 'obsidian';
import { FILE_TREE_VIEW_TYPE, PluginSettings, DEFAULT_SETTINGS } from './src/models/types';
import DendronTreeView from './src/views/DendronTreeView';

export default class MyPlugin extends Plugin {
	settings: PluginSettings;
	private viewRegistered = false;
	private isInitializing = false;

	async onload() {
		await this.loadSettings();

		// Always unregister the view type first to ensure clean registration
		try {
			(this.app as any).viewRegistry.unregisterView(FILE_TREE_VIEW_TYPE);
		} catch (e) {
			// This is normal if it's the first load
		}

		// Register the file tree view
		this.registerView(
			FILE_TREE_VIEW_TYPE,
			(leaf) => new DendronTreeView(leaf)
		);
		this.viewRegistered = true;

		// Add a ribbon icon to open the file tree view
		this.addRibbonIcon('structured-activity-bar', 'Open Dendron Tree', (evt: MouseEvent) => {
			this.activateView();
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-file-tree-view',
			name: 'Open File Tree View',
			callback: () => {
				this.activateView();
			}
		});

		// Use a timeout to ensure we don't initialize too early
        // and create a new leaf before checking for existing leaves
        // resulting in a race condition, with 2 leaves created in the end
		setTimeout(() => {
			this.app.workspace.onLayoutReady(() => {
				this.checkAndInitializeView();
			});
		}, 100);
	}

	private async checkAndInitializeView() {
		// Check for leaves with our view type
		const leaves = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
		
		// If we already have a leaf with our view type, don't create another one
		if (leaves.length > 0) {
			return;
		}
		
		// Check for any leaves that might have our view type but are not properly initialized
		const allLeaves = this.app.workspace.getLeavesOfType('');
		
		// Find any leaves that might be our view but not properly registered
		const potentialDendronLeaves = allLeaves.filter(leaf => 
			leaf.view?.containerEl?.querySelector('.dendron-tree-container') !== null
		);
		
		if (potentialDendronLeaves.length > 0) {
			for (const leaf of potentialDendronLeaves) {
				await leaf.setViewState({
					type: FILE_TREE_VIEW_TYPE,
					active: false
				} as ViewState);
			}
			return;
		}
		
		// If no existing leaves are found, create a new one
		await this.initLeaf();
	}

	async initLeaf(): Promise<void> {
		// Set flag to indicate we're initializing
		this.isInitializing = true;
		
		try {
			// Always create the view in the left panel
			const leaf = this.app.workspace.getLeftLeaf(false);
			if (!leaf) return;
			
			// Set the view state
			await leaf.setViewState({
				type: FILE_TREE_VIEW_TYPE,
				active: false // Set to false to avoid automatically focusing the view
			} as ViewState);
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		// Don't detach leaves to keep the view open when the plugin is unloaded
	}
}