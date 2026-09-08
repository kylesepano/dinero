import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "../types";
import { mapSnapshot, fingerprint } from "./mapping";
import { validateData } from "../utils/storage";
export function createWorkspaceRepository(
  client: SupabaseClient,
  ownerId: string,
) {
  async function authorization() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session || data.session.user.id !== ownerId)
      throw new Error("Your session changed. Sign in again before saving.");
    return `Bearer ${data.session.access_token}`;
  }
  return {
    async load() {
      const token = await authorization();
      const { data, error } = await client
        .rpc("load_workspace")
        .setHeader("Authorization", token);
      if (error) throw error;
      return mapSnapshot(data);
    },
    async save(
      next: AppData,
      revision: number,
      importHash: string | null = null,
    ) {
      if (!validateData(next))
        throw new Error("Workspace validation failed. Nothing was saved.");
      const token = await authorization();
      const { data, error } = await client
        .rpc("save_workspace", {
          payload: next,
          expected_revision: revision,
          import_hash: importHash,
        })
        .setHeader("Authorization", token);
      if (error) throw error;
      const saved = mapSnapshot(data);
      if (
        importHash &&
        (await fingerprint(saved.data)) !== (await fingerprint(next))
      )
        throw new Error(
          "The import response did not match the backup. Reload cloud data to inspect it. Your original local backup is preserved.",
        );
      return saved;
    },
  };
}
