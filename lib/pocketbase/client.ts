import PocketBase from "pocketbase";
import { env } from "@/lib/env";

let pocketbaseClient: PocketBase | null = null;

export function createClient(): PocketBase {
  if (!pocketbaseClient) {
    pocketbaseClient = new PocketBase(env.pocketbaseUrl);
    pocketbaseClient.autoCancellation(false);
  }
  return pocketbaseClient;
}
