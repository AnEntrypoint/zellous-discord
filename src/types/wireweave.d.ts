declare module "wireweave/wireweave" {
  export const createWireweave: (options: Record<string, unknown>) => any;
}

declare module "wireweave" {
  export const createWireweave: (options: Record<string, unknown>) => any;
  export const RelayPool: any;
  export const NostrAuth: any;
  export const VoiceSession: any;
  export const Chat: any;
  export const Channels: any;
  export const Servers: any;
}