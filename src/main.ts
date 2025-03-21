import { Notice, Plugin, TFile, ViewState, WorkspaceLeaf } from 'obsidian';
import { t } from './i18n';
import { DEFAULT_SETTINGS, FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON } from './types';
import PluginMainPanel from './views/PluginMainPanel';

export default class TreeMapperPlugin extends Plugin {
	settings: PluginSettings;
	private viewRegistered = false;
	private isInitializing = false;
	private dendronView: PluginMainPanel | null = null;

	async onload() {
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
				this.dendronView = new PluginMainPanel(leaf, this.settings);
				return this.dendronView;
			}
		);
		this.viewRegistered = true;

		// Add a ribbon icon to open the file tree view
		this.addRibbonIcon(TREE_VIEW_ICON, t('ribbonTooltip'), (evt: MouseEvent) => {
			this.activateView();
		});

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
				if (this.dendronView) {
					this.dendronView.collapseAllNodes();
				}
			}
		});

		// Add a command to expand all nodes
		this.addCommand({
			id: 'expand-all-dendron-tree',
			name: t('commandExpandAll'),
			callback: () => {
				if (this.dendronView) {
					this.dendronView.expandAllNodes();
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
					this.createChildNote(activeFile);
				}
				
				return true;
			}
		});

		// Use Obsidian's workspace.onLayoutReady for proper initialization
        this.app.workspace.onLayoutReady(() => {
            this.activateView();
        });
	}

	private async checkAndInitializeView() {
		// Check for leaves with our view type
		const leaves = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
		
		// If we already have a leaf with our view type, don't create another one
		if (leaves.length > 0) {
			// Highlight the active file in the existing view
			this.highlightActiveFileInView(leaves[0]);
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
			// Highlight the active file after reregistering the view
			if (potentialDendronLeaves.length > 0) {
				this.highlightActiveFileInView(potentialDendronLeaves[0]);
			}
			return;
		}
		
		// If no existing leaves are found, create a new one
		const newLeaf = await this.initLeaf();
		if (newLeaf) {
			this.highlightActiveFileInView(newLeaf);
		}
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

	/**
	 * Highlight the active file in the specified view
	 */
	private highlightActiveFileInView(leaf: WorkspaceLeaf): void {
		// Get the active file
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;
		
		// Get the Dendron Tree View instance
		const dendronView = leaf.view as PluginMainPanel;
		
		// Trigger file highlighting
		if (dendronView && typeof dendronView.highlightFile === 'function') {
			// Use a small timeout to ensure the view is fully rendered
			setTimeout(() => {
				dendronView.highlightFile(activeFile);
			}, 100);
		}
	}

	/**
	 * Create a child note to the current file
	 */
	private async createChildNote(file: TFile): Promise<void> {
		// Generate child note path by replacing .md with .new.md
		const childPath = file.path.replace(/\.md$/, '.' + t('untitledPath') + '.md');
		
		let note = this.app.vault.getAbstractFileByPath(childPath);

		if (!note) {
			try {
				note = await this.app.vault.create(childPath, '');
				new Notice(t('noticeCreatedNote', { path: childPath }));
			} catch (error) {
				new Notice(t('noticeFailedCreateNote', { path: childPath }));
				return;
			}
		}

		if (note instanceof TFile) {
			// Open the file in a new leaf
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) {
				await leaf.openFile(note, { active: true });
				
				// Focus on the editor
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
				
				// Wait for the UI to fully render
				setTimeout(() => {
					// Method 1: Try to find the title element in the active leaf's view
					const containerEl = leaf.view?.containerEl;
					if (containerEl) {
						// First try with more specific selectors for Obsidian file title
						let titleElement = containerEl.querySelector('.view-header-title-container .view-header-title') as HTMLElement;
						
						// Fallback to less specific selectors
						if (!titleElement) {
							titleElement = containerEl.querySelector('.view-header-title') as HTMLElement;
						}
						
						if (titleElement) {
							// First focus the element
							titleElement.focus();
							
							// Try double click to enter edit mode (this is how Obsidian's UI works)
							titleElement.dispatchEvent(new MouseEvent('dblclick', {
								view: window,
								bubbles: true,
								cancelable: true
							}));
							
							// Fallback - if double-clicking doesn't work, try to select the text
							// which might trigger Obsidian's rename behavior
							const selection = window.getSelection();
							const range = document.createRange();
							range.selectNodeContents(titleElement);
							selection?.removeAllRanges();
							selection?.addRange(range);
							
							return;
						}
					}
					
					// Fallback method - show notice
					new Notice(t('noticeRenameNote'));
				}, 400);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// Restore expanded nodes if available
		if (this.dendronView && this.settings.expandedNodes) {
			this.dendronView.restoreExpandedNodesFromSettings(this.settings.expandedNodes);
		}
	}

	async saveSettings() {
		// Save expanded nodes state if available
		if (this.dendronView) {
			this.settings.expandedNodes = this.dendronView.getExpandedNodesForSettings();
		}
		
		await this.saveData(this.settings);
	}

	onunload() {
		// Save settings before unloading
		this.saveSettings();
	}
}