import type { LimitedUser } from 'vrchat';

export type DashboardUser = LimitedUser & {
  iconUrl?: string;
  profilePicOverrideThumbnail?: string;
};

export type ProfileDetails = {
  id: string;
  bio?: string;
  pronouns?: string;
  imageUrl?: string;
};

// Support current icons and older API responses, in display preference order.
export function profileImages(user: Partial<DashboardUser>): string[] {
  return [...new Set([
    user.iconUrl, user.userIcon, user.profilePicOverrideThumbnail,
    user.profilePicOverride, user.currentAvatarThumbnailImageUrl, user.currentAvatarImageUrl,
  ].filter((url): url is string => typeof url === 'string' && !!url.trim()).map(url => url.trim()))];
}
