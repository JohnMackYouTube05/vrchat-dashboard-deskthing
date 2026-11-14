import './UserCard.css';
import { profileImages, type DashboardUser } from '../types/profile';
import ProfileImage from './ProfileImage';

const statusClassMap: Record<string, string> = {
  'join me': 'bg-blue-300', active: 'bg-lime-400',
  'ask me': 'bg-orange-400', busy: 'bg-red-500',
};

function getFriendlyStatusDescription(status: string): string {
  switch (status) {
    case 'offline': return 'Active on Website';
    case 'private': return 'In a Private World';
    case 'traveling': return 'Traveling to New Instance';
    default: return status;
  }
}

export default function UserCard({ user, worldName, imageUrl }: { user: DashboardUser; worldName?: string; imageUrl?: string }) {
  const location = user.location || 'private';
  const locationText = worldName || (location.startsWith('wrld_') ? 'World details unavailable' : getFriendlyStatusDescription(location));
  return (
    <div className="bg-blue-900 shadow-inner rounded-xl shadow p-4 w-full max-w-xs text-center space-y-2">
      <ProfileImage sources={[imageUrl, ...profileImages(user)]} name={user.displayName} className="w-20 h-20 object-cover rounded-full shadow-lg mx-auto" />
      <div className="flex items-center justify-center gap-2 font-bold text-lg text-white">
        <span className={`w-4 h-4 rounded-full ${statusClassMap[user.status] ?? 'bg-gray-400'}`} title={user.status} />
        <span>{user.displayName}</span>
      </div>
      <div className="text-white text-sm">{locationText}</div>
      <div className="italic text-white text-sm min-h-[1.2em]">{user.statusDescription}</div>
    </div>
  );
}
