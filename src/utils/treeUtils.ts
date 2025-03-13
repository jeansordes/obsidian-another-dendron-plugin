import { TFile, TFolder } from 'obsidian';
import { DendronNode } from '../models/types';

/**
 * Creates an empty DendronNode
 */
export function createDendronNode(): DendronNode {
    return {
        name: '',
        children: new Map<string, DendronNode>(),
        isRealFile: false,
        isRealFolder: false,
        folderPath: ''
    };
}

/**
 * Builds a Dendron structure from a list of files
 */
export function buildDendronStructure(folders: TFolder[], files: TFile[]): DendronNode {
    const root = createDendronNode();
    const processedPaths = new Set<string>();

    // create a set of all folder paths
    const folderPaths = new Set<string>();
    for (const folder of folders) {
        // transform file path to dendron path
        folderPaths.add(folder.path.replace(/\//g, '.'));
    }

    // First pass: create the structure and store file references
    for (const file of files) {
        // transform file path to dendron path
        const dendronFilePath = file.path.replace(/\//g, '.').replace(/\.md$/, '');
        const parts = dendronFilePath.split('.');
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
                    isRealFile: false,
                    isRealFolder: folderPaths.has(currentPath),
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
                isRealFile: true,
                isRealFolder: folderPaths.has(currentPath),
                file: file,
                folderPath: file.parent ? file.parent.path : ''
            });
            processedPaths.add(currentPath);
        }
    }
    
    // Second pass: propagate folder paths to nodes that might not have files
    propagateFolderPaths(root);
    
    return root;
}

/**
 * Helper method to propagate folder paths from children to parents
 */
export function propagateFolderPaths(node: DendronNode) {
    // If this node already has a folder path, no need to propagate
    if (node.folderPath) {
        // Recursively process children
        for (const [_, childNode] of node.children) {
            propagateFolderPaths(childNode);
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
        propagateFolderPaths(childNode);
    }
} 