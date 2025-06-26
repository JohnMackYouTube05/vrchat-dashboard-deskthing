import {User, World, Instance, InstanceType} from 'vrchat';
//import { createDeskThing } from '@deskthing/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserContext } from '../context/UserContext';
import {getWorldData, getFriendlyStatusDescription} from '../components/UserCard';
import { useEffect, useState } from "react";

//const deskThing = createDeskThing();
/*THIS FUNCTIONALITY IS NOT FINISHED YET. I'LL BE FINISHING IT SOON.*/
const statusClassMap = {
  "join me": 'joinme',
  "active": 'online',
  "ask me": 'askme',
  "busy": 'dnd'
};

const ViewUser = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const { users } = useUserContext();
    console.log("CombinedUsers:", users);
    const user = users.find(
        (u) => u.user.displayName.toLowerCase() === username?.toLowerCase()
    );
    if (!user) {
        return (
        <div className="p-6 text-red-600">
            <p>User not found.</p>
            <button
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 underline"
            >
            ← Go Back
            </button>
        </div>
        );
    }
    const world = user?.world;
    const instance = user?.instance;
    const statusClass = statusClassMap[user ? user.user.status : "active"] ?? "";
    const statusColors = {
        joinme: "bg-blue-300",
        online:  "bg-lime-400",
        askme:   "bg-orange-400",
        dnd:     "bg-red-500",
    };
    

    const [worldThumbnail, setWorldThumbnail] = useState<string>();
    const [profilePicture, setProfilePicture] = useState<string>();
    
    useEffect(() => {
        setWorldThumbnail(world ? world.imageUrl : "No image found.");
    });
    return (
            <div className="flex items-center justify-center flex-row">
                <div className="grid grid-cols-1 grid-rows-3 bg-blue-900 rounded-xl max-w-3xl grid-rows-subgrid h-fit">
                        <button className="inline justify-self-start" onClick={() => navigate('/')}>
                                <svg xmlns="http://www.w3.org/2000/svg" id="material-design-back-arrow" fill="white"  viewBox="0 0 24 24" className="w-6 h-6">
                                    <path xmlns="http://www.w3.org/2000/svg" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                                </svg>
                                <p className="inline text-white text-medium font-medium h-6">Back to Friends List</p>
                            
                        </button>
                    <div className="flex flex-row gap-2">
                        <img className="rounded-3xl p-3" id="profile-picture" src={user.user.profilePicOverride}></img>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-center gap-2 font-bold text-lg">
                                <span className={`w-4 h-4 rounded-full ${statusColors[statusClass]}`} title="Join me" id="status-circle"></span>
                                <p className="font-bold text-4xl space-y-20 text-blue-400 text" id="display-name">{user.user.displayName}</p>
                            </div>
                            <span className="font-semibold text-2xl text-white text-center" id="pronouns">{user.user.pronouns}</span> 
                            <span className="font-medium text-lg text-white text-center h-6 max-h-12" id="status-description">{user.user.statusDescription}</span>                             
                            <p className="font-normal text-medium text-white space-x-5" id="bio">{user.user.bio}</p>
                        </div>
                    </div>
                    <div className="grid grid-rows-1 grid-cols-1 max-w-full space-x-3 p-2">
                        <div className="bg-gray-800 flex rounded-xl p-3 w-full h-44">
                            <img className="rounded-lg w-52 h-32 object-cover" src={worldThumbnail}></img> 
                            <div className="p-1 grid grid-rows-4 grid-cols-1">
                                <p className="text-4xl text-white font-bold space-y-8" id="worldName">{world ? world.name : statusClass}</p>
                                <p className="text-2xl space-y-2 text-white font-semibold" id="instanceType">{instance?.type.toString()}</p> 
                                
                                <div className={`flex grid-rows-1 grid-cols-2 ${world ? "visible" : "invisible"}`}> 
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6" id="material-design-person-icon">
                                        <path xmlns="http://www.w3.org/2000/svg" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                    <p className={`text-white text-medium ${world ? "visible" : "invisible"}`} id="playerCount">
                                    {`${world?.occupants} currently playing`}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 grid-rows-1 h-1/2 w-1/4 gap-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`w-6 h-6 ${instance ? instance.platforms.standalonewindows > 0 ? "visible" : "invisible" : "invisible"}`} fill="cyan" id="is-pc-world">
                                        <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v2h12v-2l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
                                    </svg>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="lime" viewBox="0 0 24 24" className={`w-6 h-6 ${instance ? instance.platforms.android > 0 ? "visible" : "invisible" : "invisible"}`} id="is-android-world">
                                        <g>
                                            <g>
                                                <path d="M0,0h24v24H0V0z" fill="none"/>
                                            </g>
                                        </g>
                                        <g>
                                            <g>
                                                <path d="M17.6,9.48l1.84-3.18c0.16-0.31,0.04-0.69-0.26-0.85c-0.29-0.15-0.65-0.06-0.83,0.22l-1.88,3.24 c-2.86-1.21-6.08-1.21-8.94,0L5.65,5.67c-0.19-0.29-0.58-0.38-0.87-0.2C4.5,5.65,4.41,6.01,4.56,6.3L6.4,9.48 C3.3,11.25,1.28,14.44,1,18h22C22.72,14.44,20.7,11.25,17.6,9.48z M7,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25S8.25,13.31,8.25,14C8.25,14.69,7.69,15.25,7,15.25z M17,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25s1.25,0.56,1.25,1.25C18.25,14.69,17.69,15.25,17,15.25z"/>
                                            </g>
                                        </g>
                                    </svg>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 49 60" fill="white" className={`w-6 h-6 ${instance?.platforms.ios ?  "visible" : "invisible"}`} id="is-ios-world">
                                        <path d="m 47.616807,20.597076 c -0.35043,0.27189 -6.53741,3.75811 -6.53741,11.50996 0,8.9663 7.8727,12.13833 8.10833,12.21688 -0.0362,0.19334 -1.25069,4.34418 -4.15084,8.57356 -2.58596,3.72186 -5.28673,7.43767 -9.39527,7.43767 -4.10854,0 -5.16589,-2.38658 -9.90884,-2.38658 -4.62211,0 -6.26553,2.46513 -10.02363,2.46513 -3.75811,0 -6.3803304,-3.44393 -9.3952804,-7.67331 C 2.8216066,47.773886 6.5820312e-6,40.058286 6.5820312e-6,32.735406 6.5820312e-6,20.989806 7.6370666,14.760526 15.153277,14.760526 c 3.99375,0 7.32288,2.62222 9.8303,2.62222 2.38658,0 6.10843,-2.77931 10.652,-2.77931 1.72196,0 7.90894,0.15709 11.98123,5.99364 z M 33.478597,9.6308963 c 1.87905,-2.22949 3.20828,-5.32298 3.20828,-8.41647 0,-0.42897996 -0.0362,-0.86400996 -0.11479,-1.214439962109 C 33.514847,0.11478634 29.877577,2.0361363 27.684337,4.5798063 c -1.72196,1.9576 -3.32913,5.05109 -3.32913,8.1868697 0,0.47128 0.0786,0.94255 0.1148,1.0936 0.19334,0.0363 0.50752,0.0785 0.82171,0.0785 2.74305,0 6.19302,-1.83676 8.18688,-4.3079197 z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

    )
}
export default ViewUser;