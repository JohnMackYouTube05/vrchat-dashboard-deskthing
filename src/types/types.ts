import {LimitedUser, DeveloperType, UserStatus} from 'vrchat';
export type LimitedUserType = {
    bio: string;
    bioLinks: string[];
    currentAvatarImageUrl: string;
    currentAvatarThumbnailImageUrl: string;
    currentAvatarTags: string[];
    developerType: DeveloperType;
    displayName: string;
    id: string;
    isFriend: boolean;
    last_platform: string;
    last_login: string;
    profilePicOverride: string;
    pronouns: string;
    status: UserStatus;
    statusDescription: string;
    userIcon: string;
    username: string;
    location: string;
    friendKey: string;
}
export interface ILimitedUserDTO {
    bio: string;
    bioLinks: string[];
    currentAvatarImageUrl: string;
    currentAvatarThumbnailImageUrl: string;
    currentAvatarTags: string[];
    developerType: DeveloperType;
    displayName: string;
    id: string;
    isFriend: boolean;
    last_platform: string;
    last_login: string;
    profilePicOverride: string;
    pronouns: string;
    status: UserStatus;
    statusDescription: string;
    userIcon: string;
    username: string;
    location: string;
    friendKey: string;
  }
  
  export class OurLimitedUser {
    bio!: string;
    bioLinks!: string[];
    currentAvatarImageUrl!: string;
    currentAvatarThumbnailImageUrl!: string;
    currentAvatarTags!: string[];
    developerType!: DeveloperType;
    displayName!: string;
    id!: string;
    isFriend!: boolean;
    last_platform!: string;
    last_login!: string;
    profilePicOverride!: string;
    pronouns!: string;
    status!: UserStatus;
    statusDescription!: string;
    userIcon!: string;
    username!: string;
    location!: string;
    friendKey!: string;
  
    /** 
     * Create a new LimitedUser from a plain‑JS/JSON object.
     * Using `Partial<ILimitedUserDTO>` lets you construct with
     * just the fields you know, filling in defaults later if needed.
     */
    constructor(dto: Partial<ILimitedUserDTO> = {}) {
      Object.assign(this, dto);
    }
  

    
    static fromVRCLimitedUser(user: LimitedUser)
    {
        let u = new OurLimitedUser();
        u.bio = user.bio?.toString() ?? '';
        u.bioLinks = user.bioLinks ?? [];
        u.currentAvatarImageUrl = user.currentAvatarImageUrl ?? '';
        u.currentAvatarThumbnailImageUrl = user.currentAvatarThumbnailImageUrl ?? '';
        u.developerType = user.developerType;
        u.displayName = user.displayName;
        u.friendKey = user.friendKey ?? '';
        u.id = user.id;
        u.isFriend = user.isFriend;
        u.last_login = user.last_login ?? '';
        u.last_platform = user.last_platform;
        u.location = user.location ?? '';
        u.profilePicOverride = user.profilePicOverride ?? '';
        u.pronouns = user.pronouns ?? '';
        u.status = user.status ?? '';
        u.statusDescription = user.statusDescription;
        u.userIcon = user.userIcon ?? '';
        return u;
    }
    /** Example helper: shallow JSON serialisation */
    toJSON(): ILimitedUserDTO {
      const {
        bio, bioLinks, currentAvatarImageUrl, currentAvatarThumbnailImageUrl,
        currentAvatarTags, developerType, displayName, id, isFriend,
        last_platform, last_login, profilePicOverride, pronouns, status,
        statusDescription, userIcon, username, location, friendKey,
      } = this;
      return {
        bio, bioLinks, currentAvatarImageUrl, currentAvatarThumbnailImageUrl,
        currentAvatarTags, developerType, displayName, id, isFriend,
        last_platform, last_login, profilePicOverride, pronouns, status,
        statusDescription, userIcon, username, location, friendKey,
      };
    }
  }
export type GenericTransitData =
  | {
      type: "vrc_friendslist";
      request: "vrc_friendslist";
      payload?: LimitedUser[];
    }

export type FriendsListRequestData =
  | {
      type: "vrc_friendslist";
      payload: LimitedUser[];
    };
  /*| {
      type: "view";
      payload: ViewOptions;
    }
  | {
      type: "temp_type";
      payload: TemperatureTypes
    };*/


