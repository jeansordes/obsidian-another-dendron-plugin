import { TFile } from "obsidian";

import { App, Notice } from "obsidian";
import { t } from "src/i18n";
import { TreeNode } from "src/types";
export class FileUtils {
    public static basename(path: string): string {
        const normalizedPath = path.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        return parts[parts.length - 1] || '';
    }
    
    /**
         * Get the path for a child note
         */
    public static getChildPath(path: string): string {
        return path.replace(/\.md$/, '.' + t('untitledPath') + '.md');
    }
    
    /**
     * Create and open a note at the specified path
     */
    public static async createNote(app: App, path: string): Promise<void> {
        let note = app.vault.getAbstractFileByPath(path);
    
        if (!note) {
            try {
                note = await app.vault.create(path, '');
                new Notice(t('noticeCreatedNote', { path }));
            } catch (error) {
                new Notice(t('noticeFailedCreateNote', { path }));
                return;
            }
        }
    
        if (note instanceof TFile) {
            await this.openFile(app, note);
        }
    }

    public static async createChildNote(app: App, path: string): Promise<void> {
        await this.createNote(app, this.getChildPath(path));
    }
    
    /**
     * Open a file in a new leaf
     */
    public static async openFile(app: App, file: TFile): Promise<void> {
        const leaf = app.workspace.getLeaf(false);
        if (leaf) {
            await leaf.openFile(file);
        }
    }
}