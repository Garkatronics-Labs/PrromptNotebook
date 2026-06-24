import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ExtensionRootDir = path.dirname(__dirname);
export const isWindows = /^win/.test(process.platform);
export const isCI = process.env.TF_BUILD !== undefined;

export default {
    ExtensionRootDir,
    isWindows,
    isCI
};
