import { App, TFile } from 'obsidian';

export class TreeState {
    private static instance: TreeState;
    private expandedNodes: Set<string> = new Set<string>();
    private activeFile: TFile | null = null;
    private onStateChange: (() => void) | null = null;
    private lastInteractionWasClick: boolean = false;

    private constructor(private app: App) {
        // Initialize state, possibly from settings
    }

    public static getInstance(app: App): TreeState {
        if (!TreeState.instance) {
            TreeState.instance = new TreeState(app);
        }
        return TreeState.instance;
    }

    public getExpandedNodes(): string[] {
        return Array.from(this.expandedNodes);
    }

    public setExpandedNodes(nodes: string[]): void {
        this.expandedNodes = new Set(nodes);
        // Also persist to settings if needed
    }

    /**
     * Set a callback that will be called whenever the expanded state changes
     */
    public setOnStateChangeCallback(callback: () => void): void {
        this.onStateChange = callback;
    }

    private triggerStateChange(): void {
        if (this.onStateChange) {
            this.onStateChange();
        }
    }

    /**
     * Check if any nodes are currently expanded
     */
    public hasExpandedNodes(): boolean {
        return this.expandedNodes.size > 0;
    }
    
    /**
     * Check if all nodes are collapsed
     */
    public areAllNodesCollapsed(): boolean {
        // If there are no expanded nodes, all nodes are collapsed
        return !this.hasExpandedNodes();
    }

    /**
     * Get expanded nodes for saving in settings
     */
    public getExpandedNodesForSettings(): string[] {
        return Array.from(this.expandedNodes);
    }

    /**
     * Restore expanded nodes from settings
     */
    public restoreExpandedNodesFromSettings(nodes: string[]): void {
        this.expandedNodes = new Set(nodes);
        this.triggerStateChange();
    }

    /**
     * Clear all expanded nodes
     */
    public clearExpandedNodes(): void {
        this.expandedNodes.clear();
        this.triggerStateChange();
    }

    /**
     * Add an expanded node
     */
    public addExpandedNode(node: string): void {
        if (!this.expandedNodes.has(node)) {
            this.expandedNodes.add(node);
        }
        this.triggerStateChange();
    }

    /**
     * Remove an expanded node
     */
    public removeExpandedNode(node: string): void {
        this.expandedNodes.delete(node);
        this.triggerStateChange();
    }

    /**
     * Check if a node is expanded
     */
    public isNodeExpanded(node: string): boolean {
        return this.expandedNodes.has(node);
    }

    /**
     * Set the active file
     */
    public setActiveFile(file: TFile, fromClick: boolean = false): void {
        this.activeFile = file;
        this.lastInteractionWasClick = fromClick;
    }

    /**
     * Get the active file
     */
    public getActiveFile(): TFile | null {
        return this.activeFile;
    }

    /**
     * Check if the last interaction was a click
     */
    public getLastInteractionWasClick(): boolean {
        // Read the value and immediately reset it for the next interaction
        const wasClick = this.lastInteractionWasClick;
        this.lastInteractionWasClick = false;
        return wasClick;
    }

    public isNodeActive(node: string): boolean {
        return this.activeFile?.path === node;
    }
} 