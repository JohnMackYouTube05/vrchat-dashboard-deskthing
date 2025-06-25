import { createDeskThing, DeskThing } from '@deskthing/server';
import { AppSettings, DESKTHING_EVENTS, SETTING_TYPES } from '@deskthing/types';
import * as Desk from '@deskthing/types';
//import * as promptSync from 'prompt-sync';
import promptSync from 'prompt-sync';
import * as vrchat from 'vrchat'; //Import unofficial VRChat API
const prompt = promptSync();
import pkg from 'axios-cookiejar-support';
const axiosCookieJarSupport = pkg.default;
import {OurLimitedUser, ILimitedUserDTO, VRCWorld, VRCInstance} from '../src/types/types';
import axios, { AxiosError } from 'axios';
import { CookieJar } from 'tough-cookie';
import fs from 'fs';
import { serialize } from 'v8';
import { saveImageReferenceFromURL, saveImageFromFileObject, downloadVRCImage } from './utils';

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
const COOKIE_FILE = 'cookies.json';


async function loadCookieJar(): Promise<CookieJar> {
  if (fs.existsSync(COOKIE_FILE)) {
    const data = fs.readFileSync(COOKIE_FILE, 'utf-8');
    const json = JSON.parse(data);
    return CookieJar.fromJSON(json);
  }
  return new CookieJar();
}

async function saveCookieJar(jar: CookieJar) {
  const json = jar.toJSON();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(json, null, 2));
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

		if (loggedIn == false)
		{ await VRCLogin(); }
	}
});
const stop = async () => {
  console.log('[VRCHAT SERVER] Stopped the server');
  
};

