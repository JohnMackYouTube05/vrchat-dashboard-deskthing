import { createDeskThing, DeskThing } from '@deskthing/server';
import { AppSettings, DESKTHING_EVENTS, SETTING_TYPES } from '@deskthing/types';
import { useState } from 'react';
import * as Desk from '@deskthing/types';
//import * as promptSync from 'prompt-sync';
import promptSync from 'prompt-sync';
import * as vrchat from 'vrchat'; //Import unofficial VRChat API
const prompt = promptSync();
import pkg from 'axios-cookiejar-support';
import { AxiosInstance } from 'axios';
const axiosCookieJarSupport = pkg.default;
import {OurLimitedUser, ILimitedUserDTO, VRCWorld, VRCInstance, CombinedUser} from '../src/types/types';
import axios, { AxiosError } from 'axios';
import { CookieJar } from 'tough-cookie';
import fs from 'fs';
import { serialize } from 'v8';
import { saveImageReferenceFromURL, saveImageFromFileObject, downloadVRCImage } from './utils';
import { config } from 'dotenv';


type ToClientData = {
	type: "vrc_friendslist";
	payload: string;
};

enum VRC_REQUESTS {
	GETLIST = "vrc_friendslist",
	GET = "get"
}

type GenericTransitData = {
	type: VRC_REQUESTS.GET;
	request: "vrc_friendslist";
	payload?: string;
};
let configuration: vrchat.Configuration;
let cookieJar: CookieJar;
let axiosInstance: AxiosInstance;
let authApi: vrchat.AuthenticationApi;
let friendsApi: vrchat.FriendsApi;
let worldsApi: vrchat.WorldsApi;
let instanceApi: vrchat.InstancesApi;
async function loadCookieJar(): Promise<CookieJar> {
  if (fs.existsSync("cookies.json")) {
    const data = fs.readFileSync("cookies.json", 'utf-8');
    const json = JSON.parse(data);
    return CookieJar.fromJSON(json);
  } else {
    const settings = DK.getSettings()
    if (settings['cookiejar'])
    {
      const json = JSON.parse(settings['cookiejar']['value'])
      return CookieJar.fromJSON(json);
    }
  }
  return new CookieJar();
}


async function saveCookieJar(jar: CookieJar) {
  const json = jar.toJSON();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(json, null, 2));
  var settings = await DK.getSettings();
  if (settings)
  {
    settings['cookiejar']['value'] = JSON.stringify(json);
    DK.saveSettings(settings);
  }
  
}

const DK = createDeskThing(); //Instantiate DeskThing server.
var loggedIn = false;

const start = async () => {
  
  console.log('Starting, initializing settings...');
  const settings = {
	"email": {
		disabled: false,
		value: '',
		id: 'email',
		type: SETTING_TYPES.STRING,
		label: "Email Address",
		description: "The email address you use to log into VRChat."
	},
	"password": {
		disabled: false,
		value: '',
		id: 'password',
		type: SETTING_TYPES.STRING,
		label: "VRChat Password",
		description: "The password you use to log into VRChat. This will be sent to VRChat servers and nowhere else."
	},
	"twoFactorCode": {
		disabled: false,
		value: '',
		id: 'two_factor_code',
		type: SETTING_TYPES.STRING,
		label: '2FA Code',
		description: 'The two-factor authentication code you get in your Authenticator app or email inbox. This will be used to authenticate you the first time this app is used, or if your authentication token ever gets invalidated.'
	},
  "cookieJar": {
    disabled: false,
    value: '',
    id: 'cookiejar',
    type: SETTING_TYPES.STRING,
    label: "Cookie Jar (DO NOT EDIT MANUALLY)",
    description: "The only way I can seem to get the cookie jar to function in this program outside of the dev environment."
  }
  };
  DK.initSettings(settings);
  console.log('Started the server');
  //await DK.saveSettings(settings);



  //VRCLogin();
  //getFriendsList();
};

