import { App, TFile, TFolder } from 'obsidian';
import { TreeState } from 'src/store/TreeState';
import { Node, NodeType } from '../types';
import { basename } from 'path';
import { Csl } from './ConsoleUtils';
import { t } from 'src/i18n';

export class TreeBuilder {
    private pathsByDepthLevel: Map<number, Set<string>> = new Map<number, Set<string>>();
    private nodeTypeByPath = new Map<string, NodeType>();
    private childrenAmountByPath = new Map<string, number>();

    constructor(private app: App) { }
    /**
     * Creates an empty DendronNode with default values
     */
    private createDendronNode(options: Partial<Node> = {}): Node {
        return {
            path: '',
            children: new Map<string, Node>(),
            nodeType: NodeType.VIRTUAL,
            isExpanded: false,
            isActive: false,
            ...options
        };
    }

    private splitPathIntoSegments(path: string): string[] {
        // Split the path by '/' to separate folders from filename
        const parts = path.split('/');

        // Get all folder parts and add trailing '/'
        const folderParts = parts.slice(0, -1).map(part => part + '/');

        // Get the filename (last part) and split by '.'
        const filenameParts = parts[parts.length - 1].split('.');

        // Combine folder parts and filename parts
        return [...folderParts, ...filenameParts];
    }

    public buildDendronStructure(folders: TFolder[], files: TFile[]): Node {
        this.buildPathsByDepthLevel(files, folders);
        const rootNode = this.createDendronNode({
            path: '/',
            nodeType: NodeType.FOLDER,
            isExpanded: true,
            isActive: false
        });
        const treeState = TreeState.getInstance(this.app);

        // Create a map to quickly look up nodes by path
        const nodesByPath = new Map<string, Node>();
        nodesByPath.set('/', rootNode);

        // Process each depth level in ascending order to ensure parents are created before children
        for (let depth = 0; depth < this.pathsByDepthLevel.size; depth++) {
            const paths = this.pathsByDepthLevel.get(depth);
            if (!paths) continue;

            for (const path of paths) {
                // Skip root node as we already created it
                if (path === '/') continue;

                const parentPath = this.getParentPath(path);
                const parentNode = nodesByPath.get(parentPath);

                if (!parentNode) {
                    Csl.log(`Warning: Parent node not found for path: ${path}, parent: ${parentPath}`);
                    continue;
                }

                // Create the node
                const node = this.createDendronNode({
                    path: path,
                    nodeType: this.getNodeType(path),
                    isExpanded: treeState.isNodeExpanded(path),
                    // For FILE nodes, store the Obsidian resource
                    obsidianResource: this.getNodeType(path) === NodeType.FILE ?
                        files.find(f => f.path === path) :
                        (this.getNodeType(path) === NodeType.FOLDER ? folders.find(f => f.path === path) : undefined)
                });

                // Add to parent's children
                parentNode.children.set(basename(path), node);

                // Add to our lookup map
                nodesByPath.set(path, node);
            }
        }

        return rootNode;
    }

    public buildPathsByDepthLevel(files: TFile[], folders: TFolder[]): Map<number, Set<string>> {
        this.pathsByDepthLevel = new Map<number, Set<string>>();
        this.nodeTypeByPath = new Map<string, NodeType>();
        this.childrenAmountByPath = new Map<string, number>();

        // Set root folder
        this.registerNode('/', 0, NodeType.FOLDER);

        const folderPaths = new Set<string>();
        // Register all folders first
        for (const folder of folders) {
            folderPaths.add(folder.path);
            const depth = folder.path === '/' ? 0 : folder.path.split('/').length;
            this.registerNode(folder.path, depth, NodeType.FOLDER);
        }

        // Set to track processed paths to avoid duplicates
        const processedPaths = new Set<string>();

        for (const file of files) {
            if (processedPaths.has(file.path)) continue;
            processedPaths.add(file.path);

            const folderDepth = file.parent!.path === '/' ? 0 : file.parent!.path.split('/').length;
            const fileDepth = file.basename.split('.').length;
            const depth = folderDepth + fileDepth;

            // File registration
            this.registerNode(file.path, depth, NodeType.FILE);

            // If the file contains dots, we add the VIRTUAL paths
            if (fileDepth > 1) {
                let virtualPath = this.getParentPath(file.path);
                let virtualDepth = depth - 1;

                // Prevent infinite loops by setting a reasonable limit
                // and checking if we've already processed this path
                while (!folderPaths.has(virtualPath) &&
                    virtualPath !== '/' &&
                    !processedPaths.has(virtualPath)) {

                    processedPaths.add(virtualPath);
                    this.registerNode(virtualPath, virtualDepth, NodeType.VIRTUAL);

                    // Get next parent
                    let nextParent = this.getParentPath(virtualPath);

                    // Break if we're not making progress (safeguard)
                    if (nextParent === virtualPath) {
                        break;
                    }

                    virtualPath = nextParent;
                    virtualDepth--;
                }
            }
        }

        // Update children counts
        for (const nodePath of this.nodeTypeByPath.keys()) {
            const parentPath = this.getParentPath(nodePath);

            if (nodePath !== '/' && parentPath) {
                const amount = this.childrenAmountByPath.get(parentPath) ?? 0;
                this.childrenAmountByPath.set(parentPath, amount + 1);
            }
        }

        return this.pathsByDepthLevel;
    }

    private registerNode(path: string, depth: number, type: NodeType = NodeType.VIRTUAL): void {
        // Skip if this path/depth combination is already registered
        if (this.pathsByDepthLevel.has(depth) &&
            this.pathsByDepthLevel.get(depth)!.has(path)) {
            return;
        }

        // Skip clearly invalid paths
        if (!path || path === '') {
            return;
        }

        if (!this.pathsByDepthLevel.has(depth)) {
            this.pathsByDepthLevel.set(depth, new Set<string>());
        }
        this.pathsByDepthLevel.get(depth)!.add(path);

        // Only set the node type if it wasn't already set or if we're upgrading from VIRTUAL
        const existingType = this.nodeTypeByPath.get(path);
        if (!existingType || (existingType === NodeType.VIRTUAL && type !== NodeType.VIRTUAL)) {
            this.nodeTypeByPath.set(path, type);
        }

        // Initialize the children count if not already set
        if (!this.childrenAmountByPath.has(path)) {
            this.childrenAmountByPath.set(path, 0);
        }
    }

    public getParentPath(path: string): string {
        const nodeType = this.nodeTypeByPath.get(path);
        if (nodeType === NodeType.FOLDER) {
            const result = path.replace(/[\/]?[^\/]*$/, '');
            return result === '' ? '/' : result;
        }

        // if it's not a FOLDER, then it's FILE or VIRTUAL
        let result = path.replace(/(\/|^)[^\.\/]+.md$/, '');
        result = result === '' ? '/' : result.replace(/\.[^\.]+\.md$/, '.md');
        return result;
    }

    public getNewNotePath(path: string): string {
        const newNoteName = t('untitledPath') + '.md';
        const nodeType = this.nodeTypeByPath.get(path);
        if (nodeType === NodeType.FOLDER) {
            return path + '/' + newNoteName;
        }
        // Remove extension and add the new note name
        return path.replace(/\.[^\.]+$/, '') + '.' + newNoteName;
    }

    public getNodeType(path: string): NodeType {
        return this.nodeTypeByPath.get(path) ?? NodeType.VIRTUAL;
    }

    public getChildrenAmount(path: string): number {
        return this.childrenAmountByPath.get(path) ?? 0;
    }
}