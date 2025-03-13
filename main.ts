import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFolder, TFile, ItemView, WorkspaceLeaf, ViewState } from 'obsidian';

// Define the view type for our file tree view
const FILE_TREE_VIEW_TYPE = 'dendron-tree-view';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

interface DendronNode {
	name: string;
	children: Map<string, DendronNode>;
	file?: TFile;
	isFile: boolean;
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

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl('h4', { text: 'Dendron Tree' });
		
		// Create a container for the dendron tree
		const treeContainer = container.createEl('div', { cls: 'dendron-tree-container' });
		this.container = treeContainer;
		
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
			isFile: false
		};
	}

	buildDendronStructure(files: TFile[]): DendronNode {
		const root = this.createDendronNode();
		const processedPaths = new Set<string>();
		
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
						isFile: false
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
					file: file
				});
				processedPaths.add(currentPath);
			}
		}
		
		return root;
	}

	// Add these helper methods before renderDendronNode
	private findParentFolder(node: DendronNode): string {
		// First try to find a file in the current node's children
		for (const [_, childNode] of node.children) {
			if (childNode.file?.parent?.path) {
				return childNode.file.parent.path;
			}
		}

		// If no file found in children, look for files in parent nodes
		let current = node;
		while (current) {
			for (const [_, siblingNode] of current.children) {
				if (siblingNode.file?.parent?.path) {
					return siblingNode.file.parent.path;
				}
			}
			// Move up the tree by finding the parent node
			let found = false;
			for (const [_, potentialParent] of this.lastBuiltTree?.children || new Map()) {
				if (potentialParent.children.has(current.name)) {
					current = potentialParent;
					found = true;
					break;
				}
			}
			if (!found) break;
		}

		// If no files found in the tree, return empty string (vault root)
		return "";
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
			const item = parentEl.createEl('div', { cls: 'tree-item is-clickable' });
			
			const itemSelf = item.createEl('div', { 
				cls: 'tree-item-self is-clickable' + (childNode.children.size > 0 ? ' mod-collapsible' : '')
			});

			if (childNode.children.size > 0) {
				const iconDiv = itemSelf.createEl('div', { cls: 'tree-item-icon collapse-icon' });
				iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;
			}

			// Display name without the path
			const displayName = name.split('.').pop() || name;
			const innerDiv = itemSelf.createEl('div', { 
				cls: 'tree-item-inner' + (!childNode.file && childNode.isFile ? ' mod-create-new' : ''),
				text: displayName
			});

			if (!childNode.isFile && childNode.children.size === 0) {
				itemSelf.createEl('div', { cls: 'structured-tree-not-found' });
			}

			// Track clicks for double-click detection
			let clickTimeout: NodeJS.Timeout | null = null;
			let preventSingleClick = false;

			// Handle click events
			itemSelf.addEventListener('click', async (event) => {
				if (preventSingleClick) {
					preventSingleClick = false;
					return;
				}

				// Handle single click
				if (childNode.children.size > 0) {
					item.toggleClass('is-collapsed', !item.hasClass('is-collapsed'));
					const triangle = itemSelf.querySelector('.right-triangle');
					if (triangle) {
						triangle.classList.toggle('is-collapsed');
					}
				}

				if (childNode.isFile && childNode.file) {
					const leaf = this.app.workspace.getLeaf(false);
					if (leaf) {
						await leaf.openFile(childNode.file);
					}
				}
			});

			// Handle double-click events
			itemSelf.addEventListener('dblclick', async (event) => {
				preventSingleClick = true;
				
				if (clickTimeout) {
					clearTimeout(clickTimeout);
					clickTimeout = null;
				}

				// Handle folder note creation/opening
				if (childNode.children.size > 0) {
					const parentFolder = this.findParentFolder(childNode);
					const folderNotePath = parentFolder 
						? `${parentFolder}/${name}.md`
						: `${name}.md`;

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
						const parentFolder = this.findParentFolder(childNode);
						const fullPath = parentFolder 
							? `${parentFolder}/${name}.md`
							: `${name}.md`;

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

			if (childNode.children.size > 0) {
				const childrenDiv = item.createEl('div', { 
					cls: 'tree-item-children',
					attr: { style: '' }
				});

				this.renderDendronNode(childNode, childrenDiv, '');
			}
		});
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

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	async activateView() {
		// If the view is already open, do nothing
		if (this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE).length > 0) {
			return;
		}

		// Open the view in the right sidebar
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: FILE_TREE_VIEW_TYPE,
				active: true,
			} as ViewState);
		}

		// Reveal the leaf
		const newLeaf = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE)[0];
		if (newLeaf) {
			this.app.workspace.revealLeaf(newLeaf);
		}
	}

	onunload() {
		// Unregister the view when the plugin is disabled
		this.app.workspace.detachLeavesOfType(FILE_TREE_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