DK.once(DESKTHING_EVENTS.SETTINGS, async (setting) => {
	console.log("[SETTINGS]", JSON.stringify(setting.payload, null, 2));
	if (!setting.payload.email.value || !setting.payload.password.value || !setting.payload.two_factor_code.value)
	{
		
		console.warn("[DESKTHING SETTINGS (VRCHAT)] Missing login credentials.")
	} else if (setting.payload.email.value && setting.payload.password.value)
	{

		/*if (loggedIn == false)
		{ await VRCLogin(); }*/
	}
});
const stop = async () => {
  console.log('[VRCHAT SERVER] Stopped the server');
  
};

let loggedInUserDisplayName: string;
let settingsGlobal: AppSettings;
async function VRCLogin() {
  cookieJar = await loadCookieJar();
  const settings = await DK.getSettings();

  const options = {
    headers: {
      "User-Agent": `VRChatDashboard-DeskThing/0.11.6 ${settings?.email?.value || "unknown"}`
    }
  };

  configuration = new vrchat.Configuration({
    username: settings?.email?.value.toString() ?? "email@example.com",
    password: settings?.password?.value.toString() ?? "password",
    baseOptions: {
      jar: cookieJar,
      headers: {
        "User-Agent": `VRChatDashboard-DeskThing/0.11.6`
      }
    }
  });

  configuration.baseOptions.headers["User-Agent"] = `VRChatDashboard-DeskThing/0.11.6 ${configuration.username}`;

  axiosInstance = axios.create({
    jar: cookieJar,
    withCredentials: true
  });

  axiosCookieJarSupport(axiosInstance);

  console.log("[VRCHAT SERVER] Connecting to VRChat...");
  authApi = new vrchat.AuthenticationApi(configuration, undefined, axiosInstance);

  const resp = await authApi.getCurrentUser(options);
  let currentUser = resp.data;
  console.log("[VRCHAT AUTH] Logging in...");

  if (currentUser["requiresTwoFactorAuth"] === "emailOtp") {
    console.log("[VRCHAT AUTH] User has email 2FA. Sending code.");
    await authApi.verify2FAEmailCode(
      { code: settings?.twoFactorCode?.value.toString() ?? "123456" },
      options
    );
    currentUser = (await authApi.getCurrentUser(options)).data;
    await saveCookieJar(cookieJar);
    loggedIn = true;
  }

  if (currentUser["requiresTwoFactorAuth"] === "totp") {
    console.log("[VRCHAT AUTH] user requires 2-factor auth. Sending code.");
    console.log("[VRCHAT AUTH] Using code", settings?.twoFactorCode?.value ?? "123456");
    await authApi.verify2FA(
      { code: settings?.twoFactorCode?.value.toString() ?? "123456" },
      options
    );
    currentUser = (await authApi.getCurrentUser(options)).data;
    await saveCookieJar(cookieJar);
    loggedIn = true;
  }

  console.log(`[VRCHAT AUTH] Logged in as: ${currentUser.displayName}`);

  friendsApi = new vrchat.FriendsApi(configuration, undefined, axiosInstance);
  console.log("[GLOBAL VARS] Instantiated Friends API:", friendsApi);
  worldsApi = new vrchat.WorldsApi(configuration, undefined, axiosInstance);
  console.log("[GLOBAL VARS] Instantiated Worlds API:", worldsApi);
  instanceApi = new vrchat.InstancesApi(configuration, undefined, axiosInstance);
  console.log("[GLOBAL VARS] Instantiated Instances API:", instanceApi);

  loggedIn = true;
  return axiosInstance;
}


function getFileIdFromUrl(url: string) : string
{
	console.log("Extracting file ID from ", url)
	let urlSegments = url.split('/');
	for (let i = 0; i < urlSegments.length; i++) {
		if (urlSegments[i].indexOf("file_") != -1) //If the segment has "file_" in it, it's a valid File ID.
		{
			console.log("Got valid file ID at index ", i, ": ", urlSegments[i]);
			return urlSegments[i];
		}
	}
	console.error(`Could not extract file ID from ${url}.`)
	return 'Invalid segment';
}

