import {
  updateMessageBlock,
  // @ts-ignore
} from '../../../../../script.js';

export const extensionName = 'SillyTavern-Magic-Translation';
export const context = SillyTavern.getContext();

export function st_updateMessageBlock(messageId: number, message: object, { rerenderMessage = true } = {}): void {
  updateMessageBlock(messageId, message, { rerenderMessage });
}
