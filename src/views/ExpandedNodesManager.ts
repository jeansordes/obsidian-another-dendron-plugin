import { setIcon } from 'obsidian';
import { t } from '../i18n';

export class ExpandedNodesManager {
    private container: HTMLElement;
    private expandedNodes: Set<string>;

    constructor(container: HTMLElement, expandedNodes: Set<string>) {
        this.container = container;
        this.expandedNodes = expandedNodes;
    }

    /**
     * Add control buttons to the header
     */
    addControlButtons(header: HTMLElement): void {
        // Create a container for the buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'tm_tree-buttons';
        header.appendChild(buttonContainer);
        
        // Add a single toggle button for expand/collapse all (as a div instead of button)
        const toggleButton = document.createElement('div');
        toggleButton.className = 'tm_tree-toggle-button is-clickable';
        buttonContainer.appendChild(toggleButton);
        
        // Create the icon container
        const iconContainer = document.createElement('div');
        iconContainer.className = 'tm_tree-toggle-icon tm_button-icon';
        toggleButton.appendChild(iconContainer);
        
        // Add click handler
        toggleButton.addEventListener('click', () => {
            // Get the current button action from its title
            const currentTitle = toggleButton.getAttribute('title');
            
            // Perform the action based on what the button currently shows
            if (currentTitle === t('tooltipExpandAll')) {
                // Button shows "Expand All", so expand all nodes
                this.expandAllNodes();
            } else {
                // Button shows "Collapse All", so collapse all nodes
                this.collapseAllNodes();
            }
            
            // Update the icon based on the new state
            this.updateToggleButtonIcon();
        });
        
        // Set initial icon and title based on state
        this.updateToggleButtonIcon();
    }

    /**
     * Check if any nodes are currently expanded
     */
    private hasExpandedNodes(): boolean {
        return this.expandedNodes.size > 0;
    }
    
    /**
     * Check if all nodes are collapsed
     */
    private areAllNodesCollapsed(): boolean {
        if (!this.container) return true;
        
        // If there are no expanded nodes, all nodes are collapsed
        return !this.hasExpandedNodes();
    }

    /**
     * Get expanded nodes for saving in settings
     */
    getExpandedNodesForSettings(): string[] {
        return Array.from(this.expandedNodes);
    }

    /**
     * Restore expanded nodes from settings
     */
    restoreExpandedNodesFromSettings(nodes: string[]): void {
        this.expandedNodes = new Set(nodes);
    }

    /**
     * Collapse all nodes in the tree
     */
    collapseAllNodes(): void {
        if (!this.container) return;
        
        // Clear expanded nodes set
        this.expandedNodes.clear();
        
        // Add collapsed class to all tree items
        const items = this.container.querySelectorAll('.tm_tree-item');
        items.forEach(item => {
            item.addClass('is-collapsed');
        });
        
        // Update triangle icons
        const triangles = this.container.querySelectorAll('.right-triangle');
        triangles.forEach(triangle => {
            triangle.removeClass('is-collapsed');
        });
        
        // Update the toggle button icon if it exists
        this.updateToggleButtonIcon();
    }

    /**
     * Expand all nodes in the tree
     */
    expandAllNodes(): void {
        if (!this.container) return;
        
        // Get all tree items
        const items = this.container.querySelectorAll('.tm_tree-item');
        
        // Remove collapsed class from all tree items
        items.forEach(item => {
            item.removeClass('is-collapsed');
            
            // Add to expanded nodes set
            const path = item.getAttribute('data-path');
            if (path) {
                this.expandedNodes.add(path);
            }
        });
        
        // Update triangle icons
        const triangles = this.container.querySelectorAll('.right-triangle');
        triangles.forEach(triangle => {
            triangle.addClass('is-collapsed');
        });
        
        // Update the toggle button icon if it exists
        this.updateToggleButtonIcon();
    }
    
    /**
     * Update the toggle button icon based on the current state
     */
    private updateToggleButtonIcon(): void {
        const toggleButton = this.container.querySelector('.tm_tree-toggle-button') as HTMLElement | null;
        if (!toggleButton) return;
        
        const iconContainer = toggleButton.querySelector('.tm_tree-toggle-icon') as HTMLElement | null;
        if (!iconContainer) return;
        
        const allNodesCollapsed = this.areAllNodesCollapsed();
        
        if (allNodesCollapsed) {
            // If all nodes are collapsed, show "expand all" icon
            setIcon(iconContainer, 'chevrons-up-down');
            toggleButton.setAttribute('title', t('tooltipExpandAll'));
        } else {
            // Otherwise, show "collapse all" icon
            setIcon(iconContainer, 'chevrons-down-up');
            toggleButton.setAttribute('title', t('tooltipCollapseAll'));
        }
    }
} 