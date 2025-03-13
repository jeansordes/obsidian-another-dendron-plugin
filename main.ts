import { App, Modal, Notice, Plugin, TFile, ViewState, WorkspaceLeaf } from 'obsidian';
import { FILE_TREE_VIEW_TYPE, MyPluginSettings, DEFAULT_SETTINGS } from './src/models/types';
import DendronTreeView from './src/views/DendronTreeView';

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register the file tree view
		this.registerView(
			FILE_TREE_VIEW_TYPE,
			(leaf) => new DendronTreeView(leaf)
		);

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

		// Restore the view state when the layout is ready
		this.app.workspace.onLayoutReady(() => this.initLeaf());
	}

	async initLeaf(): Promise<void> {
		// If the view is already open, do nothing
		const leaves = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
		if (leaves.length) {
			return;
		}

		// Try to get the saved workspace data
		const savedData = await this.loadData();
		
		// Create the leaf in the saved position or default to right
		let leaf: WorkspaceLeaf | null;
		if (savedData?.position === 'left') {
			leaf = this.app.workspace.getLeftLeaf(false);
		} else {
			leaf = this.app.workspace.getRightLeaf(false);
		}

		if (!leaf) return;

		// Set the view state
		await leaf.setViewState({
			type: FILE_TREE_VIEW_TYPE,
			active: true
		} as ViewState);
	}

	async activateView() {
		// If the view is already open, reveal it
		const existing = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			
			// Check and update position immediately
			this.detectAndSavePosition();
			return;
		}

		// Try to get the saved position
		const savedData = await this.loadData();
		
		// Create the leaf in the saved position or default to right
		let leaf: WorkspaceLeaf | null;
		if (savedData?.position === 'left') {
			leaf = this.app.workspace.getLeftLeaf(false);
		} else {
			leaf = this.app.workspace.getRightLeaf(false);
		}

		if (!leaf) return;

		// Set the view state
		await leaf.setViewState({
			type: FILE_TREE_VIEW_TYPE,
			active: true
		} as ViewState);

		// Register a one-time event to detect position after the view is fully created
		setTimeout(() => {
			this.detectAndSavePosition();
			this.setupDragListeners();
		}, 500);

		// Track position changes
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				setTimeout(() => {
					this.detectAndSavePosition();
				}, 100);
			})
		);

		this.app.workspace.revealLeaf(leaf);
	}

	// Helper method to detect and save the current position
	async detectAndSavePosition() {
		const leaves = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
		if (leaves.length === 0) {
			return;
		}
		
		const leaf = leaves[0];
		
		// Get the parent element of the leaf
		const view = leaf.view as DendronTreeView;
		if (!view) {
			return;
		}
		
		const leafEl = view.containerEl;
		
		// Check if the leaf is in the left sidebar by examining its DOM position
		const leftSplit = leafEl.closest('.mod-left-split');
		
		const isInLeftSidebar = leftSplit !== null;
		
		// Get current settings
		const currentSettings = await this.loadData();
		const newPosition = isInLeftSidebar ? 'left' : 'right';
		
		// Always save the position to ensure it's updated
		currentSettings.position = newPosition;
		await this.saveData(currentSettings);
		
		// Update the settings object too
		this.settings.position = newPosition;
	}

	onunload() {
		// Unregister the view when the plugin is disabled
		this.app.workspace.detachLeavesOfType(FILE_TREE_VIEW_TYPE);

		// Disconnect the MutationObserver if it exists
		if ((this as any).observer) {
			(this as any).observer.disconnect();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Set up drag listeners to detect when the view is moved
	setupDragListeners() {
		// Find all drag handles in the app
		const dragHandles = document.querySelectorAll('.workspace-tab-header-tab-list, .workspace-tab-header, .mod-drag-handle');
		
		// Add event listeners to all drag handles
		dragHandles.forEach(handle => {
			handle.addEventListener('mouseup', () => {
				setTimeout(() => this.detectAndSavePosition(), 200);
			});
		});
		
		// Also listen for dragend events on the document
		document.addEventListener('dragend', () => {
			setTimeout(() => this.detectAndSavePosition(), 200);
		});
		
		// Listen for the end of a drag operation
		document.addEventListener('mouseup', () => {
			setTimeout(() => this.detectAndSavePosition(), 200);
		});
	}
}