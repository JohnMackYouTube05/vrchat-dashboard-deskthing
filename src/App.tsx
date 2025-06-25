import React, { useEffect, useState } from 'react'
//import * as vrchat from 'vrchat'; //Import unofficial VRChat API
import { createDeskThing } from "@deskthing/client"
//import { ILimitedUserDTO, OurLimitedUser } from './types/types';
import UserCard from './components/UserCard'
import { DESKTHING_EVENTS, ClientToDeviceData } from '@deskthing/types';
const dt = createDeskThing<ToClientData, GenericTransitData>();
//zconst users = dt.fetch(, {type: "friendslist", })
type ToClientData = {
	type: string;
	payload: string;
};

enum VRC_REQUESTS {
	GETLIST = "vrc_friendslist",
  GET = "get"
}

type GenericTransitData = {
	type: VRC_REQUESTS.GET;
	request: string;
	payload?: string;
};

const App: React.FC = () => {
  
  async function getCurrentUsername(): Promise<any> {
    return new Promise((resolve, reject) => {
      dt.fetch(
        { type: VRC_REQUESTS.GET, request: 'logged_in_username' },
        { type: 'logged_in_username' },
        (data) => {
          if (data) {
            console.log("Username received from server.");
            console.log(data.payload);
            setUsername(data.payload);
            resolve(data.payload); // ✅ resolve promise with payload
          } else {
            reject(new Error("No username received"));
          }
        }
      );
    });
  }

  const handleFriendsList = async () => {
    setIsLoading(true);
    setDebug("📡 Trying to contact server...");
  
    try {
      // Send the request
      dt.send({
        type: VRC_REQUESTS.GET,
        request: "vrc_friendslist"
      });
  
      // Clear existing timeout if any
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
  
      // Set a new timeout
      timeoutRef = setTimeout(() => {
        setDebug("⏱️ Timed out!\nDid you log into VRChat?");
        setIsLoading(false);
      }, 10000);
    } catch (err) {
      console.error("[VRCHAT CLIENT] ❌ dt.send failed:", err);
      setDebug("Failed to send request to server.");
      setIsLoading(false);
    }
  };
  
    const [users, setUsers] = useState<string | null>(null);
    const [loggedInUsername, setUsername] = useState<string>("user");
    
      const [loading, setIsLoading] = useState(false);
      const [debug, setDebug] = useState("");
      let timeoutRef: NodeJS.Timeout | null = null;
      useEffect(() => {
        // Flag to prevent setting state after unmount
        let cancelled = false;
        async function resolveUsername()
        {
          try {
          const user = await getCurrentUsername();
          setUsername(user);
          }
          catch (err)
          {
            console.error("Error while fetching username:", err)
          }
        }
        
        // Setup listener BEFORE sending the request
         const removeListener = dt.on("vrc_friendslist", (data) => {
          if (cancelled) return;
      
          setIsLoading(false);
          if (timeoutRef) {
            clearTimeout(timeoutRef);
          }
      
          setDebug("✅ Received data from server");
      
          if (data.payload) {
            // Assume the payload is already JSON-serializable
            const friends = data.payload;
            setUsers(friends);
          } else {
            setDebug("⚠️ Payload was empty or malformed.");
          }
        }); 
      
        // Send request AFTER listener is ready
        setDebug("📡 Requesting friends list...");
        setIsLoading(true);
        resolveUsername();
        handleFriendsList();
      }, []);

      
  function getTimeGreeting() : string
  {
     const now: Date = new Date(); //Get current date/time
     let hourOfDay = now.getHours(); //Get current hour of the day
     if (hourOfDay < 5 || hourOfDay >= 17) { return "evening"; } //If it's between 5 PM and 4:59 AM, it's evening/night.
     else if (hourOfDay >= 12 && hourOfDay <= 16) { return "afternoon"; } //If it's between 12 PM and 4 PM, it's afternoon.
     else { return "morning"; } //Otherwise, it's morning time. (5 AM - 11:59 AM)
  }
 



  



  //fetchInitialData();
   /* return (
        <div className="bg-gray-20 p-6 font-sans">
          <h1 className="text-2xl font-bold mb-6">Good evening, CherryRetriever</h1>
          {users ? (
            <div id="user-container" className="flex flex-wrap gap-6">
            {users?.map((user, index) => (
              <UserCard key={index} user={user} />
            ))}
          </div>
          ) : (
            <div className="bg-gray-20 p-6 font-sans">
              <h1 className="text-2xl font-bold mb-6">Good evening, CherryRetriever</h1>
            
          )}
        </div>
      );
    };*/
    return (
      <div className="bg-cyan-950 w-screen flex justify-center items-center">
        {users ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 items-center self-start">
            {JSON.parse(users).map(u => (
              <UserCard key={u.id} user={u} />
            ))}
          </div>
          /*JSON.parse(users).map((user, index) => (
            <UserCard key={index} user={user} />
          ))*/
         
        ) : (
          <div className="flex items-center justify-center flex-col">
            <p className="font-bold text-5xl text-white">{`Good ${getTimeGreeting()}, ${loggedInUsername}!`}</p>
            <button
              disabled={loading}
              className="p-4 flex items-center disabled:bg-neutral-800 transition-colors disabled:text-zinc-200 bg-neutral-700 rounded-lg mt-5 text-4xl text-white text-semibold"
              onClick={handleFriendsList}
            >
              <p className="mr-2">Request Image</p>
              {loading && (
                <div className="animate-spin border-t-2 w-10 h-10 rounded-full" />
              )}
            </button>
            <p className="font-mono text-white text-2xl mt-2">{debug}</p>
          </div>
        )}
      </div>
    );
    
  }
export default App;
