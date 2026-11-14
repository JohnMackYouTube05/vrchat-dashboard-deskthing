import { useNavigate } from 'react-router-dom';
import UserCard from '../components/UserCard';
import { useState, useEffect, useRef, useCallback } from 'react';
import { dt } from '../deskthing';
import { useUserContext } from '../context/UserContext';
import type { CombinedUser } from '../types/types';

export default function HomePage() {
  const { users } = useUserContext();
  const [username, setUsername] = useState('user');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const finish = useCallback(() => {
    clearTimeout(timeout.current);
    setLoading(false);
  }, []);

  const requestFriends = useCallback(() => {
    clearTimeout(timeout.current);
    setLoading(true);
    setMessage('Connecting to VRChat...');
    // Set the timer before sending; a fast response can clear it immediately.
    timeout.current = setTimeout(() => {
      setLoading(false);
      setMessage('The server has not responded yet. Check DeskThing, then try again.');
    }, 45_000);
    try { dt.send({ type: 'vrc_request', request: 'vrc_friendslist' }); }
    catch {
      finish();
      setMessage('Could not contact DeskThing. Check the desktop app.');
    }
  }, [finish]);

  useEffect(() => {
    const removeFriends = dt.on('vrc_friendslist', data => {
      finish();
      try {
        const friends: CombinedUser[] = JSON.parse(data.payload);
        if (!Array.isArray(friends)) throw new Error('Invalid friends list');
        setMessage(friends.length ? '' : 'No friends are online right now.');
      } catch { setMessage('DeskThing returned an unreadable friends list. Try again.'); }
    });
    const removeStatus = dt.on('vrc_status', data => setMessage(data.payload));
    const removeError = dt.on('vrc_error', data => { finish(); setMessage(data.payload); });
    const removeUsername = dt.on('logged_in_username', data => setUsername(data.payload));
    requestFriends();
    return () => {
      clearTimeout(timeout.current);
      removeFriends();
      removeStatus();
      removeError();
      removeUsername();
    };
  }, [finish, requestFriends]);

  const hour = new Date().getHours();
  const greeting = hour < 5 || hour >= 17 ? 'evening' : hour >= 12 ? 'afternoon' : 'morning';
  return (
    <div className="bg-cyan-950 min-h-screen w-screen flex flex-col items-center p-4">
      <div className="flex items-center justify-between gap-4 w-full text-white">
        <p className="font-bold text-2xl">Good {greeting}, {username}!</p>
        <button disabled={loading} onClick={requestFriends}
          className="p-3 bg-neutral-700 rounded-lg text-xl disabled:bg-neutral-800 disabled:text-zinc-400">
          {loading ? 'Loading...' : 'Refresh Friends'}
        </button>
      </div>
      <p role="status" className="text-white text-xl mt-2">{message}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 self-start">
        {users.map(friend => (
          <div key={friend.user.id} onClick={() => navigate(`/user/${encodeURIComponent(friend.user.displayName)}`)} className="cursor-pointer">
            <UserCard user={friend.user} worldName={friend.world?.name} imageUrl={friend.profile?.imageUrl || friend.imageUrl} />
          </div>
        ))}
      </div>
    </div>
  );
}
