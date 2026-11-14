import axios, { type AxiosInstance } from 'axios';
import type { DashboardUser, ProfileDetails } from '../src/types/profile';
import { profileImages } from '../src/types/profile';
import { downloadVRCImage } from './utils';

type Read = <T>(operation: () => Promise<T>) => Promise<T>;
type Download = typeof downloadVRCImage;

export async function loadProfile(id: string, client: AxiosInstance, read: Read, download: Download = downloadVRCImage): Promise<ProfileDetails> {
  const profile = await read(async () => {
    try { return (await client.get<DashboardUser>(`/profile/${encodeURIComponent(id)}`)).data; }
    catch (error) {
      // Older API deployments put bios on the user record instead.
      if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
      return (await client.get<DashboardUser>(`/users/${encodeURIComponent(id)}`)).data;
    }
  });
  if (profile.id !== id) throw new Error('Profile response did not match requested user.');
  let imageUrl: string | undefined;
  for (const image of profileImages(profile)) {
    imageUrl = await download(image, client, `${id}_profile`);
    if (imageUrl) break;
  }
  return {
    id, bio: typeof profile.bio === 'string' ? profile.bio : undefined,
    pronouns: typeof profile.pronouns === 'string' ? profile.pronouns : undefined,
    imageUrl,
  };
}
