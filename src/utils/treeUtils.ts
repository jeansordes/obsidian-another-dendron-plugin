import { TFile, TFolder } from 'obsidian';
import { DendronNode, DendronNodeType } from '../models/types';

/**
 * Creates an empty DendronNode
 */
export function createDendronNode(options: Partial<DendronNode> = {}): DendronNode {
    return {
        name: '',
        children: new Map<string, DendronNode>(),
        realPath: '',
        nodeType: DendronNodeType.VIRTUAL,
        ...options
    };
}

/**
 * Builds a Dendron structure from a list of files
 */
export function buildDendronStructure(folders: TFolder[], files: TFile[]): DendronNode {
    const root = createDendronNode();
    const processedPaths = new Set<string>();

    // Create a set of all folder paths
    const folderPaths = new Set<string>();
    for (const folder of folders) {
        folderPaths.add(folder.path.replace(/\//g, '.'));
    }

    // Create the structure and store file references
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
                current.children.set(pathSoFar, createDendronNode({
                    name: pathSoFar,
                    nodeType: isLeaf ? DendronNodeType.FILE : (folderPaths.has(pathSoFar) ? DendronNodeType.FOLDER : DendronNodeType.VIRTUAL),
                    realPath: file.parent ? file.parent.path : '',
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
 */
export function propagateFolderPaths(node: DendronNode) {
    // If node doesn't have a folder path, try to get it from children
    if (!node.realPath) {
        for (const [_, childNode] of node.children) {
            if (childNode.realPath) {
                node.realPath = childNode.realPath;
                break;
            }
        }
    }
    
    // Recursively process all children
    for (const [_, childNode] of node.children) {
        propagateFolderPaths(childNode);
    }
} 