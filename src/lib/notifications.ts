/** Outbound channel seam. Future WhatsApp/group adapters implement this; the MVP only records site events. */
export type RadarNotification = { kind: "new" | "changed" | "deadline"; contestId: string; title: string; summary: string; occurredAt: Date };
export type NotificationDestination = { type: "user" | "group"; id: string };
export interface NotificationChannel { readonly name: string; send(event: RadarNotification, destination?: NotificationDestination): Promise<void>; }
export class SiteNotificationChannel implements NotificationChannel {
  readonly name = "site";
  async send() { /* Site events are persisted directly in RadarEvent. */ }
}