/*export enum DeveloperType {
    NONE = "none",
    TRUSTED = "trusted",
    INTERNAL = "internal",
    MODERATOR = "moderator"
}*/

export enum UserStatus {
    JOINME = "join me",
    ACTIVE = "active",
    ASKME = "ask me",
    DND = "busy",
    OFFLINE = "offline"
}

export type VRCWorld = {
    authorId: string;
    authorName: string;
    capacity: number;
    recommendedCapacity: number;
    createdAt: string;
    defaultContentSettings: InstanceContentSettings;
    description: string;
    favorites: number;
    featured: boolean;
    heat: number;
    id: string;
    imageUrl: string;
    instances: string[];
    labsPublicationDate: string;
    name: string;
    namespace: string;
    occupants: number;
    organization: string;
    popularity: number;
    previewYouTubeId: string;
    privateOccupants: number;
    publicOccupants: number;
    publicationDate: string;
    releaseStatus: ReleaseStatus;
    storeId: string;
    tags: string[];
    thumbnailImageUrl: string;
    unityPackages: UnityPackage[];
    updated_at: string;
    urlList: string[];
    version: number;
    visits: number;
    udonProducts: string[];

}

export type VRCInstance = {
    active: boolean;
    ageGate: boolean;
    canRequestInvite: boolean;
    capacity: number;
    contentSettings: InstanceContentSettings;
    displayName: string;
    full: boolean;
    gameServerVersion: number;
    id: string;
    instancePersistenceEnabled: string;
    location: string;
    n_users: number;
    name: string;
    ownerId: string;
    permanent: boolean;
    photonRegion: PhotonRegion;
    platforms: InstancePlatforms;
    playerPersistenceEnabled: boolean;
    region: InstanceRegion;
    secureName: string;
    shortName: string;
    tags: string[];
    type: InstanceType;
    worldId: string;
    hidden: string;
    friends: string;
    private: string;
    queueEnabled: boolean;
    queueSize: number;
    recommendedCapacity: number;
    roleRestricted: boolean;
    strict: boolean;
    userCount: string;
    world: VRCWorld;
    users: LimitedUser[];
    groupAccessType: GroupAccessType,
    hasCapacityForYou: boolean;
    nonce: string;
    closedAt: string;
    hardClose: boolean;

}

export enum GroupAccessType {
    PUBLIC = "public",
    PLUS = "plus",
    MEMBERS = "members"
}

export type InstancePlatforms = {
    android: number;
    ios: number;
    standalonewindows: number;
}

export enum PhotonRegion {
    UNITED_STATES = "us",
    US_EAST = "use",
    US_WEST = "usw",
    US_X = "usx",
    EUROPE = "eu",
    JAPAN = "jp",
    UNKNOWN = "unknown"
}

export enum InstanceType {
    PUBLIC = "public",
    HIDDEN = "hidden",
    FRIENDS = "friends",
    PRIVATE = "private",
    GROUP = "group"
}

export enum InstanceRegion {
    UNITED_STATES = "us",
    US_EAST = "use",
    EUROPE = "eu",
    JAPAN = "jp",
    UNKNOWN = "unknown"
}

export type UnityPackage = {
    id: string;
    assetUrl: string;
    created_at: string;
    impostorizerVersion: string;
    performanceRating: PerformanceRatings;
    platform: string;
    pluginUrl: string;
    unitySortNumber: number;
    unityVersion: string;
    worldSignature: string;
    impostorUrl: string;
    scanStatus: string;
    variant: string;
}

export enum PerformanceRatings {
    NONE = "None",
    EXCELLENT = "Excellent",
    GOOD = "Good",
    MEDIUM = "Medium",
    POOR = "Poor",
    VERY_POOR = "VeryPoor"
}
export enum ReleaseStatus {
    PUBLIC = "public",
    PRIVATE = "private",
    HIDDEN = "hidden",
    ALL = "all"
}
export type InstanceContentSettings = {
    drones: boolean;
    emoji: boolean;
    pedestals: boolean;
    prints: boolean;
    stickers: boolean;
}