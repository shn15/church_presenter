import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.m4v']);

function generateBackgroundsManifest(rootDir: string) {
  const bgsDir = path.resolve(rootDir, 'public', 'backgrounds');
  if (!fs.existsSync(bgsDir)) {
    fs.mkdirSync(bgsDir, {recursive: true});
  }
  const files = fs.readdirSync(bgsDir).sort((a, b) => a.localeCompare(b));
  const images: string[] = [];
  const videos: string[] = [];

  for (const file of files) {
    if (file === '.keep' || file === 'manifest.json' || file === 'README.txt') continue;
    const ext = path.extname(file).toLowerCase();
    const urlPath = `/backgrounds/${encodeURIComponent(file)}`;
    if (IMAGE_EXTS.has(ext)) {
      images.push(urlPath);
    } else if (VIDEO_EXTS.has(ext)) {
      videos.push(urlPath);
    }
  }

  const manifestPath = path.join(bgsDir, 'manifest.json');
  const nextJson = JSON.stringify({images, videos}, null, 2) + '\n';
  const prevJson = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf-8') : '';
  if (prevJson !== nextJson) {
    fs.writeFileSync(manifestPath, nextJson, 'utf-8');
  }
}

function backgroundsManifestPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'church-presenter-backgrounds-manifest',
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      generateBackgroundsManifest(root);
    },
    configureServer(server) {
      generateBackgroundsManifest(root);
      const bgsDir = path.resolve(root, 'public', 'backgrounds');
      server.watcher.add(bgsDir);
      const onFileChange = (filePath: string) => {
        if (
          filePath.startsWith(bgsDir) &&
          path.basename(filePath) !== 'manifest.json'
        ) {
          generateBackgroundsManifest(root);
        }
      };
      server.watcher.on('add', onFileChange);
      server.watcher.on('unlink', onFileChange);
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), backgroundsManifestPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
