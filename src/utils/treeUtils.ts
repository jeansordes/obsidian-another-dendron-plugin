import { TFile, TFolder } from 'obsidian';
import { DendronNode, DendronNodeType } from '../models/types';

/**
 * Creates an empty DendronNode with default values
 */
export function createDendronNode(options: Partial<DendronNode> = {}): DendronNode {
    return {
        dendronPath: '',
        filePath: '',
        children: new Map<string, DendronNode>(),
        folderPath: '',
        nodeType: DendronNodeType.VIRTUAL,
        ...options
    };
}

/**
 * Builds a Dendron structure from a list of files and folders
 */
export function buildDendronStructure(folders: TFolder[], files: TFile[]): DendronNode {
    const root = createDendronNode();
    const processedPaths = new Set<string>();

    // Create a set of all folder paths for quick lookup
    const folderPaths = new Set<string>();
    for (const folder of folders) {
        folderPaths.add(folder.path.replace(/\//g, '.'));
    }
    // ... and file paths
    const filePaths = new Set<string>();
    for (const file of files) {
        filePaths.add(file.path.replace(/\.md$/, '').replace(/\//g, '.'));
    }

    // Process each file to build the Dendron structure
    for (const file of files) {
        const dendronFilePath = file.path.replace(/\//g, '.').replace(/\.md$/, '');
        const parts = dendronFilePath.split('.');
        let current = root;
        let pathSoFar = '';
        
        // Process each part of the path
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            pathSoFar = pathSoFar ? `${pathSoFar}.${part}` : part;
            const isLeaf = i === parts.length - 1;
            
            if (!current.children.has(pathSoFar) && !processedPaths.has(pathSoFar)) {
                const folderPath = file.parent ? file.parent.path : '';
                const nodeType = folderPaths.has(pathSoFar) ? DendronNodeType.FOLDER : (filePaths.has(pathSoFar) ? DendronNodeType.FILE : DendronNodeType.VIRTUAL);
                
                // Determine the file path based on node type
                let filePath = '';
                if (nodeType === DendronNodeType.FILE) {
                    // For leaf nodes, use the actual file path
                    filePath = file.path;
                } else if (nodeType === DendronNodeType.FOLDER) {
                    // For folder nodes, use the parent folder path
                    filePath = file.parent ? file.parent.path : '';
                } else {
                    // For virtual nodes, use the relative path
                    filePath = pathSoFar.replace(folderPath + '.', '');
                }

                // Create the node with appropriate properties
                current.children.set(pathSoFar, createDendronNode({
                    dendronPath: pathSoFar,
                    nodeType: nodeType,
                    filePath: filePath,
                    folderPath: folderPath,
                    ...(isLeaf ? { obsidianResource: file } : {})
                }));
                
                processedPaths.add(pathSoFar);
            }
            
            current = current.children.get(pathSoFar)!;
        }
    }
    
    // Propagate folder paths to nodes that might not have files
    propagateFolderPaths(root);
    
    return root;
}

/**
 * Helper method to propagate folder paths from children to parents
 * This ensures all nodes have proper folder path information
 */
export function propagateFolderPaths(node: DendronNode): void {
    // If node doesn't have a folder path, try to get it from children
    if (!node.folderPath) {
        for (const childNode of node.children.values()) {
            if (childNode.folderPath) {
                node.folderPath = childNode.folderPath;
                break;
            }
        }
    }
    
    // Recursively process all children
    for (const childNode of node.children.values()) {
        propagateFolderPaths(childNode);
    }
} 