async function getInstance(worldId:string, instanceId: string)
{
	console.log("[VRCHAT INSTANCE API] Sending instance data to client.")
	
  const instanceData = await instanceApi.getInstance(worldId, instanceId, configuration.baseOptions)
  if (instanceData != null)
  {
    console.log('[VRCHAT INSTANCE API] Sending instance data to client.')
    DK.send({type: 'instance', payload: JSON.stringify(instanceData.data)});
    return instanceData.data;
  }
  else
  {
    console.warn('[VRCHAT INSTANCE API] Failed to get instance, call to do so returned null.')
  }
}
async function getFriendsList ()
{
  
	

	// Step 2. VRChat consists of several API's (WorldsApi, UsersApi, FilesApi, NotificationsApi, FriendsApi, etc...)
	// Here we instantiate the Authentication API which is required for logging in.
	//const AuthenticationApi = new vrchat.AuthenticationApi(configuration, undefined, axiosInstance);
	
	
	// Pull the list out of the ApiResponse              v–v–v  rename right away
	console.log("[VRCHAT FRIENDS API] Pulling 540 friends from list...")
	try {
		
	
		console.log("[VRCHAT FRIENDS API] We are not authorized. Run login sequence.")
		await VRCLogin();
	  const {data: users} = await friendsApi.getFriends(0, 50, false, configuration.baseOptions);
		console.log("[VRCHAT FRIENDS API] Processing friends in parallel")
	// Process every friend in parallel
		await Promise.all(
			users.map(async (u) => {
				// VRChat’s real field is `profilePicOverride`, not `profilePicOverrideThumbnail`
				const fallbackUrl =
				u.profilePicOverride?.trim().length
					? u.profilePicOverride
					: u.currentAvatarThumbnailImageUrl;

				if (!fallbackUrl) {
				console.warn(`[VRCHAT FRIENDS API] No thumbnail for ${u.displayName}`);
				
				return;
				}
				u.profilePicOverride = await downloadVRCImage(fallbackUrl ? fallbackUrl : '', cookieJar, configuration, u.id);
			
			})
			);
			
      const comUsers: CombinedUser[] = [];
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const comUser: CombinedUser = {
          user,
          world: undefined as any,
          instance: undefined as any,
        };

        if (user.location && !(["offline", "private", "traveling"].includes(user.location ? user.location : "private"))) {
          const [worldId, instanceId] = user.location.toString().split(':');
          comUser.world = await getWorldData(worldId);
          comUser.instance = await getInstance(worldId, instanceId);
        }

        comUsers.push(comUser);
      }
      const serialized = JSON.stringify(comUsers, null, 2);
			DK.send({type: "vrc_friendslist", payload: serialized})
			console.log("Data has been sent for processing.")
			return serialized;
      
	}
	catch (error)
	{
    
		console.warn("Friends list grab failed with error:", error.message);
    console.warn("Friends list stack trace: ", error.stack);
		if (error.message.indexOf('401') > -1) {
			//Unauthorized
			loggedIn = false;
			//await VRCLogin();
		}
	}
	

		/*await filesApi.getFile(fallbackUrl.split('/')[6], options).then (async (fileInfo) =>
		{
			const localUrl = await saveImageReferenceFromURL(fileInfo.data['versions'][fileInfo.data['versions'].length - 1]['file']['url'], `${u.id}.png`, options);
			u.profilePicOverride = localUrl;
		})
		*/

		
		/*await filesApi.downloadFileVersion(fallbackUrl.split('/')[6], Number.parseInt(fallbackUrl.split('/')[7]), options).then(async (url) => //Extract file ID from the fallback URL.
		{
			//console.log("Downloading thumbnail from", url.data);
			
			console.log(`Image Data is type ${}`);
			//let f = new File(url.data, `${u.id}.png`);
			console.log(`Preview of data: ${url.data.slice(0, 100)}`);
			const localUrl = await saveImageFromFileObject(url.data, `${u.id}.png`);
		});*/
			// store the local copy wherever you want
			
		
		

		
	

