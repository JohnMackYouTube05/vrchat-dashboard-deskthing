import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, createWriteStream } from "node:fs"
import { copyFile, mkdir, access, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { fileURLToPath } from "node:url"
import path from "path";
import {CookieJar} from 'tough-cookie'
import  axios  from 'axios'
import * as fs from 'fs';
import wrapper  from 'axios-cookiejar-support';
import * as vrchat from 'vrchat'

const IMAGE_PATH =
  process.env.DESKTHING_ENV === "development"
    ? join(process.cwd(), "images")          // keep things tidy in dev
    : join(__dirname, "../images");


//Copied from Riprod's image program.
export const saveImageReferenceFromURL = async (url: string, userId: string, axiosInstance: any): Promise<string | undefined> => {
    try {
        if (url.startsWith('https')) {
            if (userId != null)
                downloadImage(url, IMAGE_PATH + `/${userId}.png`, axiosInstance).then( async filePath => {
                    return await handleFile(filePath);
                });
            /*else if (worldId != null)
                downloadImage(url, IMAGE_PATH + `/${worldId}.png`).then(async filePath => {
                    return await handleFile(filePath);
                });*/
            
        }
        return await handleFile(url)
    } catch (error) {
        console.error('Error saving image reference: ', error)
        return
    }
}

//Downloads an image from VRChat's servers, and saves it to the application's images directory, for use locally on CarThing.
export const downloadVRCImage = async (url: string, jar: CookieJar, loginConfig: vrchat.Configuration, Id:string) =>
{
  try {
   const client = axios.create({
    jar,
    withCredentials: true,
    headers: {
      'User-Agent': `VRChatDashboard-DeskThing/0.11.0 ${loginConfig.username}`
    }
   });

   await client.get('https://api.vrchat.cloud/api/1/auth/user'); //Get Cloudflare cookies
   const response = await client.get(url, {responseType: 'stream'});
   const filename = path.basename(new URL(url).pathname);
   ensureImagesDir();
   const destPath = path.join(IMAGE_PATH, `${Id}.png`);
   const writer = fs.createWriteStream(destPath);
   //Save image
   response.data.pipe(writer);

   await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
   });
   const destUrl = await handleFile(destPath);
   console.log(`Profile picture saved to ${destPath}`);
   return destUrl;
  } catch (err) {
    console.error("Error while downloading image: ", err);
  }
}
// make sure the folder exists *synchronously* before we write
function ensureImagesDir() {
  if (!existsSync(IMAGE_PATH)) {
    mkdirSync(IMAGE_PATH, { recursive: true });
  }
}


const ensureFileExists = () => {
    if (!existsSync(IMAGE_PATH)) {
        console.debug('Creating images directory');
        mkdir(IMAGE_PATH, { recursive: true });
    }
}


//Converts image input to a Buffer object
async function toBuffer(input: any): Promise<Buffer> {
  /* Buffer => return as‑is */
  if (Buffer.isBuffer(input)) return input;

  /* Uint8Array / TypedArray */
  if (input instanceof Uint8Array) return Buffer.from(input);

  /* ArrayBuffer  */
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));

  /* { buffer: Buffer }  (e.g. Multer) */
  if (input?.buffer && Buffer.isBuffer(input.buffer)) return input.buffer;

  /* object with arrayBuffer(): Promise<ArrayBuffer>  (e.g. Blob/File) */
  if (typeof input?.arrayBuffer === "function") {
    return Buffer.from(new Uint8Array(await input.arrayBuffer()));
  }

  /* Nothing matched */
  throw new TypeError(
    "Unsupported binary type. Provide a Buffer, ArrayBuffer, Uint8Array, or { buffer: Buffer }."
  );
}

/**
 * Saves an in‑memory binary image to disk and returns the local URL.
 *
 * @param data  – the binary (Buffer, ArrayBuffer, etc.)
 * @param originalName – something ending in .png / .jpg etc.  Used for the extension.
 */
export async function saveImageFromFileObject(
  data: unknown,
  originalName: string
): Promise<string> {
  ensureImagesDir();

  /**
   * 1️⃣ Normalise to Buffer
   */
  const fileBuffer = await toBuffer(data);   // <‑‑ throws if not convertible

  /**
   * 2️⃣ Validate/clean the filename & extension
   */
  const ext = extname(originalName).toLowerCase().slice(1); // "png"
  const OK = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"];
  if (!OK.includes(ext)) {
    throw new Error(
      `Unsupported image format “.${ext}”. Allowed: ${OK.join(", ")}`
    );
  }

  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const uniqueName = `${randomUUID()}_${safeName}`;
  const destination = join(IMAGE_PATH, uniqueName);

  /**
   * 3️⃣ Write and hand back the URL
   */
  await writeFile(destination, fileBuffer);

  return `http://localhost:8891/resource/image/image/${uniqueName}`;
}

//Check if file exists on the local disk.
async function fileExists(filePath) {
  try {
    await access(filePath); // Checks if the file exists
    return true; // File exists
  } catch (error) {
    if (error.code === 'ENOENT') { // ENOENT indicates file not found
      return false; // File does not exist
    }
    throw error; // Handle other potential errors
  }
}


//Previous attempt at downloading VRC images
async function downloadImage(imageUrl, downloadPath, axiosInstance) {
  if (await fileExists(downloadPath)) {
    console.log(`File already exists at ${downloadPath}. Skipping download.`);
    return; // File exists, no need to download
  }

  try {
    const response = await axiosInstance.get(imageUrl, {
        responseType: 'arraybuffer',
    }); // Fetch the image from the URL
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`); // Handle HTTP errors
    }
    const buffer = Buffer.from(response.data);
    const savedUrl = await saveImageFromFileObject(buffer, downloadPath);
    const fileStream = createWriteStream(downloadPath); // Create a writable stream

    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream); // Pipe the response body to the file stream
      response.body.on('error', reject); // Handle errors during piping
      fileStream.on('finish', resolve); // Resolve the promise when the stream finishes
    });

    console.log(`Image downloaded successfully to ${downloadPath}`);
    return downloadPath;
  } catch (error) {
    console.error(`Failed to download image from ${imageUrl}: ${error}`); // Handle download errors
  }
}

//Handles the file after it is finished downloading and returns the appropriate URL for Car Thing to load in from.

const handleFile = async (filePath: string): Promise<string> => {
    ensureFileExists()

    if (!existsSync(filePath)) {
        console.error(`Unable to find image path at ${filePath}`)
        return ''
    }

    const fileExtension = filePath.split('.').pop()?.toLowerCase()
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff']

    if (!fileExtension || !imageExtensions.includes(fileExtension)) {
        console.error(`File is not a supported image format: ${fileExtension}. Only supports ${imageExtensions.join(', ')}`)
        return ''
    }

    const originalName = filePath.split(/[\\/]/).pop() || ''
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueName = `${sanitizedName}`

    const destinationPath = join(IMAGE_PATH, uniqueName)
    await copyFile(filePath, destinationPath)

    return `http://localhost:8891/resource/image/vrchat/${uniqueName}`
}