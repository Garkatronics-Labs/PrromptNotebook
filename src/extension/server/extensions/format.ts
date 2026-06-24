import * as util from 'util';
import { DisplayData } from '../types';

export async function formatValue(value: unknown, requestId: string): Promise<DisplayData | undefined> {
    if (typeof value === 'undefined') {
        return;
    } else if (typeof value === 'object' && value !== null) {
        return {
            type: 'text',
            requestId,
            value: util.inspect(value, { colors: true, compact: false })
        };
    }
    return { type: 'text', value: String(value), requestId };
}
