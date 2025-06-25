//import React from 'react';
import './UserCard.css'; // We'll define this CSS below
import {LimitedUser} from 'vrchat';
import {createDeskThing} from '@deskthing/client'
//import { DESKTHING_EVENTS } from '@deskthing/types';
import { useEffect, useState } from "react";
const statusClassMap = {
  "join me": 'joinme',
  "active": 'online',
  "ask me": 'askme',
  "busy": 'dnd'
};

const deskThing = createDeskThing();
async function getWorldData(WorldId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    deskThing.fetch(
      { type: 'get', request: 'world', payload: { world: WorldId } },
      { type: 'world' },
      (data) => {
        if (data) {
          console.log("World data received from server.");
          console.log(data.payload);
          resolve(data.payload); // ✅ resolve promise with payload
        } else {
          reject(new Error("No data received"));
        }
      }
    );
  });
}

function getFriendlyStatusDescription(status: string) : string
{
  switch (status)
  {
    case 'offline':
      return 'Active on Website'
    case 'private':
      return 'In a Private World'
    case 'traveling':
      return 'Traveling to New Instance'
    default:
      return status
  }
}
/*deskThing.on('get', (data) => {
          if (data.type == 'world')
          {

          }
});*/


/*const UserCard = ({ user }) => {
  const statusClass = statusClassMap[user.status] || '';
  const statusColors = {
    joinme: "bg-blue-300",
    online: "bg-lime-400",
    askme: "bg-orange-400",
    dnd: "bg-red-500",
  };
  return (
    <div id="user-card" className="bg-white rounded-xl shadow p-4 w-56 text-center space-y-2">
      <img src={user.profilePicOverrideThumbnail} alt={`${user.displayName}'s profile` } className="w-20 h-20 rounded-full mx-auto"/>
      <div id="user-header" className="flex items-center justify-center gap-2 font-bold text-lg">
        <span
          className={`w-4 h-4 rounded-full ${statusColors[statusClass]}`}
          title={user.status.replace(/^\w/, c => c.toUpperCase())}
        ></span>
        <span>{user.displayName}</span>
      </div>
      <div id="instance" className="text-gray-500 text-sm">{(user.location == "offline" || user.location == "private" || user.location == "traveling") ? user.location : getWorldData(user.location)['name']}</div> 
      <div id="status-message" className="italic text-gray-600 text-sm min-h-[1.2em]">{user.statusMessage}</div>
    </div>
  );
}; v1*/


const UserCard = ({ user }: { user: LimitedUser }) => {
  const statusClass = statusClassMap[user.status] ?? "";
  const statusColors = {
    joinme: "bg-blue-300",
    online:  "bg-lime-400",
    askme:   "bg-orange-400",
    dnd:     "bg-red-500",
  };
  // ⬇️  local state for whatever text we want to show
  const [locationText, setLocationText] = useState<string>("Pulling location data...");

  useEffect(() => {
    let cancelled = false;

    async function resolveLocation() {
      // Simple cases first
      if (["offline", "private", "traveling"].includes(user.location ? user.location : "private")) {
        setLocationText(getFriendlyStatusDescription(user.location ? user.location : "private"));
        return;
      }

      // Otherwise we have a world ID → fetch world data
      try {
        setLocationText("…");                  // optional loading placeholder
        const world = await getWorldData(user.location ? user.location : ""); // { name: string }
        if (!cancelled) setLocationText(JSON.parse(world).name);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLocationText("Unknown world");
      }
    }

    resolveLocation();
    // 🔒 cleanup so we don’t try to set state after unmount
    return () => {
      cancelled = true;
    };
  }, [user.location]); // rerun when the user moves to a new location

  /* ---------------------------------------------------------------- */

  return (
    <div className="bg-blue-900 inset-shadow-blue-500 shadow-blue-300 shadow-inner rounded-xl shadow p-4 w-full max-w-xs text-center space-y-2">
      <img
        src={user.profilePicOverride} /*{
          !user.profilePicOverrideThumbnail
            ? user.currentAvatarThumbnailImageUrl
            : user.profilePicOverrideThumbnail
        }*/
        alt={`${user.displayName}'s profile`}
        className="w-20 h-20 rounded-full shadow-gray-900 shadow-lg mx-auto"
      />

      <div className="flex items-center justify-center gap-2 font-bold text-lg text-white">
        <span
          className={`w-4 h-4 rounded-full ${statusColors[statusClass]}`}
          title={user.status[0].toUpperCase() + user.status.slice(1)}
        />
        <span className="text-white">{user.displayName}</span>
      </div>

      {/* ✅ will update automatically when locationText changes */}
      <div className="text-white text-sm">{locationText}</div>

      <div className="italic text-white text-sm min-h-[1.2em]">
        {user.statusDescription}
      </div>
    </div>
  );
};



export default UserCard;
