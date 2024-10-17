import * as vscode from 'vscode';

import { TPin } from './types';

import path = require('path');

export class PinProvider
    implements vscode.TreeDataProvider<Pin>, vscode.TreeDragAndDropController<Pin>
{
    private pins?: TPin[];
    dragMimeTypes: readonly string[] = ['application/vnd.code.tree.pins'];
    dropMimeTypes: readonly string[] = ['application/vnd.code.tree.pins'];

    constructor(private context: vscode.ExtensionContext) {
        this.pins = context.workspaceState.get('pins');
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Pin | undefined | null | void> =
        new vscode.EventEmitter<Pin | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Pin | undefined | null | void> =
        this._onDidChangeTreeData.event;

    getTreeItem(pin: Pin): vscode.TreeItem {
        return pin;
    }

    getChildren(element?: Pin | undefined): vscode.ProviderResult<Pin[]> {
        return this.pins?.map(p => new Pin(p.label, p.fileLocation, p.type, 0, p.alias));
    }

    public async handleDrag(source: Pin[], dataTransfer: vscode.DataTransfer) {
        dataTransfer.set(
            'application/vnd.code.tree.pins',
            new vscode.DataTransferItem(source.map(pin => pin.fileLocation)),
        );
    }

    public async handleDrop(
        target: Pin | undefined,
        dataTransfer: vscode.DataTransfer,
    ): Promise<void> {
        const dragData = dataTransfer.get('application/vnd.code.tree.pins');
        if (!dragData) return;

        const movedFiles: string[] = JSON.parse(await dragData.asString());
        const pins = this.pins || [];

        const movedPin = pins.find(p => movedFiles.includes(p.fileLocation));
        if (!movedPin) return;

        const newPins = pins.filter(p => p.fileLocation !== movedPin.fileLocation);

        if (target) {
            const targetIndex = pins.findIndex(p => p.fileLocation === target.fileLocation);
            newPins.splice(targetIndex, 0, movedPin);
        } else {
            newPins.push(movedPin);
        }

        this.context.workspaceState.update('pins', newPins);
        this.refresh(newPins);
    }

    refresh(pins: TPin[]) {
        this.pins = pins;
        this._onDidChangeTreeData.fire();
    }
}

export class Pin extends vscode.TreeItem {
    public readonly resourceUri: vscode.Uri;
    constructor(
        public readonly label: string,
        public readonly fileLocation: string,
        public readonly type: 'file' | 'folder',
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly alias?: string, // Add alias
    ) {
        // Use alias for the display label, but keep fileLocation for the functionality
        super(alias?.trim() || label, collapsibleState);
        this.resourceUri = vscode.Uri.file(this.fileLocation);
        this.tooltip = `${this.fileLocation}`;
        this.iconPath = this.type === 'folder' ? vscode.ThemeIcon.Folder : undefined;
        this.contextValue = 'pin'; // Add contextValue to enable command binding
        this.label = alias || label; // Use alias if available

        const relativePath = this.getRelativePathToWorkspace(this.fileLocation);
        this.description = relativePath ? relativePath : this.fileLocation; // Use relative path as description

        // Set the command to open files or reveal folders
        this.command =
            this.type === 'file'
                ? {
                      title: 'Open File',
                      command: 'vscode.open',
                      arguments: [vscode.Uri.file(this.fileLocation)], // Ensure correct file location is passed
                  }
                : {
                      title: 'Show Folder',
                      command: 'quick-pin.revealAndOpen',
                      arguments: [vscode.Uri.file(this.fileLocation)], // Ensure correct folder location is passed
                  };
    }

    // Method to get the relative path of the fileLocation to its workspace
    private getRelativePathToWorkspace(fileLocation: string): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const workspacePath = folder.uri.fsPath;

                // Check if the fileLocation is inside this workspace folder
                if (fileLocation.startsWith(workspacePath)) {
                    // Get the relative path by subtracting the workspace path from the fileLocation
                    return path.relative(workspacePath, fileLocation);
                }
            }
        }

        return undefined; // Return undefined if not inside a workspace
    }
}
