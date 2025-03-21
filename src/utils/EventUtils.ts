import { App, TFile } from "obsidian";
import { TreeState } from "../store/TreeState";
import { ViewUtils } from "./ViewUtils";
import { FileUtils } from "./FileUtils";
import { Csl } from "./ConsoleUtils";

export class EventUtils {
    private treeState: TreeState;
    private viewUtils: ViewUtils;
    private fileUtils: FileUtils;

    // Debounce timeout for refresh calls, this is used to prevent multiple refreshes in quick succession
    // and to ensure that the refresh is only called once after a period of inactivity.
    // This is typically used to prevent the UI from freezing when many files are being modified quickly.
    private refreshTimerId: NodeJS.Timeout | null = null;

    constructor(app: App, treeState: TreeState) {
        this.treeState = treeState;
        this.viewUtils = new ViewUtils(app, this.treeState);
        this.fileUtils = new FileUtils(app);
    }

    /**
     * Register file system events
     */
    public registerFileEvents(app: App, refreshCallback: (path?: string, forceFullRefresh?: boolean) => void): void {
        // Create a debounced refresh handler
        const debouncedRefresh = (path?: string, forceFullRefresh: boolean = false) => {
            this.debounceRefresh(() => {
                refreshCallback(path, forceFullRefresh);
            }, 300);
        };
        
        // Register individual events to avoid type issues
        app.vault.on('create', (file) => {
            // Force full refresh for file creation
            debouncedRefresh(undefined, true);
        });

        app.vault.on('modify', (file) => {
            // Only refresh for markdown files
            if (file instanceof TFile && file.extension === 'md') {
                // Use incremental update for modifications
                debouncedRefresh(file.path);
            }
        });

        app.vault.on('delete', (file) => {
            // Force full refresh for file deletion
            debouncedRefresh(undefined, true);
        });

        app.vault.on('rename', (file, oldPath) => {
            // Force full refresh for file renaming
            debouncedRefresh(undefined, true);
        });
    }

    /**
     * Debounce refresh calls to prevent multiple refreshes in quick succession
     */
    private debounceRefresh(callback: Function, wait: number): void {
        if (this.refreshTimerId) {
            clearTimeout(this.refreshTimerId);
        }
        this.refreshTimerId = setTimeout(() => {
            callback();
            this.refreshTimerId = null;
        }, wait);
    }

    public addGlobalClickListener() {
        const container = ViewUtils.getRootContainer();
        if (!container) return;

        container.addEventListener('click', (event) => {
            const targetElement = event.target as HTMLElement;
            const actionElement = targetElement.closest('[data-action]');
            
            if (!actionElement || !(actionElement instanceof HTMLElement)) return;
            
            const action = actionElement.getAttribute('data-action');
            if (!action) return;
            
            // Get path attribute safely
            const actionPath = actionElement.getAttribute('data-action-path') || '';
            
            if (action === 'toggle-collapse') {
                // DONE
                this.viewUtils.toggleCollapse(actionElement);
            } else if (action === 'open-file' && actionPath) {
                // Open file and highlight it
                this.viewUtils.openFile(actionPath);
            } else if (action === 'create-note' && actionPath) {
                (async () => {
                    await this.fileUtils.createNote(actionPath);
                    this.viewUtils.openFile(actionPath);
                })();
            } else if (action === 'create-child-note' && actionPath) {
                (async () => {
                    await this.fileUtils.createChildNote(actionPath);
                    await this.fileUtils.openAndTryRename(actionPath);
                })();
            } else if (action === 'expand-all') {
                // DONE
                this.viewUtils.expandAllNodes();
            } else if (action === 'collapse-all') {
                // DONE
                this.viewUtils.collapseAllNodes();
            }
        });
    }
}