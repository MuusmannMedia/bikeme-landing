import type { SupabaseClient } from "@supabase/supabase-js";

import { ClubReadError, clubReadError, isClubId, type Club, type ClubCatalogEntry, type ClubMember, type ClubRow } from "./types";

const pageSize = 200;
const fields = "id,name,description,owner_id,cover_path,logo_path";

// Read-only counterpart of iOS 132's club API. All queries use the actor's
// captured token and the existing RLS/RPC contracts; no elevated client is used.
export function createClubReadApi(client: SupabaseClient, userId: string) {
  async function authorization() {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session || data.session.user.id !== userId) throw new ClubReadError("auth");
    return `Bearer ${data.session.access_token}`;
  }

  async function bounded<T>(query: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try { return await query(controller.signal); }
    catch (error) { throw clubReadError(error); }
    finally { clearTimeout(timeout); }
  }

  async function pages<T>(query: (offset: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
    const result: T[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await query(offset);
      if (error) throw clubReadError(error);
      if (!Array.isArray(data)) throw new ClubReadError("network");
      result.push(...data as T[]);
      if (data.length < pageSize) return result;
    }
  }

  async function hydrate(row: ClubRow, header: string): Promise<Club> {
    const rows = await pages<ClubMember>(offset => bounded(signal => client.rpc("club_list_members", { p_club_id: row.id })
      .setHeader("Authorization", header).range(offset, offset + pageSize - 1).abortSignal(signal)));
    const members = [...new Map(rows.map(member => [member.user_id, {
      user_id: member.user_id, display_name: member.display_name, avatar_url: member.avatar_url,
      role: member.role, joined_at: member.joined_at
    }])).values()];
    const self = members.find(member => member.user_id === userId);
    if (!self || !["owner", "admin", "member"].includes(self.role)) throw new ClubReadError("access");
    return { imageShape:row.cover_path?"cover":row.logo_path?"logo":"none", id: row.id, name: row.name, description: row.description, owner_id: row.owner_id, members, memberCount: members.length, role: self.role };
  }

  return {
    async list(): Promise<Club[]> {
      const header = await authorization();
      const rows = await pages<ClubRow>(offset => bounded(signal => client.from("clubs").select(fields)
        .order("created_at", { ascending: false }).order("id").range(offset, offset + pageSize - 1)
        .setHeader("Authorization", header).abortSignal(signal)));
      // A revocation while loading fails the section rather than showing a
      // partially authorized club. Reopening always performs a fresh read.
      const clubs: Club[] = [];
      for (const row of rows) clubs.push(await hydrate(row, header));
      return clubs;
    },
    async catalog(): Promise<ClubCatalogEntry[]> {
      const header = await authorization();
      const rows = await pages<ClubCatalogEntry>(offset => bounded(signal => client.rpc("club_list_catalog")
        .setHeader("Authorization", header).order("name").order("id")
        .range(offset, offset + pageSize - 1).abortSignal(signal)));
      return rows.map(({ id, name }) => ({ id, name }));
    },
    async detail(clubId: string): Promise<Club> {
      if (!isClubId(clubId)) throw new ClubReadError("access");
      const header = await authorization();
      const { data, error } = await bounded(signal => client.from("clubs").select(fields).eq("id", clubId)
        .setHeader("Authorization", header).abortSignal(signal).maybeSingle());
      if (error) throw clubReadError(error);
      if (!data) throw new ClubReadError("access");
      return hydrate(data as unknown as ClubRow, header);
    }
  };
}
