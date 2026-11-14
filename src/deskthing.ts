import { createDeskThing } from '@deskthing/client';

type MessageType = 'vrc_friendslist' | 'vrc_profile' | 'vrc_profile_error' | 'vrc_status' | 'vrc_error' | 'logged_in_username';
type ServerMessage = { [K in MessageType]: { type: K; payload: string } }[MessageType];
export const dt = createDeskThing<ServerMessage, { type: 'vrc_request'; request: string; payload?: { userId: string } }>();