var loggedInUserDisplayName = '';
var settingsGlobal: AppSettings;
async function VRCLogin() {
	
	const cookieJar = await loadCookieJar();
	const settings = await DK.getSettings();
  settingsGlobal = settings ? settings : {};
  const options = { headers: { "User-Agent": `VRChatDashboard-DeskThing/0.11.6 ${settings ? settings['email']['value'].toString() : 'Your email here'}`}};
	const configuration = new vrchat.Configuration({
		username: settings ? settings['email']['value'].toString() : 'email@example.com',
		password: settings ? settings['password']['value'].toString() : 'password',
		baseOptions: {
			jar: cookieJar,
			headers: { "User-Agent": `VRChatDashboard-DeskThing/0.11.6 ${settingsGlobal['email']['value']}`}
		}
	});
	const axiosInstance = axios.create({
	  jar: cookieJar,
	  withCredentials: true
	});
	axiosCookieJarSupport(axiosInstance);

	// Step 2. VRChat consists of several API's (WorldsApi, UsersApi, FilesApi, NotificationsApi, FriendsApi, etc...)
	// Here we instantiate the Authentication API which is required for logging in.
	const AuthenticationApi = new vrchat.AuthenticationApi(configuration, undefined, axiosInstance);
	//const usersApi = new vrchat.UsersApi(configuration);
	//const friendsApi = new vrchat.FriendsApi(configuration);
	//const worldsApi = new vrchat.WorldsApi(configuration);

	console.log("[VRCHAT SERVER] Connecting to VRChat...");
	// Step 3. Calling getCurrentUser on Authentication API logs you in if the user isn't already logged in.
	AuthenticationApi.getCurrentUser(options).then(async resp => {
		var currentUser = resp.data;
		console.log("[VRCHAT AUTH] Logging in...");
		// Step 3.5. Calling email verify2fa if the account has 2FA disabled
		if (currentUser["requiresTwoFactorAuth"] && currentUser["requiresTwoFactorAuth"][0] === "emailOtp") {
      console.log("[VRCHAT AUTH] User has email 2FA. Sending code.");
			await AuthenticationApi.verify2FAEmailCode({ code: settings ? settings['twoFactorCode']['value'].toString() : '123456' }, options)
			currentUser = (await AuthenticationApi.getCurrentUser(options)).data;
			await saveCookieJar(cookieJar);
			loggedIn = true;
			
		}

		// Step 3.5. Calling verify2fa if the account has 2FA enabled
		if (currentUser["requiresTwoFactorAuth"] && currentUser["requiresTwoFactorAuth"][0] === "totp") {
			console.log("[VRCHAT AUTH] user requires 2-factor auth. Sending code.");
			//const TwoFactorCode = prompt("Enter your 2FA code: ");
			console.log("[VRCHAT AUTH] Using code", settings ? settings['twoFactorCode']['value'].toString() : '123456');
			await AuthenticationApi.verify2FA({ code: settings ? settings['twoFactorCode']['value'].toString() : '123456' }, options)
			currentUser = (await AuthenticationApi.getCurrentUser(options)).data;
			await saveCookieJar(cookieJar);
			loggedIn = true;
		}
		
		console.log(`[VRCHAT AUTH] Logged in as: ${currentUser.displayName}`);
		loggedInUserDisplayName = currentUser.displayName;
		loggedIn = true;
		//return true;
	});
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

async function getFriendsList ()
{
	const cookieJar = await loadCookieJar();
	const configuration = new vrchat.Configuration({
		username: settingsGlobal['email']['value'].toString(),
		password: settingsGlobal['password']['value'].toString(),
		baseOptions: {
			jar: cookieJar,
			headers: { "User-Agent": `VRChatDashboard-DeskThing/0.11.6 ${settingsGlobal['email']['value']}`}
		}
	});
  const options = { headers: { "User-Agent": `VRChatDashboard-DeskThing/0.11.6 ${configuration.username}`}};;
	const axiosInstance = axios.create({
	  jar: cookieJar,
	  withCredentials: true
	});
	
	axiosCookieJarSupport(axiosInstance);

	// Step 2. VRChat consists of several API's (WorldsApi, UsersApi, FilesApi, NotificationsApi, FriendsApi, etc...)
	// Here we instantiate the Authentication API which is required for logging in.
	//const AuthenticationApi = new vrchat.AuthenticationApi(configuration, undefined, axiosInstance);
	
	const friendsApi = new vrchat.FriendsApi(configuration);
	const filesApi = new vrchat.FilesApi(configuration);
	// Pull the list out of the ApiResponse              v–v–v  rename right away
	console.log("[VRCHAT FRIENDS API] Pulling 20 friends from list...")
	try {
		const {data: users} = await friendsApi.getFriends(0, 20, false, options);
	
		console.log("[VRCHAT FRIENDS API] We are not authorized. Run login sequence.")
		await VRCLogin();
	
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
			const serialized = JSON.stringify(users, null, 2);
			DK.send({type: "vrc_friendslist", payload: serialized})
			console.log("Data has been sent for processing.")
			return serialized;
	
	}
	catch (error)
	{
		console.warn("Friends list grab failed with error:", error.message);
		if (error.message.indexOf('401') > -1) {
			//Unauthorized
			loggedIn = false;
			VRCLogin();
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
	const options = { headers: { "User-Agent": `VRChatDashboard-DeskThing/0.11.6 ${settingsGlobal['email']['value'].toString()}`}};
	const cookieJar = await loadCookieJar();
	const configuration = new vrchat.Configuration({
		username: settingsGlobal['email']['value'].toString(),
		password: settingsGlobal['password']['value'].toString(),
		baseOptions: {
			jar: cookieJar,
			headers: { "User-Agent": `VRChatDashboard-DeskThing/0.11.6 ${settingsGlobal['email']['value'].toString()}`}
		}
	});
	const axiosInstance = axios.create({
	  jar: cookieJar,
	  withCredentials: true
	});
	axiosCookieJarSupport(axiosInstance);
	const worldsApi = new vrchat.WorldsApi(configuration);
	console.log(`[VRCHAT WORLDS API] Grabbing world information for World ${WorldId}`)
	const worldInformation = (await worldsApi.getWorld(WorldId));
	
	console.log("[VRCHAT SERVER] Sending world data to client");
	const serializedWorldInfo = JSON.stringify(worldInformation.data, null, 2);
	console.log(`[VRCHAT SERVER] Got world info:  ${serializedWorldInfo}`);
	
	DK.send({type: "world", payload: serializedWorldInfo});
	console.log("[VRCHAT SERVER] World data sent for processing.");
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
	}
});

DK.on(DESKTHING_EVENTS.DATA, async (data) => {
	console.log("Got data: ", data.payload);
});
//await VRCLogin();	