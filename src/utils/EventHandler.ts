import { App, TFile } from 'obsidian';
import { TreeNode } from '../types';

export class DendronEventHandler {
    private app: App;
    private refreshCallback: (path?: string, forceFullRefresh?: boolean) => void;
    private refreshDebounceTimeout: number | null = null;

    constructor(app: App, refreshCallback: (path?: string, forceFullRefresh?: boolean) => void) {
        this.app = app;
        this.refreshCallback = refreshCallback;
    }

    /**
     * Register file system events
     */
    registerFileEvents(): void {
        // Create a debounced refresh handler
        const debouncedRefresh = (path?: string, forceFullRefresh: boolean = false) => {
            this.debounceRefresh(() => {
                this.refreshCallback(path, forceFullRefresh);
            }, 300);
        };
        
        // Register individual events to avoid type issues
        this.app.vault.on('create', (file) => {
            // Force full refresh for file creation
            debouncedRefresh(undefined, true);
        });

        this.app.vault.on('modify', (file) => {
            // Only refresh for markdown files
            if (file instanceof TFile && file.extension === 'md') {
                // Use incremental update for modifications
                debouncedRefresh(file.path);
            }
        });

        this.app.vault.on('delete', (file) => {
            // Force full refresh for file deletion
            debouncedRefresh(undefined, true);
        });

        this.app.vault.on('rename', (file, oldPath) => {
            // Force full refresh for file renaming
            debouncedRefresh(undefined, true);
        });
    }

    /**
     * Register events for active file changes
     */
    registerActiveFileEvents(callback: (file: TFile) => void): void {
        this.app.workspace.on('file-open', (file) => {
            if (file) {
                callback(file);
            }
        });
    }

    /**
     * Debounce refresh calls to prevent multiple refreshes in quick succession
     */
    private debounceRefresh(callback: Function, wait: number): void {
        if (this.refreshDebounceTimeout) {
            window.clearTimeout(this.refreshDebounceTimeout);
        }
        this.refreshDebounceTimeout = window.setTimeout(() => {
            callback();
            this.refreshDebounceTimeout = null;
        }, wait);
    }

    /**
     * Try to update the tree incrementally based on the changed path
     */
    tryIncrementalUpdate(
        changedPath: string,
        container: HTMLElement,
        lastBuiltTree: TreeNode | null,
        nodePathMap: Map<string, TreeNode>,
        renderCallback: (node: TreeNode, container: HTMLElement) => void
    ): boolean {
        if (!container || !lastBuiltTree) return false;
        
        try {
            // Convert file path to dendron path format
            const dendronPath = changedPath.replace(/\//g, '.').replace(/\.md$/, '');
            
            // Find the parent path that needs updating
            const pathParts = dendronPath.split('.');
            let parentPath = '';
            
            // Try to find the highest level parent that exists in the tree
            for (let i = 0; i < pathParts.length; i++) {
                const testPath = pathParts.slice(0, i + 1).join('.');
                if (nodePathMap.has(testPath)) {
                    parentPath = testPath;
                }
            }
            
            // If we can't find a parent path, we need a full rebuild
            if (!parentPath) {
                return false;
            }
            
            // Find the DOM element for this path
            const parentElement = container.querySelector(`.tm_tree-item[data-path="${parentPath}"]`) as HTMLElement;
            if (!parentElement) {
                return false;
            }
            
            // Find the children container
            const childrenContainer = parentElement.querySelector('.tm_tree-item-children') as HTMLElement;
            if (!childrenContainer) {
                return false;
            }
            
            // Get the node from the path map
            const node = nodePathMap.get(parentPath);
            if (!node) {
                return false;
            }
            
            // Clear the children container
            childrenContainer.empty();
            
            // Re-render just this subtree
            renderCallback(node, childrenContainer);
            
            return true;
        } catch (error) {
            // If any error occurs, fall back to full rebuild
            return false;
        }
    }
} 