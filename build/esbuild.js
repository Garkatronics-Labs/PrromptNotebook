import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);
const isProd = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const external = [
    'vscode',
    'bufferutil',
    'utf-8-validate',
    'node-pty',
    'profoundjs-node-pty',
    '@xterm/xterm',
    'xterm',
    '@xterm/addon-serialize',
    'xterm-addon-serialize',
    'node-kernel'
];

const baseConfig = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    sourcemap: true,
    minify: isProd,
    external,
    logLevel: 'info'
};

async function build() {
    const contexts = await Promise.all([
        esbuild.context({
            ...baseConfig,
            entryPoints: { extension: './src/extension/index.ts' },
            outfile: path.join(rootDir, 'out', 'extension', 'index.cjs')
        }),
        esbuild.context({
            ...baseConfig,
            entryPoints: { server: './src/extension/server/index.ts' },
            outfile: path.join(rootDir, 'out', 'extension', 'server', 'index.cjs')
        }),
        esbuild.context({
            ...baseConfig,
            entryPoints: { test: './src/test/runTest.ts' },
            outfile: path.join(rootDir, 'out', 'test', 'runTest.cjs')
        })
    ]);

    if (isWatch) {
        await Promise.all(contexts.map((ctx) => ctx.watch()));
        console.log('Watching...');
    } else {
        await Promise.all(contexts.map((ctx) => ctx.rebuild()));
        await Promise.all(contexts.map((ctx) => ctx.dispose()));
    }
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
