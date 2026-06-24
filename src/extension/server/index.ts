import yargs from 'yargs/yargs';
const argv = yargs(process.argv.slice(2)).argv;

import WebSocket from 'ws';
import { logErrorMessage, logMessage } from './logger';
import { execCode, initialize } from './codeExecution';
import { RequestType } from './types';
import { emitter, initializeComms, sendMessage } from './comms';
import { createDeferred } from '../coreUtils';

const ws = createDeferred<InstanceType<typeof WebSocket>>();

logMessage(`Started ${argv}`);
const port = 'port' in argv ? (argv.port as number) : 0;

initialize();

if (!port) {
    console.error(`Port not provided, got ${JSON.stringify(argv)}`);
    logErrorMessage(`Port not provided, got ${JSON.stringify(argv)}`);
    process.exit(1);
}

function connectToServer(port: number) {
    const url = `ws://localhost:${port}`;
    const connection = new WebSocket(url);
    logMessage('connecting');
    connection.on('open', () => {
        logMessage('initialized');
        ws.resolve(connection);
        initializeComms(connection);
    });
    connection.on('error', (error) => {
        logMessage('Error', error);
        logErrorMessage('WebSocket error', error);
    });
    connection.on('message', (e) => {
        try {
            if (typeof e === 'string') {
                const data: RequestType = JSON.parse(e);
                logMessage(`Kernel got message ${data.type}`);
                switch (data.type) {
                    case 'initialize':
                        sendMessage({ type: 'initialized', requestId: '' });
                        break;
                    case 'ping':
                        sendMessage({ type: 'pong', requestId: '' });
                        break;
                    case 'cellExec':
                        void execCode(data);
                        break;
                    default:
                        emitter.emit(`onMessage_${data.type}`, data);
                        logErrorMessage(`Unknown message ${data['type']}`);
                        break;
                }
            }
        } catch (ex) {
            logErrorMessage(`Error handling message ${e}`, ex);
        }
    });
}

connectToServer(port);
