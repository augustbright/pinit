import { statSync } from 'fs';
import * as vscode from 'vscode';

import { TPin } from './types';
import { Pin, PinProvider } from './PinProvider';

import path = require('path');

export function activate(context: vscode.ExtensionContext) {
    const pinProvider = new PinProvider(context);

    // Register the tree view with drag and drop enabled
    vscode.window.createTreeView('pins', {
        treeDataProvider: pinProvider,
        dragAndDropController: pinProvider, // Enable drag-and-drop
    });

    vscode.commands.executeCommand('setContext', 'quick-pin.showTreeView', true);

    const pinDisposable = vscode.commands.registerCommand(
        'quick-pin.pinItem',
        (selectedItem: { path: string; scheme: 'file' | 'folder' | string; _fsPath: string }) => {
            const existingState: TPin[] | undefined = context.workspaceState.get('pins');
            if (existingState && existingState.some(i => i.fileLocation === selectedItem.path)) {
                return vscode.window.showInformationMessage(
                    `A pin for this ${selectedItem.scheme} already exists.`,
                );
            }
            const newPins: TPin[] = [
                ...(existingState || []),
                {
                    label: path.parse(selectedItem.path).base,
                    type: statSync(selectedItem._fsPath).isDirectory() ? 'folder' : 'file',
                    fileLocation: selectedItem.path,
                },
            ];
            context.workspaceState.update('pins', newPins);
            pinProvider.refresh(newPins);
        },
    );

    const deleteDisposable = vscode.commands.registerCommand('quick-pin.deletePin', e => {
        const existingState: TPin[] | undefined = context.workspaceState.get('pins');
        const newPins = existingState?.filter(p => p.fileLocation !== e.fileLocation);
        if (!newPins) {
            return;
        }
        context.workspaceState.update('pins', newPins);
        pinProvider.refresh(newPins);
    });

    const renamePinDisposable = vscode.commands.registerCommand(
        'quick-pin.renamePin',
        async (pin: Pin) => {
            const newAlias = await vscode.window.showInputBox({
                prompt: `Enter a new name for the pin '${pin.label}'`,
                value: pin.alias || pin.label, // Pre-fill the input box with the current label or alias
            });

            if (!newAlias) {
                return; // User cancelled the input
            }

            const existingState: TPin[] | undefined = context.workspaceState.get('pins');
            if (!existingState) return;

            const updatedPins = existingState.map(p => {
                if (p.fileLocation === pin.fileLocation) {
                    return { ...p, alias: newAlias }; // Update alias for the specific pin
                }
                return p;
            });

            context.workspaceState.update('pins', updatedPins);
            pinProvider.refresh(updatedPins);
        },
    );
    const deleteAllPins = vscode.commands.registerCommand('quick-pin.deleteAllPins', () => {
        context.workspaceState.update('pins', []);
        pinProvider.refresh([]);
    });

    const revealDisposable = vscode.commands.registerCommand(
        'quick-pin.revealAndOpen',
        (uri: vscode.Uri) => {
            // Reveal the file/folder in the explorer
            vscode.commands.executeCommand('revealInExplorer', uri);
            vscode.commands.executeCommand('list.expand'); // Expand the folder if applicable
        },
    );
    context.subscriptions.push(revealDisposable);

    context.subscriptions.push(renamePinDisposable);
    context.subscriptions.push(pinDisposable);
    context.subscriptions.push(deleteDisposable);
    context.subscriptions.push(deleteAllPins);
}

export function deactivate() {}
