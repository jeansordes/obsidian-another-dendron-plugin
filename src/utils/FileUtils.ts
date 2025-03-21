import { App, Notice, TFile } from "obsidian";
import { t } from "../i18n";
import { Node, NodeType } from "src/types";
import { basename } from "path";

export class FileUtils {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    public async createNote(path: string): Promise<void> {
        await this.app.vault.create(path, '');
    }

    /**
     * Create a child note to the current file
     */
    public async createChildNote(parentPath: string): Promise<void> {
        // Generate child note path by replacing .md with .new.md
        const childPath = parentPath.replace(/\.md$/, '.' + t('untitledPath') + '.md');

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
    }

    public async openAndTryRename(path: string): Promise<void> {
        let note = this.app.vault.getAbstractFileByPath(path);

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
                        const specificTitleElement = containerEl.querySelector('.view-header-title-container .view-header-title');
                        const simpleTitleElement = containerEl.querySelector('.view-header-title');

                        // Use the more specific title element if available, otherwise use the simpler one
                        const titleElement = specificTitleElement instanceof HTMLElement
                            ? specificTitleElement
                            : (simpleTitleElement instanceof HTMLElement ? simpleTitleElement : null);

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

    public static removeExtension(path: string): string {
        return path.split('.').slice(0, -1).join('.');
    }

    public static getNodeName(node: Node): string {
        if (node.nodeType === NodeType.FOLDER) {
            return basename(node.path);
        }
        return basename(node.path).match(/([^.]+)\.[^.]+$/)?.[1] || basename(node.path);
    }

    public static getFullPath(node: Node): string {
        if (node.nodeType === NodeType.FILE || node.nodeType === NodeType.FOLDER) {
            return node.obsidianResource?.path || '';
        } else if (node.nodeType === NodeType.VIRTUAL) {
            return node.path;
        }

        return node.path;
    }
}