// `users` now contains the modified friend objects

	
	
	
	//console.log(`Current Online Friends: ${currentOnlineUsers.data}`);
	//let friends = Array<OurLimitedUser>();
	//console.log("Adding friends to new array.");
	/*for (let index = 0; index < currentOnlineUsers.data.length; index++) {
		friends[index] = OurLimitedUser.fromVRCLimitedUser(currentOnlineUsers.data[index]);
		console.log("Added friend " + currentOnlineUsers.data[index].displayName);
	}*/
	console.log("Sending data to client");
	
	
	/*const serialized = JSON.stringify(currentOnlineUsers.data, null, 2);
	DK.send({type: "vrc_friendslist", payload: serialized})
	console.log("Data has been sent for processing.")
	return serialized;*/
}


async function getWorldData(WorldId: string)
{
	console.log(`[VRCHAT WORLDS API] Grabbing world information for World ${WorldId}`)
	const worldInformation = (await worldsApi.getWorld(WorldId));

  const worldImage = await downloadVRCImage(worldInformation.data.imageUrl, cookieJar, configuration, worldInformation.data.id);
	
  worldInformation.data.imageUrl = worldImage ? worldImage : worldInformation.data.imageUrl; //If the download fails, keep it set to the original URL. This will break the image on Car Thing, but at least the program shouldn't crash.

	console.log("[VRCHAT SERVER] Sending world data to client");
	const serializedWorldInfo = JSON.stringify(worldInformation.data, null, 2);
	console.log(`[VRCHAT SERVER] Got world info:  ${serializedWorldInfo}`);
	
	DK.send({type: "world", payload: serializedWorldInfo});
	console.log("[VRCHAT SERVER] World data sent for processing.");
  return worldInformation.data;
}

// Main Entrypoint of the server
DK.on(DESKTHING_EVENTS.START, start);

// Main exit point of the server
DK.on(DESKTHING_EVENTS.STOP, stop);

DK.on(VRC_REQUESTS.GET, async (data) => {
	switch (data.request)
	{
		case 'vrc_friendslist': 
			console.log("[VRCHAT SERVER] Grabbing friends list...");
			if (loggedIn == false)
      {
        VRCLogin();
      }
			getFriendsList().then(friendsList => {
				if (friendsList)
					{
						console.log("Sending friends list to Car Thing.")
						const serialized = friendsList;
						//console.log("Sending serialized list: ", friendsList);
						DK.send({type: "vrc_friendslist", payload: serialized});
						//DK.send({})
						//cachedFriendsList = friendsList;
					} else {
						console.error("Error while pulling friends list from VRChat.")
					}
			})
			break;
		case 'world':
			console.log(`[VRCHAT SERVER] Retrieving world information for world ${data.payload.world.split(':')[0]}`); //Location object comes through in this format [worldId]:[instanceId]. We just need to split it.
			getWorldData(data.payload.world.split(':')[0]);
			break;
		case 'logged_in_username':
			console.log("[VRCHAT SERVER] Sending logged in user's display name.");
			DK.send({type: 'logged_in_username', payload: loggedInUserDisplayName});
      break;
    case 'instance':
      console.log(`[VRCHAT SERVER] Grabbing instance information for ID ${data.payload.instanceid}`);
      await getInstance(data.payload.instanceid.split[0], data.payload.instanceid.split[1]);
      break;
	}
});

DK.on(DESKTHING_EVENTS.DATA, async (data) => {
	console.log("Got data: ", data.payload);
});
//await VRCLogin();	