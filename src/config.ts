// @ts-ignore
import { Popup as STPopup } from '../../../../popup.js';

export const extensionName = 'SillyTavern-Character-Creator';
export const extensionVersion = '0.1.0';

/**
 * Sends an echo message using the SlashCommandParser's echo command.
 */
export async function st_echo(severity: string, message: string): Promise<void> {
  // @ts-ignore
  await SillyTavern.getContext().SlashCommandParser.commands['echo'].callback({ severity: severity }, message);
}

/**
 * @returns True if user accepts it.
 */
export async function st_popupConfirm(header: string, text?: string): Promise<boolean> {
  // @ts-ignore
  return await SillyTavern.getContext().Popup.show.confirm(header, text);
}

export { STPopup };
