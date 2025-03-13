import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFolder, TFile, ItemView, WorkspaceLeaf, ViewState } from 'obsidian';

// Define the view type for our file tree view
const FILE_TREE_VIEW_TYPE = 'file-tree-view';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

// File Tree View class
class FileTreeView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return FILE_TREE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'File Tree';
	}

	getIcon(): string {
		return 'folder';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl('h4', { text: 'Vault File Tree' });
		
		// Create a container for the file tree
		const fileTreeContainer = container.createEl('div', { cls: 'file-tree-container' });
		
		// Build the file tree
		await this.buildFileTree(fileTreeContainer);
	}

	async buildFileTree(container: HTMLElement) {
		// Get the root folder of the vault
		const rootFolder = this.app.vault.getRoot();
		
		// Create a list for the file tree
		const rootList = container.createEl('ul', { cls: 'file-tree-list' });
		
		// Recursively build the tree
		await this.addFolderToTree(rootFolder, rootList);
	}

	async addFolderToTree(folder: TFolder, parentEl: HTMLElement) {
		// Sort children: folders first, then files, both alphabetically
		const children = folder.children.sort((a, b) => {
			// Folders come before files
			const aIsFolder = a instanceof TFolder;
			const bIsFolder = b instanceof TFolder;
			
			if (aIsFolder && !bIsFolder) return -1;
			if (!aIsFolder && bIsFolder) return 1;
			
			// Alphabetical sort
			return a.name.localeCompare(b.name);
		});
		
		// Add each child to the tree
		for (const child of children) {
			const item = parentEl.createEl('li');
			
			if (child instanceof TFolder) {
				// Create a folder item with a toggle
				const folderDiv = item.createEl('div', { cls: 'file-tree-folder' });
				
				// Add a toggle button
				const toggleButton = folderDiv.createEl('span', { 
					cls: 'file-tree-folder-toggle',
					text: '▶' 
				});
				
				// Add folder name
				folderDiv.createEl('span', { 
					cls: 'file-tree-folder-name',
					text: child.name 
				});
				
				// Create a nested list for the folder's children
				const nestedList = item.createEl('ul', { 
					cls: 'file-tree-nested-list file-tree-collapsed' 
				});
				
				// Add click handler for the toggle
				toggleButton.addEventListener('click', () => {
					toggleButton.textContent = toggleButton.textContent === '▶' ? '▼' : '▶';
					if (nestedList.hasClass('file-tree-collapsed')) {
						nestedList.removeClass('file-tree-collapsed');
					} else {
						nestedList.addClass('file-tree-collapsed');
					}
				});
				
				// Recursively add the folder's children
				await this.addFolderToTree(child, nestedList);
			} else if (child instanceof TFile) {
				// Create a file item
				const fileDiv = item.createEl('div', { cls: 'file-tree-file' });
				
				// Add file name
				fileDiv.createEl('span', { 
					cls: 'file-tree-file-name',
					text: child.name 
				});
				
				// Add click handler to open the file
				fileDiv.addEventListener('click', async () => {
					const leaf = this.app.workspace.getLeaf('tab');
					if (leaf) {
						await leaf.openFile(child);
					}
				});
			}
		}
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register the file tree view
		this.registerView(
			FILE_TREE_VIEW_TYPE,
			(leaf) => new FileTreeView(leaf)
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
