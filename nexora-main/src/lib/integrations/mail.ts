/** Mail integration contracts for LIA. Bodies are opt-in; metadata-first by design. */
export type MailProvider = "gmail" | "outlook";
export type NormalizedMail = { id:string; provider:MailProvider; subject:string; sender:string; receivedAt:string; snippet?:string; labels?:string[]; hasAttachments?:boolean };
export type MailConnection = { provider:MailProvider; email:string|null; status:"not_configured"|"connected"|"error"; scopes:string[]; lastSyncAt:string|null };
export const MAIL_PROVIDERS:{id:MailProvider;name:string;authEnv:string;api:string;defaultScopes:string[]}[]=[
 {id:"gmail",name:"Gmail",authEnv:"GOOGLE_CLIENT_ID",api:"Gmail API",defaultScopes:["gmail.readonly"]},
 {id:"outlook",name:"Outlook / Microsoft 365",authEnv:"MICROSOFT_CLIENT_ID",api:"Microsoft Graph",defaultScopes:["Mail.Read"]},
];
export function sanitizeMailForLia(messages:NormalizedMail[]){return messages.slice(0,30).map(m=>({id:m.id,provider:m.provider,subject:m.subject.slice(0,180),sender:m.sender.slice(0,160),receivedAt:m.receivedAt,snippet:m.snippet?.slice(0,240),labels:m.labels?.slice(0,10),hasAttachments:Boolean(m.hasAttachments)}));}
export function mailConnectionSummary(connections:MailConnection[]){return MAIL_PROVIDERS.map(p=>connections.find(c=>c.provider===p.id)||{provider:p.id,email:null,status:"not_configured",scopes:[],lastSyncAt:null});}
