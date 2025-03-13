import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFolder, TFile, ItemView, WorkspaceLeaf, ViewState } from 'obsidian';

// Define the view type for our file tree view
const FILE_TREE_VIEW_TYPE = 'dendron-tree-view';

interface MyPluginSettings {
	mySetting: string;
	position: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	position: 'left'
}

interface DendronNode {
	name: string;
	children: Map<string, DendronNode>;
	file?: TFile;
	isFile: boolean;
	folderPath: string;
}

// Dendron Tree View class
class DendronTreeView extends ItemView {
	private lastBuiltTree: DendronNode | null = null;
	private container: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return FILE_TREE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Dendron Tree';
	}

	getIcon(): string {
		return 'folder';
	}

	// Add serialization methods
	async setState(state: any, result: any) {
		if (state.dimensions?.width) {
			(this.leaf as any).dimension = state.dimensions;
		}
		if (state.position) {
			(this.leaf as any).position = state.position;
		}
		await super.setState(state, result);
	}

	getState(): any {
		const state = super.getState();
		state.dimensions = (this.leaf as any).dimension;
		state.position = (this.leaf as any).position;
		return state;
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		
		// Create a container for the dendron tree
		const treeContainer = container.createEl('div', { cls: 'dendron-tree-container' });
		this.container = treeContainer;

		// Set up a MutationObserver to detect when the view is moved
		this.setupMutationObserver();

		// Save state when the leaf is resized or moved
		this.registerEvent(
			this.app.workspace.on('resize', () => {
				(this.app.workspace as any).requestSaveLayout();
				
				// Get the plugin instance
				const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
				if (plugin) {
					setTimeout(() => plugin.detectAndSavePosition(), 100);
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// Just save the layout, position tracking is handled in the plugin class
				(this.app.workspace as any).requestSaveLayout();
				
				// Get the plugin instance
				const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
				if (plugin) {
					setTimeout(() => plugin.detectAndSavePosition(), 100);
				}
			})
		);
		
		// Additional events that might trigger when view is moved
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				// Get the plugin instance
				const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
				if (plugin) {
					setTimeout(() => plugin.detectAndSavePosition(), 100);
				}
			})
		);
		
		// Build the dendron tree
		await this.buildDendronTree(treeContainer);

		// Register event handlers for file changes
		this.registerEvent(
			this.app.vault.on('create', () => this.refresh())
		);
		this.registerEvent(
			this.app.vault.on('modify', () => this.refresh())
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.refresh())
		);
		this.registerEvent(
			this.app.vault.on('rename', () => this.refresh())
		);
	}

	async refresh() {
		if (this.container) {
			this.container.empty();
			await this.buildDendronTree(this.container);
		}
	}

	createDendronNode(): DendronNode {
		return {
			name: '',
			children: new Map<string, DendronNode>(),
			isFile: false,
			folderPath: ''
		};
	}

	buildDendronStructure(files: TFile[]): DendronNode {
		const root = this.createDendronNode();
		const processedPaths = new Set<string>();
		
		// First pass: create the structure and store file references
		for (const file of files) {
			const parts = file.basename.split('.');
			let current = root;
			let currentPath = '';
			
			// Process all possible parent paths first
			for (let i = 0; i < parts.length - 1; i++) {
				const part = parts[i];
				currentPath = currentPath ? currentPath + '.' + part : part;
				
				if (!current.children.has(currentPath)) {
					current.children.set(currentPath, {
						name: currentPath,
						children: new Map<string, DendronNode>(),
						isFile: false,
						folderPath: file.parent ? file.parent.path : ''
					});
				}
				current = current.children.get(currentPath)!;
				processedPaths.add(currentPath);
			}

			// Process the leaf (file) node
			const leafName = parts[parts.length - 1];
			currentPath = currentPath ? currentPath + '.' + leafName : leafName;
			
			if (!processedPaths.has(currentPath)) {
				current.children.set(currentPath, {
					name: currentPath,
					children: new Map<string, DendronNode>(),
					isFile: true,
					file: file,
					folderPath: file.parent ? file.parent.path : ''
				});
				processedPaths.add(currentPath);
			}
		}
		
		// Second pass: propagate folder paths to nodes that might not have files
		this.propagateFolderPaths(root);
		
		return root;
	}
	
	// Helper method to propagate folder paths from children to parents
	private propagateFolderPaths(node: DendronNode) {
		// If this node already has a folder path, no need to propagate
		if (node.folderPath) {
			// Recursively process children
			for (const [_, childNode] of node.children) {
				this.propagateFolderPaths(childNode);
			}
			return;
		}
		
		// Try to get folder path from children
		for (const [_, childNode] of node.children) {
			if (childNode.folderPath) {
				node.folderPath = childNode.folderPath;
				break;
			}
		}
		
		// Recursively process children
		for (const [_, childNode] of node.children) {
			this.propagateFolderPaths(childNode);
		}
	}

	// Updated helper method to use the stored folder path
	private findParentFolder(node: DendronNode): string {
		// Simply return the stored folder path
		return node.folderPath;
	}

	async buildDendronTree(container: HTMLElement) {
		// Get all markdown files
		const files = this.app.vault.getMarkdownFiles();
		
		// Build the dendron structure
		const root = this.buildDendronStructure(files);
		this.lastBuiltTree = root;
		
		// Create the tree view
		const rootList = container.createEl('ul', { cls: 'dendron-tree-list' });
		this.renderDendronNode(root, rootList, '');
	}

	renderDendronNode(node: DendronNode, parentEl: HTMLElement, prefix: string) {
		// Sort children by name
		const sortedChildren = Array.from(node.children.entries())
			.sort(([aKey], [bKey]) => aKey.localeCompare(bKey));

		sortedChildren.forEach(([name, childNode], index) => {
			const item = parentEl.createEl('div', { cls: 'tree-item' });
			
			const itemSelf = item.createEl('div', { 
				cls: 'tree-item-self' + (childNode.children.size > 0 ? ' mod-collapsible' : '')
			});

			// Create a container for the toggle button and name
			const contentWrapper = itemSelf.createEl('div', { cls: 'tree-item-content' });

			// Add toggle button if has children
			if (childNode.children.size > 0) {
				const toggleButton = contentWrapper.createEl('div', { cls: 'tree-item-icon collapse-icon is-clickable' });
				toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;
				
				// Handle toggle button click
				toggleButton.addEventListener('click', (event) => {
					event.stopPropagation();
					item.toggleClass('is-collapsed', !item.hasClass('is-collapsed'));
					const triangle = toggleButton.querySelector('.right-triangle');
					if (triangle) {
						triangle.classList.toggle('is-collapsed');
					}
				});
			} else {
				// Add a spacer div to maintain alignment
				contentWrapper.createEl('div', { cls: 'tree-item-icon-spacer' });
			}

			// Check if a folder note exists for folders
			let folderNoteExists = false;
			if (childNode.children.size > 0) {
				const folderNotePath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
				const folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);
				folderNoteExists = folderNote instanceof TFile;
			}

			// Display name without the path
			const displayName = name.split('.').pop() || name;
			const innerDiv = contentWrapper.createEl('div', { 
				cls: 'tree-item-inner' + (!childNode.file && childNode.isFile ? ' mod-create-new' : 
					(childNode.file || folderNoteExists ? ' is-clickable' : '')),
				text: displayName
			});

			// Add a "+" button for non-existent files or folders without folder notes
			if ((!childNode.file && childNode.isFile) || (childNode.children.size > 0 && !folderNoteExists)) {
				const createButton = itemSelf.createEl('div', { 
					cls: 'tree-item-create-button is-clickable',
					attr: { title: childNode.children.size > 0 ? 'Create folder note' : 'Create file' }
				});
				createButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 5v14M5 12h14"></path></svg>`;
				
				// Handle create button click
				createButton.addEventListener('click', async (event) => {
					event.stopPropagation();
					
					// Handle folder note creation
					if (childNode.children.size > 0) {
						const folderNotePath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
						let folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);
						
						if (!folderNote) {
							try {
								folderNote = await this.app.vault.create(folderNotePath, '');
								new Notice('Created folder note: ' + folderNotePath);
							} catch (error) {
								console.error('Failed to create folder note:', error);
								new Notice('Failed to create folder note: ' + folderNotePath);
							}
						}

						if (folderNote instanceof TFile) {
							const leaf = this.app.workspace.getLeaf(false);
							if (leaf) {
								await leaf.openFile(folderNote);
							}
						}
					}
					
					// Handle file creation for non-existent files
					if (childNode.isFile && !childNode.file) {
						try {
							// Use the stored folder path for file creation
							const fullPath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
							const file = await this.app.vault.create(fullPath, '');
							new Notice('Created file: ' + fullPath);
							const leaf = this.app.workspace.getLeaf(false);
							if (leaf) {
								await leaf.openFile(file);
							}
						} catch (error) {
							console.error('Failed to create file:', error);
							new Notice('Failed to create file: ' + name + '.md');
						}
					}
				});
			}

			if (!childNode.isFile && childNode.children.size === 0) {
				itemSelf.createEl('div', { cls: 'structured-tree-not-found' });
			}

			// Handle click events on the name only - but only for existing files and folders with folder notes
			if (childNode.file || (childNode.children.size > 0 && folderNoteExists)) {
				innerDiv.addEventListener('click', async (event) => {
					if (childNode.isFile && childNode.file) {
						const leaf = this.app.workspace.getLeaf(false);
						if (leaf) {
							await leaf.openFile(childNode.file);
						}
					} else if (childNode.children.size > 0 && folderNoteExists) {
						// Try to open folder note if it exists
						const folderNotePath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
						const folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);
						
						if (folderNote instanceof TFile) {
							const leaf = this.app.workspace.getLeaf(false);
							if (leaf) {
								await leaf.openFile(folderNote);
							}
						}
					}
				});
			}

			if (childNode.children.size > 0) {
				const childrenDiv = item.createEl('div', { 
					cls: 'tree-item-children',
					attr: { style: '' }
				});

				this.renderDendronNode(childNode, childrenDiv, '');
			}
		});
	}

	// Set up a MutationObserver to detect when the view is moved
	private setupMutationObserver() {
		// Get the plugin instance
		const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
		if (!plugin) return;

		// Create a MutationObserver to watch for DOM changes
		const observer = new MutationObserver((mutations) => {
			// Check if any of the mutations involve our view
			const shouldCheck = mutations.some(mutation => {
				// Check if our view is involved in this mutation
				return mutation.target.contains(this.containerEl) || 
					   this.containerEl.contains(mutation.target as Node);
			});

			if (shouldCheck) {
				setTimeout(() => plugin.detectAndSavePosition(), 100);
			}
		});

		// Start observing the entire app container for changes
		observer.observe(document.body, { 
			childList: true, 
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'style']
		});

		// Store the observer so we can disconnect it later
		(this as any).observer = observer;
	}
}

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
		this.addRibbonIcon('folder', 'Open File Tree', (evt: MouseEvent) => {
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
		const rightSplit = leafEl.closest('.mod-right-split');
		
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
