import { mkdir, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AxiosInstance } from 'axios';

const IMAGE_PATH = process.env.DESKTHING_ENV === 'development'
  ? join(process.cwd(), 'images')
  : join(dirname(fileURLToPath(import.meta.url)), '../images');

const extensions: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
};

/** Reuse session cookies; image downloads must never initiate authentication. */
export async function downloadVRCImage(url: string, client: AxiosInstance, id: string, directory = IMAGE_PATH): Promise<string | undefined> {
  let temporary: string | undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return;
    const response = await client.get(url, { responseType: 'stream', timeout: 10_000 });
    const contentType = String(response.headers['content-type'] ?? '').split(';')[0].toLowerCase();
    const extension = extensions[contentType];
    if (!extension) { response.data.destroy(); return; }
    await mkdir(directory, { recursive: true });
    const revision = createHash('sha256').update(url).digest('hex').slice(0, 12);
    const filename = `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${revision}.${extension}`;
    temporary = join(directory, `${filename}.${randomUUID()}.tmp`);
    await pipeline(response.data, createWriteStream(temporary));
    await rename(temporary, join(directory, filename));
    temporary = undefined;
    return `http://localhost:8891/resource/image/vrchat/${filename}`;
  } catch {
    return undefined; // Images are optional; don't log request objects with cookies.
  } finally {
    if (temporary) await rm(temporary, { force: true }).catch(() => {});
  }
}
