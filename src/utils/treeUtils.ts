import { TFile, TFolder } from 'obsidian';
import { DendronNode, DendronNodeType } from '../models/types';

/**
 * Creates an empty DendronNode with default values
 */
export function createDendronNode(options: Partial<DendronNode> = {}): DendronNode {
    return {
        dendronPath: '',
        filePath: '.',
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
    const folderByPath = new Map<string, TFolder>();
    for (const folder of folders) {
        folderPaths.add(folder.path.replace(/\//g, '.'));
        folderByPath.set(folder.path, folder);
    }
    // ... and file paths
    const filePaths = new Set<string>();
    const fileByPath = new Map<string, TFile>();
    for (const file of files) {
        filePaths.add(file.path.replace(/\.md$/, '').replace(/\//g, '.'));
        fileByPath.set(file.path, file);
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
                let folderPath = file.parent ? file.parent.path : '';
                const nodeType = folderPaths.has(pathSoFar) ? DendronNodeType.FOLDER : (filePaths.has(pathSoFar) ? DendronNodeType.FILE : DendronNodeType.VIRTUAL);
                let resource: TFile | TFolder | undefined;
                
                // Determine the file path based on node type
                let filePath = '';
                const dendronFolderPath = folderPath.replace('/', '.');
                const baseName = pathSoFar.replace(dendronFolderPath + '.', '');
                
                if (nodeType === DendronNodeType.FOLDER) {
                    // For folders, the filePath should be the folder path itself
                    const folderPathFromDendron = pathSoFar.replace(/\./g, '/');
                    filePath = folderPathFromDendron;
                    // Update folderPath to match the actual folder path
                    folderPath = folderPathFromDendron;
                } else {
                    // For files, append .md as before
                    filePath = folderPath + '/' + baseName + '.md';
                }
                
                // Handle root folder
                if (filePath.startsWith('//')) {
                    filePath = filePath.replace('//', '');
                }
                
                // Get the resource
                if (nodeType === DendronNodeType.FILE) {
                    resource = fileByPath.get(filePath);
                } else if (nodeType === DendronNodeType.FOLDER) {
                    resource = folderByPath.get(filePath);
                }

                // Create the node with appropriate properties
                const node = createDendronNode({
                    dendronPath: pathSoFar,
                    nodeType: nodeType,
                    filePath: filePath,
                    folderPath: folderPath,
                    obsidianResource: resource
                });

                current.children.set(pathSoFar, node);
                
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